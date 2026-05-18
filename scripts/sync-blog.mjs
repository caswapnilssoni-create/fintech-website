#!/usr/bin/env node
/**
 * Sync Hashnode blog -> data/blogs.json + blog/*.html
 *
 * Strategy (in order):
 *   1. HTML SCRAPE (primary)
 *      - Fetch sitemap.xml from blog.taxmitrafinance.com to get all post URLs.
 *      - For each post, fetch the public HTML page and extract content from the
 *        embedded `__NEXT_DATA__` JSON (most reliable on Hashnode/Next.js sites).
 *      - Fall back to scraping the rendered <article> if __NEXT_DATA__ shape changes.
 *   2. Hashnode GraphQL (fallback) — kept in case it starts working again.
 *   3. RSS (last resort, with retry on 429).
 *   4. Existing data/blogs.json (rebuild HTML, don't lose content).
 *
 * Run locally:
 *   node scripts/sync-blog.mjs
 *   node scripts/sync-blog.mjs --from-manifest   # rebuild HTML only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOST = process.env.HASHNODE_HOST || 'blog.taxmitrafinance.com';
const SITE_URL = process.env.SITE_URL || 'https://taxmitrafinance.com';
const TOKEN = process.env.HASHNODE_TOKEN || '';
const RSS_URL = process.env.HASHNODE_RSS_URL || `https://${HOST}/rss.xml`;

// Real browser User-Agent — avoids Cloudflare rate-limits and bot blocks.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ----------------- utilities -----------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchWithRetry(url, options = {}, { retries = 3, baseDelayMs = 1500 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt === retries) return res;
    const wait = baseDelayMs * Math.pow(2, attempt);
    console.warn(`  retrying ${url} (HTTP ${res.status}) after ${wait}ms`);
    await sleep(wait);
  }
  throw new Error('unreachable');
}

// ----------------- HTML scraping (primary) -----------------

async function fetchHtmlPage(url) {
  const res = await fetchWithRetry(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractNextData(html) {
  const m = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

/** Walk the parsed Next.js data object to find the post node */
function findPostInNextData(data) {
  if (!data || typeof data !== 'object') return null;
  // Common Hashnode shape: data.props.pageProps.post
  const pp = data?.props?.pageProps;
  if (pp?.post) return pp.post;

  // Fallback: search recursively for an object with content.html + slug + title
  const stack = [data];
  const seen = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (
      typeof node.title === 'string' &&
      typeof node.slug === 'string' &&
      node.content &&
      typeof node.content === 'object' &&
      typeof node.content.html === 'string' &&
      node.content.html.length > 100
    ) {
      return node;
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return null;
}

/** Last-resort: extract the visible article body from rendered HTML */
function extractArticleFromRenderedHtml(html) {
  // Hashnode post bodies live inside <div id="post-content-parent"> or a <article> tag.
  const candidates = [
    /<div[^>]+id="post-content-parent"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m && m[1] && m[1].length > 200) return m[1];
  }
  return null;
}

async function fetchSitemapUrls() {
  const xml = await fetchHtmlPage(`https://${HOST}/sitemap.xml`);
  const urls = [];
  const re = /<loc>([\s\S]*?)<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const u = m[1].trim();
    // Only post pages: same host, single path segment, not /archive /tag /@ etc.
    try {
      const parsed = new URL(u);
      if (parsed.host !== HOST) continue;
      const seg = parsed.pathname.replace(/^\//, '').replace(/\/$/, '');
      if (!seg) continue;
      if (seg.includes('/')) continue;
      if (/^(archive|tag|series|@|api|_next|robots\.txt|sitemap\.xml|rss\.xml|newsletter)/i.test(seg)) continue;
      urls.push({ url: u, slug: seg });
    } catch {
      // ignore
    }
  }
  return urls;
}

async function fetchFromPublicHtml() {
  console.log(`Scraping public HTML pages on ${HOST}`);
  let list;
  try {
    list = await fetchSitemapUrls();
    console.log(`  sitemap.xml: ${list.length} post URL(s)`);
  } catch (e) {
    console.warn(`  sitemap.xml failed: ${e.message} — falling back to home-page parse`);
    list = await extractPostsFromHomePage();
    console.log(`  home page: ${list.length} post URL(s)`);
  }

  if (!list.length) throw new Error('No post URLs found on the public blog');

  const posts = [];
  for (const { url, slug } of list) {
    try {
      const html = await fetchHtmlPage(url);
      const post = extractPostFromHtml(html, slug, url);
      if (post) {
        posts.push(post);
        console.log(`  + ${slug} (${(post.contentHtml || '').length} chars)`);
      } else {
        console.warn(`  ! ${slug}: could not extract content`);
      }
      await sleep(400);
    } catch (e) {
      console.warn(`  ! ${slug}: ${e.message}`);
    }
  }
  return { publication: 'TaxMitra — Tax Insights by CA Swapnil Soni', posts };
}

