#!/usr/bin/env node
/**
 * Build the blog from local Markdown files.
 *
 * Source of truth: content/blog/*.md
 * Each file has YAML-style frontmatter, then Markdown body:
 *
 *   ---
 *   title: Some Post Title
 *   slug: some-post-slug                # optional; defaults to filename
 *   date: 2026-05-17                    # required (YYYY-MM-DD or ISO)
 *   excerpt: One-sentence summary
 *   category: Income Tax
 *   readTime: 6                          # minutes; optional, auto-estimated if omitted
 *   icon: 📰                            # optional; auto-picked from category if omitted
 *   coverImage: https://...              # optional
 *   hashnodeUrl: https://blog....        # optional canonical/source link
 *   tags: [income tax, itr]              # optional
 *   ---
 *
 *   ## Markdown body goes here
 *
 * Output:
 *   blog/<slug>.html        — full article page rendered to HTML
 *   data/blogs.json         — manifest read by index.html homepage
 *   sitemap.xml             — updated with the blog URLs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const BLOG_OUT = path.join(ROOT, 'blog');
const DATA_OUT = path.join(ROOT, 'data');
const SITE_URL = process.env.SITE_URL || 'https://taxmitrafinance.com';

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

function iconForCategory(category, tags = []) {
  const haystack = ((category || '') + ' ' + (tags || []).join(' ')).toLowerCase();
  for (const [key, icon] of Object.entries(TAG_ICONS)) {
    if (key !== 'default' && haystack.includes(key)) return icon;
  }
  return TAG_ICONS.default;
}

// Minimal YAML frontmatter parser. Handles strings, numbers, arrays
// like `tags: [a, b, c]` or `tags:\n  - a\n  - b`.
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const raw = m[1];
  const body = m[2];
  const data = {};
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const km = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!km) {
      i++;
      continue;
    }
    const key = km[1];
    let value = km[2].trim();
    if (value === '' || value === null) {
      // multi-line list block
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(lines[i + 1].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      data[key] = items;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      // strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // coerce numbers
      if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
      data[key] = value;
    }
    i++;
  }
  return { data, body };
}

function estimateReadTime(markdown) {
  const words = stripHtml(marked.parse(markdown)).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Detect a FAQ section in the Markdown body and return an array of {q, a} pairs.
 * Supports two common formats:
 *   1. ## Frequently Asked Questions
 *      **Question text?**
 *      Answer paragraph...
 *   2. ## FAQs
 *      ### Question text?
 *      Answer paragraph...
 */
