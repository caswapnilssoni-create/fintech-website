import fs from "fs";

const RSS_URL = "https://blog.taxmitrafinance.com/rss.xml";

async function fetchRSS() {
  const res = await fetch(RSS_URL);

  if (!res.ok) {
    throw new Error("Failed to fetch RSS");
  }

  return await res.text();
}

function extract(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) return "";

  const e = text.indexOf(end, s + start.length);
  if (e === -1) return "";

  return text.substring(s + start.length, e).trim();
}

function slugFromLink(link) {
  return link
    .replace("https://blog.taxmitrafinance.com/", "")
    .replace(/\/$/, "");
}

function createHTML(post) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<title>${post.title}</title>
<meta name="description" content="${post.excerpt}" />

<link rel="stylesheet" href="article.css" />
</head>

<body>
<div class="article-container">

<a href="../index.html" class="back-link">
← TaxMitra
</a>

<div class="article-meta">
${post.category} · ${post.dateLabel} · ${post.readTime} min read
</div>

<h1>${post.title}</h1>

<p class="article-excerpt">
${post.excerpt}
</p>

<div class="article-content">
${post.content}
</div>

<div class="cta-box">
<h3>Need expert tax or compliance help?</h3>

<p>
TaxMitra — CA Swapnil Soni · ITR, GST,
company registration & advisory across India.
</p>

<a href="https://taxmitrafinance.com/#contact" class="cta-button">
Book free consultation →
</a>
</div>

</div>
</body>
</html>`;
}

async function main() {
  const rss = await fetchRSS();

  const items = rss.split("<item>").slice(1);

  const posts = [];

  if (!fs.existsSync("blog")) {
    fs.mkdirSync("blog");
  }

  for (const item of items) {
    const title = extract(item, "<title>", "</title>");
    const link = extract(item, "<link>", "</link>");
    const description = extract(item, "<description><![CDATA[", "]]></description>");
    const pubDate = extract(item, "<pubDate>", "</pubDate>");

    const slug = slugFromLink(link);

    const post = {
      title,
      slug,
      excerpt: description.replace(/<[^>]+>/g, "").slice(0, 140),
      date: pubDate,
      dateLabel: new Date(pubDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      readTime: 5,
      category: "Tax & Finance",
      icon: "📰",
      url: `blog/${slug}.html`,
      hashnodeUrl: link,
      content: description,
    };

    posts.push(post);

    const html = createHTML(post);

    fs.writeFileSync(`blog/${slug}.html`, html);
  }

  const manifest = {
    syncedAt: new Date().toISOString(),
    source: "rss",
    host: "blog.taxmitrafinance.com",
    publication: "TaxMitra — Tax Insights by CA Swapnil Soni",
    posts,
  };

  fs.writeFileSync(
    "blogs.json",
    JSON.stringify(manifest, null, 2)
  );

  console.log(`Synced ${posts.length} posts from RSS`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