async function extractPostsFromHomePage() {
  const html = await fetchHtmlPage(`https://${HOST}/`);
  const data = extractNextData(html);
  const urls = [];
  const seen = new Set();
  // Walk for objects with slug + publishedAt
  const stack = [data];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (typeof node.slug === 'string' && node.slug && !node.slug.includes('/') && !seen.has(node.slug)) {
      seen.add(node.slug);
      urls.push({ url: `https://${HOST}/${node.slug}`, slug: node.slug });
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  // Also parse simple <a href="/slug"> links as a backup
  const re = new RegExp(`href="https?://${HOST.replace(/\./g, '\\.')}/([a-z0-9-]+)"`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug && !seen.has(slug) && !/^(archive|tag|series|api|newsletter)$/i.test(slug)) {
      seen.add(slug);
      urls.push({ url: `https://${HOST}/${slug}`, slug });
    }
  }
  return urls;
}

function extractPostFromHtml(html, slug, sourceUrl) {
  const data = extractNextData(html);
  let post = findPostInNextData(data);

  let contentHtml = post?.content?.html || null;
  if (!contentHtml) {
    contentHtml = extractArticleFromRenderedHtml(html);
  }

  // Pull metadata from OpenGraph as a safe baseline
  const metaTitle = matchMeta(html, 'og:title') || matchTag(html, 'title') || post?.title || slug;
  const metaDesc = matchMeta(html, 'og:description') || matchMeta(html, 'description') || post?.brief || '';
  const metaDate =
    matchMeta(html, 'article:published_time') || post?.publishedAt || null;
  const metaImage = matchMeta(html, 'og:image') || post?.coverImage?.url || null;

  const tags = Array.isArray(post?.tags)
    ? post.tags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : [];

  const readTime =
    typeof post?.readTimeInMinutes === 'number' ? post.readTimeInMinutes : estimateReadTime(contentHtml);

  return normalizePost({
    title: decodeEntities(metaTitle.replace(/\s*\|\s*TaxMitra.*$/i, '')),
    slug,
    excerpt: stripHtml(metaDesc).slice(0, 260),
    date: metaDate,
    readTime,
    tags,
    contentHtml,
    hashnodeUrl: sourceUrl,
    coverImage: metaImage,
  });
}

function matchMeta(html, prop) {
  const re1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]) : null;
}