function extractFAQs(markdown) {
  if (!markdown) return [];
  const lower = markdown.toLowerCase();
  const headerRe = /^(#{2,3})\s+(?:frequently\s+asked\s+questions|faqs?)\b.*$/im;
  const m = lower.match(headerRe);
  if (!m) return [];
  const startIdx = m.index + m[0].length;
  // Find next ## heading after the FAQ section
  const rest = markdown.slice(startIdx);
  const nextHead = rest.search(/^##\s/m);
  const section = nextHead === -1 ? rest : rest.slice(0, nextHead);

  const faqs = [];

  // Format 1: **Q?**\nAnswer
  const re1 = /^\s*\*\*(.+?\?)\*\*\s*\n+([^\n][^\n*][\s\S]*?)(?=\n\s*\*\*|\n\s*###|\n\s*##|$)/gm;
  let m1;
  while ((m1 = re1.exec(section))) {
    const q = m1[1].trim();
    const a = m1[2].trim();
    if (q && a) faqs.push({ q, a });
  }

  if (faqs.length === 0) {
    // Format 2: ### Q?\nAnswer
    const re2 = /^###\s+(.+?\?)\s*\n+([\s\S]*?)(?=\n###\s|\n##\s|$)/gm;
    let m2;
    while ((m2 = re2.exec(section))) {
      const q = m2[1].trim();
      const a = m2[2].trim();
      if (q && a) faqs.push({ q, a });
    }
  }

  return faqs;
}

/** Pick up to 3 related posts: same category first, then most recent. */
function pickRelated(post, allPosts) {
  const others = allPosts.filter((p) => p.slug !== post.slug);
  const sameCat = others.filter((p) => (p.category || '').toLowerCase() === (post.category || '').toLowerCase());
  const seen = new Set();
  const pick = [];
  for (const p of sameCat) {
    if (pick.length >= 3) break;
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      pick.push(p);
    }
  }
  for (const p of others) {
    if (pick.length >= 3) break;
    if (!seen.has(p.slug)) {
      seen.add(p.slug);
      pick.push(p);
    }
  }
  return pick;
}

function buildRelatedHtml(related) {
  if (!related.length) return '';
  const cards = related
    .map((p) => {
      const date = p.dateLabel || '';
      return `<a class="related-card" href="${escapeHtml(p.slug)}.html">
      <span class="r-icon">${escapeHtml(p.icon || '📄')}</span>
      <span class="r-cat">${escapeHtml(p.category || '')}</span>
      <span class="r-title">${escapeHtml(p.title)}</span>
      <span class="r-date">${escapeHtml(date)}</span>
    </a>`;
    })
    .join('\n');
  return `<aside class="related-wrap" aria-label="Related articles">
  <h2>Related Articles</h2>
  <div class="related-grid">${cards}</div>
</aside>`;
}

function buildBreadcrumbHtml(post) {
  const cat = post.category || 'Articles';
  const catParam = encodeURIComponent(cat);
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="../">Home</a><span class="sep">›</span>
  <a href="../#blog">Blog</a><span class="sep">›</span>
  <a href="../?cat=${catParam}#blog">${escapeHtml(cat)}</a><span class="sep">›</span>
  <span aria-current="page">${escapeHtml(post.title)}</span>
</nav>`;
}

function buildBreadcrumbSchema(post) {
  const cat = post.category || 'Articles';
  const catParam = encodeURIComponent(cat);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/#blog` },
      { '@type': 'ListItem', position: 3, name: cat, item: `${SITE_URL}/?cat=${catParam}#blog` },
      { '@type': 'ListItem', position: 4, name: post.title, item: `${SITE_URL}/blog/${post.slug}.html` },
    ],
  };
}

function buildFaqSchema(faqs) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

function buildArticleHtml(post, allPosts) {
  const title = escapeHtml(post.title);
  const cat = escapeHtml(post.category);
  const date = post.dateLabel || '';
  const read = post.readTime ? `${post.readTime} min read` : '';
  const metaParts = [cat, date, read, 'By CA Swapnil Soni'].filter(Boolean);
  const meta = metaParts.map((p) => escapeHtml(p)).join('</span><span>');
  const canonical = `${SITE_URL}/blog/${post.slug}.html`;
  const ogDesc = escapeHtml((post.excerpt || post.title).slice(0, 200));
  const ogImage = post.coverImage
    ? `<meta property="og:image" content="${escapeHtml(post.coverImage)}">`
    : '';
  const hashnodeRef = post.hashnodeUrl
    ? `<p style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:.9rem;color:var(--gray)">Originally published on <a href="${escapeHtml(post.hashnodeUrl)}" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600">blog.taxmitrafinance.com</a></p>`
    : '';

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    image: post.coverImage || undefined,
    author: { '@type': 'Person', name: 'CA Swapnil Soni' },
    publisher: { '@type': 'Organization', name: 'TaxMitra' },
    mainEntityOfPage: canonical,
  };
  const breadcrumbSchema = buildBreadcrumbSchema(post);
  const faqSchema = buildFaqSchema(post.faqs || []);
  const ldScripts = [blogPostingSchema, breadcrumbSchema, faqSchema]
    .filter(Boolean)
    .map((s) => `<script type="application/ld+json">\n${JSON.stringify(s)}\n</script>`)
    .join('\n');

  const breadcrumbHtml = buildBreadcrumbHtml(post);
  const related = pickRelated(post, allPosts);
  const relatedHtml = buildRelatedHtml(related);

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
${ldScripts}
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="article.css">
</head>
<body>
<nav class="site-nav">
  <a class="logo" href="../">Tax<span>Mitra</span></a>
  <a class="back" href="../#blog">← All articles</a>
