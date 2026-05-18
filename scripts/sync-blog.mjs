#!/usr/bin/env node
/**
 * Sync Hashnode blog -> data/blogs.json + blog/*.html
 *
 * Strategy:
 *   1. Try Hashnode public GraphQL API (works without a token for public publications).
 *   2. If GraphQL fails, fall back to RSS with browser-like headers.
 *   3. Always merge with existing data/blogs.json so manually-added content is preserved
 *      and contentHtml never regresses to null.
 *   4. Rewrite blog/*.html for every post in the merged manifest.
 *
 * Run locally:
 *   node scripts/sync-blog.mjs
 *   node scripts/sync-blog.mjs --from-manifest   # rebuild HTML only, no fetch
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

const UA = 'Mozilla/5.0 (compatible; TaxMitraBlogSync/2.0; +https://taxmitrafinance.com)';

const LIST_QUERY = `
query PublicationPosts($host: String!, $first: Int!) {
  publication(host: $host) {
    id
    title
    posts(first: $first) {
      edges {
        node {
          id
          title
          slug
          brief
          publishedAt
          readTimeInMinutes
          coverImage { url }
          tags { name }
        }
      }
    }
  }
}`;

const POST_QUERY = `
query PostContent($host: String!, $slug: String!) {
  publication(host: $host) {
    post(slug: $slug) {
      title
      slug
      brief
      content { html }
    }
  }
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
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    throw new Error(`Hashnode GraphQL returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text);
  if (json.errors?.length) {
    throw new Error('GraphQL errors: ' + json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function fetchFromHashnode() {
  console.log(`Fetching post list via Hashnode GraphQL for host=${HOST}${TOKEN ? ' (with token)' : ' (anonymous)'}`);
  const data = await gql(LIST_QUERY, { host: HOST, first: 50 });
  const pub = data?.publication;
  if (!pub) throw new Error(`Publication not found for host: ${HOST}`);
  console.log(`  Publication: ${pub.title} (${pub.posts.edges.length} posts)`);

  const posts = [];
  for (const { node } of pub.posts.edges) {
    let contentHtml = null;
    try {
      const detail = await gql(POST_QUERY, { host: HOST, slug: node.slug });
      contentHtml = detail?.publication?.post?.content?.html || null;
      const size = contentHtml ? contentHtml.length : 0;
      console.log(`  + ${node.slug} (${size} chars of HTML)`);
      await sleep(250);
    } catch (e) {
      console.warn(`  ! Body fetch failed for ${node.slug}: ${e.message}`);
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
      })
    );
  }
  return { publication: pub.title, posts };
}

async function fetchRss() {
  console.log(`Fetching RSS: ${RSS_URL}`);
  const res = await fetch(RSS_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.includes('Security Checkpoint') || xml.trim().startsWith('<!DOCTYPE html')) {
    throw new Error('RSS blocked by bot protection');
  }
  return parseRss(xml);
}

function parseRss(xml) {
  const posts = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    if (!title || !link) continue;
    const slug = new URL(link).pathname.replace(/^\//, '').replace(/\/$/, '');
    const encoded = tag(block, 'content:encoded') || tag(block, 'content');
    const desc = tag(block, 'description');
    const pubDate = tag(block, 'pubDate');
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
  if (!posts.length) throw new Error('No items in RSS feed');
  return { publication: HOST, posts };
}

function tag(block, name) {
  const re = new RegExp(
    `<${name}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${name}>|<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,
    'i'
  );
  const m = block.match(re);
  return (m?.[1] || m?.[2] || '').trim();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
  for (const [key, icon] of Object.entries(TAG_ICONS)) {
    if (key !== 'default' && joined.includes(key)) return icon;
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
  const content = post.contentHtml && post.contentHtml.trim().length > 0 ? post.contentHtml : fallbackBody;
  const canonical = `${SITE_URL}/blog/${slugToFile(post.slug)}`;
  const ogDesc = escapeHtml((post.excerpt || post.title).slice(0, 200));

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

/**
 * Merge fetched posts with existing manifest:
 *  - For every slug returned by the remote, prefer the remote data BUT keep existing
 *    contentHtml if the remote returned null/empty.
 *  - Keep any existing posts whose slug is not in the remote result (useful for
 *    manually-added posts).
 */
function mergePosts(remotePosts, existingManifest) {
  const existingBySlug = {};
  for (const p of existingManifest?.posts || []) existingBySlug[p.slug] = p;

  const seen = new Set();
  const merged = [];
  for (const p of remotePosts) {
    seen.add(p.slug);
    const old = existingBySlug[p.slug];
    if (old && (!p.contentHtml || p.contentHtml.trim().length === 0) && old.contentHtml) {
      console.log(`  ~ ${p.slug}: keeping existing contentHtml (remote was empty)`);
      merged.push({ ...p, contentHtml: old.contentHtml });
    } else {
      merged.push(p);
    }
  }
  // Preserve manual / orphan posts not in remote.
  for (const [slug, p] of Object.entries(existingBySlug)) {
    if (!seen.has(slug) && p.contentHtml) {
      console.log(`  ~ ${slug}: preserved (not in remote, has local contentHtml)`);
      merged.push(p);
    }
  }
  // Sort newest first
  merged.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return merged;
}

function writeOutputs(manifest) {
  const blogDir = path.join(ROOT, 'blog');
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.mkdirSync(blogDir, { recursive: true });

  // Delete only auto-generated HTML files (preserves article.css and any non-html assets)
  for (const f of fs.readdirSync(blogDir)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(blogDir, f));
  }

  for (const post of manifest.posts) {
    const html = buildArticleHtml(post);
    fs.writeFileSync(path.join(blogDir, slugToFile(post.slug)), html, 'utf8');
    const hasReal = post.contentHtml && post.contentHtml.trim().length > 0;
    console.log(`  ✓ ${post.url}${hasReal ? '' : '  (excerpt only)'}`);
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

async function main() {
  const existing = loadExistingManifest();

  if (process.argv.includes('--from-manifest')) {
    if (!existing?.posts?.length) throw new Error('No posts in data/blogs.json');
    console.log(`Building ${existing.posts.length} post(s) from data/blogs.json...`);
    writeOutputs(existing);
    return;
  }

  let result = null;
  const errors = [];

  // 1. Always try GraphQL first (works for public Hashnode publications without token).
  try {
    result = await fetchFromHashnode();
    result.source = TOKEN ? 'hashnode-graphql-auth' : 'hashnode-graphql-public';
  } catch (e) {
    errors.push(`GraphQL: ${e.message}`);
    console.warn(`GraphQL failed: ${e.message}`);
  }

  // 2. Fall back to RSS
  if (!result) {
    try {
      result = await fetchRss();
      result.source = 'rss';
    } catch (e) {
      errors.push(`RSS: ${e.message}`);
      console.warn(`RSS failed: ${e.message}`);
    }
  }

  // 3. If both failed but we have existing manifest with contentHtml, rebuild HTML so
  //    article pages still get refreshed (template updates, etc.)
  if (!result) {
    console.error('Both Hashnode and RSS sync failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
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