function matchTag(html, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function estimateReadTime(html) {
  if (!html) return null;
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// ----------------- Hashnode GraphQL (fallback) -----------------

const LIST_QUERY = `
query PublicationPosts($host: String!, $first: Int!) {
  publication(host: $host) {
    id title
    posts(first: $first) {
      edges { node { id title slug brief publishedAt readTimeInMinutes coverImage { url } tags { name } } }
    }
  }
}`;
const POST_QUERY = `
query PostContent($host: String!, $slug: String!) {
  publication(host: $host) { post(slug: $slug) { title slug brief content { html } } }
}`;

async function gql(query, variables) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': UA,
  };
  if (TOKEN) headers.Authorization = TOKEN;
  const res = await fetch('https://gql.hashnode.com', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!(res.headers.get('content-type') || '').includes('json')) {
    throw new Error(`non-JSON response (HTTP ${res.status})`);
  }
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

async function fetchFromHashnodeGraphQL() {
  console.log(`Trying Hashnode GraphQL (fallback) for ${HOST}`);
  const data = await gql(LIST_QUERY, { host: HOST, first: 50 });
  const pub = data?.publication;
  if (!pub) throw new Error(`No publication for ${HOST}`);
  const posts = [];
  for (const { node } of pub.posts.edges) {
    let contentHtml = null;
    try {
      const d = await gql(POST_QUERY, { host: HOST, slug: node.slug });
      contentHtml = d?.publication?.post?.content?.html || null;
      await sleep(250);
    } catch (e) {
      console.warn(`  body fetch failed for ${node.slug}: ${e.message}`);
    }
    posts.push(
      normalizePost({
        title: node.title,
        slug: node.slug,
        excerpt: stripHtml(node.brief),
        date: node.publishedAt,
        readTime: node.readTimeInMinutes,
        tags: (node.tags || []).map((t) => t.name),
        contentHtml,
        hashnodeUrl: `https://${HOST}/${node.slug}`,
        coverImage: node.coverImage?.url || null,
      })
    );
  }
  return { publication: pub.title, posts };
}

// ----------------- RSS (last resort) -----------------

async function fetchRss() {
  console.log(`Trying RSS (last resort): ${RSS_URL}`);
  const res = await fetchWithRetry(RSS_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.includes('Security Checkpoint') || xml.trim().startsWith('<!DOCTYPE html')) {
    throw new Error('blocked by bot protection');
  }
  return parseRss(xml);
}

function parseRss(xml) {
  const posts = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = rssTag(block, 'title');
    const link = rssTag(block, 'link');
    if (!title || !link) continue;
    const slug = new URL(link).pathname.replace(/^\//, '').replace(/\/$/, '');
    const encoded = rssTag(block, 'content:encoded') || rssTag(block, 'content');
    const desc = rssTag(block, 'description');
    const pubDate = rssTag(block, 'pubDate');
    posts.push(
      normalizePost({
        title: decodeEntities(title),
        slug,
        excerpt: stripHtml(desc).slice(0, 220),
        date: pubDate ? new Date(pubDate).toISOString() : null,
        readTime: null,
        tags: [],
        contentHtml: encoded || null,
        hashnodeUrl: link,
      })
    );
  }
  if (!posts.length) throw new Error('No items in RSS');
  return { publication: HOST, posts };
}

function rssTag(block, name) {
  const re = new RegExp(
    `<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${name}>|<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,
    'i'
  );
  const m = block.match(re);
  return (m?.[1] || m?.[2] || '').trim();
}

// ----------------- normalize + output -----------------

const TAG_ICONS = {
  'income tax': '📰',
  gst: '🧾',
  'tax planning': '💼',
  startup: '🏢',
  llp: '🏢',
  company: '🏢',
  itr: '📰',
  compliance: '📋',
  default: '📄',
};

function iconForTags(tags = []) {
  const joined = tags.join(' ').toLowerCase();
  for (const [k, v] of Object.entries(TAG_ICONS)) {
    if (k !== 'default' && joined.includes(k)) return v;
  }
  return TAG_ICONS.default;
}

function categoryFromTags(tags = []) {
  return tags[0] || 'Tax Insights';
}

function slugToFile(slug) {
  return `${slug}.html`;
}

function normalizePost(raw) {
  const tags = raw.tags || [];
  const file = slugToFile(raw.slug);
  return {
    title: raw.title,
    slug: raw.slug,
    excerpt: raw.excerpt || '',
    date: raw.date,
    dateLabel: formatDate(raw.date),
    readTime: raw.readTime,
    category: raw.category || categoryFromTags(tags),
    icon: raw.icon || iconForTags(tags),
    url: `blog/${file}`,
    hashnodeUrl: raw.hashnodeUrl,
    coverImage: raw.coverImage || null,
    contentHtml: raw.contentHtml,
  };
}

function buildArticleHtml(post) {
  const title = escapeHtml(post.title);
  const cat = escapeHtml(post.category);
  const date = post.dateLabel || '';
  const read = post.readTime ? `${post.readTime} min read` : '';
  const metaParts = [cat, date, read, 'By CA Swapnil Soni'].filter(Boolean);
  const meta = metaParts.map((p) => escapeHtml(p)).join('</span><span>');
  const fallbackBody = `
    <p>${escapeHtml(post.excerpt)}</p>
    <p style="margin-top:1.5rem">
      The full article is being prepared. Read it now on
      <a href="${escapeHtml(post.hashnodeUrl || `https://${HOST}/${post.slug}`)}"
         target="_blank" rel="noopener" style="color:var(--teal);font-weight:600">
        blog.taxmitrafinance.com →
      </a>
    </p>`;
  const content =
    post.contentHtml && post.contentHtml.trim().length > 0 ? post.contentHtml : fallbackBody;
  const canonical = `${SITE_URL}/blog/${slugToFile(post.slug)}`;
  const ogDesc = escapeHtml((post.excerpt || post.title).slice(0, 200));
  const ogImage = post.coverImage ? `<meta property="og:image" content="${escapeHtml(post.coverImage)}">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | TaxMitra</title>
<meta name="description" content="${ogDesc}">
<meta name="author" content="CA Swapnil Soni — TaxMitra">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:site_name" content="TaxMitra">
${ogImage}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${ogDesc}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.excerpt,
  datePublished: post.date,
  image: post.coverImage,
  author: { '@type': 'Person', name: 'CA Swapnil Soni' },
  publisher: { '@type': 'Organization', name: 'TaxMitra' },
  mainEntityOfPage: canonical,
})}
</script>
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="article.css">
</head>
<body>
<nav class="site-nav">
  <a class="logo" href="../index.html">Tax<span>Mitra</span></a>
  <a class="back" href="../index.html#blog">← All articles</a>