</nav>
${breadcrumbHtml}
<article class="article-wrap">
  <p class="article-meta"><span>${meta}</span></p>
  <h1>${title}</h1>
  <div class="article-content">${post.contentHtml}</div>
  ${hashnodeRef}
  <div class="cta-box">
    <h3>Need expert tax or compliance help?</h3>
    <p>TaxMitra — CA Swapnil Soni · ITR, GST, company registration &amp; advisory across India.</p>
    <a href="../">Book free consultation →</a>
  </div>
</article>
${relatedHtml}
<footer class="site-footer">© TaxMitra · <a href="../" style="color:var(--gold)">taxmitrafinance.com</a></footer>
</body>
</html>`;
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
    <loc>${SITE_URL}/blog/${p.slug}.html</loc>
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

// ---------- main ----------

function readPosts() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.warn(`No content directory at ${CONTENT_DIR}`);
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const text = fs.readFileSync(fullPath, 'utf8');
    const { data, body } = parseFrontmatter(text);

    if (!data.title) {
      console.warn(`  ! ${file}: missing 'title' in frontmatter — skipping`);
      continue;
    }
    const slug = data.slug || file.replace(/\.md$/, '');
    const slugSafe = slugify(slug);
    const contentHtml = marked.parse(body || '');
    const readTime = typeof data.readTime === 'number' ? data.readTime : estimateReadTime(body || '');
    const tags = Array.isArray(data.tags) ? data.tags : [];

    const isoDate = data.date ? new Date(data.date).toISOString() : null;

    const faqs = extractFAQs(body || '');
    const post = {
      title: String(data.title),
      slug: slugSafe,
      excerpt: data.excerpt ? String(data.excerpt) : stripHtml(contentHtml).slice(0, 220),
      date: isoDate,
      dateLabel: formatDate(isoDate),
      readTime,
      category: data.category || (tags[0] ? tags[0] : 'Tax Insights'),
      icon: data.icon || iconForCategory(data.category, tags),
      url: `blog/${slugSafe}.html`,
      hashnodeUrl: data.hashnodeUrl || null,
      coverImage: data.coverImage || null,
      contentHtml,
      faqs,
    };
    posts.push(post);
    console.log(`  + ${slugSafe} (${contentHtml.length} chars, ${readTime} min${faqs.length ? `, ${faqs.length} FAQ(s)` : ''})`);
  }

  // newest first
  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return posts;
}

function writeOutputs(posts) {
  fs.mkdirSync(BLOG_OUT, { recursive: true });
  fs.mkdirSync(DATA_OUT, { recursive: true });

  // Remove old generated HTMLs
  for (const f of fs.readdirSync(BLOG_OUT)) {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(BLOG_OUT, f));
  }

  for (const post of posts) {
    const html = buildArticleHtml(post, posts);
    fs.writeFileSync(path.join(BLOG_OUT, `${post.slug}.html`), html, 'utf8');
    console.log(`  ✓ blog/${post.slug}.html`);
  }

  // Strip contentHtml and faqs from blogs.json (homepage doesn't need full bodies — saves bandwidth)
  const manifestPosts = posts.map(({ contentHtml, faqs, ...rest }) => rest);
  const manifest = {
    builtAt: new Date().toISOString(),
    source: 'markdown',
    posts: manifestPosts,
  };
  fs.writeFileSync(path.join(DATA_OUT, 'blogs.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Wrote data/blogs.json (${posts.length} post(s))`);

  updateSitemap(posts);
}

function main() {
  console.log(`Building blog from ${CONTENT_DIR}`);
  const posts = readPosts();
  if (!posts.length) {
    console.warn('No posts found. Drop .md files into content/blog/ and re-run.');
    // still write empty manifest so site shows the "no articles yet" state
    fs.mkdirSync(DATA_OUT, { recursive: true });
    fs.writeFileSync(
      path.join(DATA_OUT, 'blogs.json'),
      JSON.stringify({ builtAt: new Date().toISOString(), source: 'markdown', posts: [] }, null, 2)
    );
    return;
  }
  writeOutputs(posts);
  console.log('Done.');
}

main();