</nav>
<article class="article-wrap">
  <p class="article-meta"><span>${meta}</span></p>
  <h1>${title}</h1>
  <div class="article-content">${content}</div>
  <div class="cta-box">
    <h3>Need expert tax or compliance help?</h3>
    <p>TaxMitra — CA Swapnil Soni · ITR, GST, company registration &amp; advisory across India.</p>
    <a href="../index.html">Book free consultation →</a>
  </div>
</article>
<footer class="site-footer">© TaxMitra · <a href="../index.html" style="color:var(--gold)">taxmitrafinance.com</a></footer>
</body>
</html>`;
}

function loadExistingManifest() {
  const p = path.join(ROOT, 'data', 'blogs.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function mergePosts(remotePosts, existingManifest) {
  const existingBySlug = {};
  for (const p of existingManifest?.posts || []) existingBySlug[p.slug] = p;
  const seen = new Set();
  const merged = [];
  for (const p of remotePosts) {
    seen.add(p.slug);
    const old = existingBySlug[p.slug];
    if (old && (!p.contentHtml || p.contentHtml.trim().length === 0) && old.contentHtml) {
      merged.push({ ...p, contentHtml: old.contentHtml });
    } else {
      merged.push(p);
    }
  }
  for (const [slug, p] of Object.entries(existingBySlug)) {
    if (!seen.has(slug) && p.contentHtml) merged.push(p);
  }
  merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return merged;
}

function writeOutputs(manifest) {
  const blogDir = path.join(ROOT, 'blog');
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.mkdirSync(blogDir, { recursive: true });
  for (const f of fs.readdirSync(blogDir)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(blogDir, f));
  }
  for (const post of manifest.posts) {
    const html = buildArticleHtml(post);
    fs.writeFileSync(path.join(blogDir, slugToFile(post.slug)), html, 'utf8');
    const real = post.contentHtml && post.contentHtml.trim().length > 0;
    console.log(`  ✓ ${post.url}${real ? '' : '  (excerpt only)'}`);
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'blogs.json'), JSON.stringify(manifest, null, 2), 'utf8');
  updateSitemap(manifest.posts);
}

function updateSitemap(posts) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.log('No sitemap.xml — skipping');
    return;
  }
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  xml = xml.replace(/\s*<!-- BLOG_AUTO_START -->[\s\S]*?<!-- BLOG_AUTO_END -->\s*/g, '\n');
  const block = posts
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}/${p.url}</loc>
    <lastmod>${(p.date || new Date().toISOString()).slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('\n');
  const insert = `  <!-- BLOG_AUTO_START -->\n${block}\n  <!-- BLOG_AUTO_END -->`;
  xml = xml.replace('</urlset>', `${insert}\n</urlset>`);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log('Updated sitemap.xml');
}

// ----------------- main -----------------

async function main() {
  const existing = loadExistingManifest();

  if (process.argv.includes('--from-manifest')) {
    if (!existing?.posts?.length) throw new Error('No posts in data/blogs.json');
    console.log(`Rebuilding ${existing.posts.length} post(s) from data/blogs.json`);
    writeOutputs(existing);
    return;
  }

  let result = null;
  const errors = [];

  // 1) HTML scrape (primary)
  try {
    result = await fetchFromPublicHtml();
    if (!result.posts.length) throw new Error('0 posts scraped');
    result.source = 'public-html-scrape';
  } catch (e) {
    errors.push(`HTML-scrape: ${e.message}`);
    console.warn(`HTML scrape failed: ${e.message}`);
  }

  // 2) GraphQL fallback
  if (!result) {
    try {
      result = await fetchFromHashnodeGraphQL();
      result.source = 'hashnode-graphql';
    } catch (e) {
      errors.push(`GraphQL: ${e.message}`);
      console.warn(`GraphQL failed: ${e.message}`);
    }
  }

  // 3) RSS fallback
  if (!result) {
    try {
      result = await fetchRss();
      result.source = 'rss';
    } catch (e) {
      errors.push(`RSS: ${e.message}`);
      console.warn(`RSS failed: ${e.message}`);
    }
  }

  // 4) Existing manifest rebuild
  if (!result) {
    console.error('All sync methods failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    if (existing?.posts?.length) {
      console.log(`Rebuilding ${existing.posts.length} post(s) from existing data/blogs.json so HTML stays fresh.`);
      writeOutputs(existing);
      process.exit(0);
    }
    process.exit(1);
  }

  const mergedPosts = mergePosts(result.posts, existing);
  const manifest = {
    syncedAt: new Date().toISOString(),
    source: result.source,
    host: HOST,
    publication: result.publication,
    posts: mergedPosts,
  };
  console.log(`Writing ${manifest.posts.length} post(s) (source: ${manifest.source})...`);
  writeOutputs(manifest);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
