const fs = require('fs');
const path = require('path');

const site = 'https://column.taeandkyu.com';
const today = new Date().toISOString().slice(0, 10);

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const stripHtml = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const read = (file) => fs.readFileSync(file, 'utf8');
const match = (html, regex) => (html.match(regex) || [])[1]?.trim() || '';

const blogDir = 'blog';
const blogFiles = fs.existsSync(blogDir)
  ? fs.readdirSync(blogDir).filter((file) => file.endsWith('.html')).sort()
  : [];

const posts = blogFiles.map((file) => {
  const fullPath = path.join(blogDir, file);
  const html = read(fullPath);
  const slug = file.replace(/\.html$/, '');
  const url = `${site}/blog/${slug}`;
  const rawTitle = match(html, /<title>([\s\S]*?)<\/title>/i)
    || match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || slug;
  const title = stripHtml(rawTitle).replace(/\s*\|\s*법무법인[\s\S]*$/i, '');
  const description = match(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || stripHtml(match(html, /<article[^>]*>([\s\S]*?)<\/article>/i)).slice(0, 180);
  const date = match(html, /"datePublished"\s*:\s*"([^"]+)"/i)
    || match(html, /<time[^>]*datetime=["']([^"']+)["']/i)
    || today;

  return { file, url, title, description, date };
}).sort((a, b) => b.date.localeCompare(a.date) || a.file.localeCompare(b.file));

const indexCards = posts.map((post) => {
  const slug = post.file.replace(/\.html$/, '');
  return `<a class="card" href="/blog/${slug}"><span class="tag">법률칼럼</span><h3>${escapeXml(post.title)}</h3><p>${escapeXml(post.description)}</p><span class="meta">${escapeXml(post.date)}</span></a>`;
}).join('\n');

const indexHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>법무법인 태앤규 법률칼럼</title>
<meta name="description" content="법무법인 태앤규의 형사, 이혼, 민사소송 법률칼럼입니다.">
<meta name="google-site-verification" content="HfEaRDFGS9DffVHcE_ozGQFs3_G7P80xUwlJF6R12PU">
<meta name="naver-site-verification" content="2d925953126d9adbdf1535529dc2920148be222c">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${site}/">
<link rel="alternate" type="application/rss+xml" title="법무법인 태앤규 법률칼럼 RSS" href="${site}/rss.xml">
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#111827;background:#f6f7f9;line-height:1.75;word-break:keep-all}.top{background:#111827;color:#fff}.wrap{max-width:1040px;margin:0 auto;padding:0 22px}.top .wrap{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:800}.brand small{display:block;color:#cbd5e1;font-weight:400;font-size:12px}.nav a{color:#fff;text-decoration:none;font-size:14px;margin-left:14px}.hero{background:#fff;border-bottom:1px solid #e5e7eb}.hero .wrap{padding:58px 22px 46px}.badge{display:inline-block;background:#e8d8a8;color:#3f2f0b;padding:5px 10px;border-radius:4px;font-size:12px;font-weight:800;margin-bottom:18px}h1{font-size:clamp(28px,4vw,44px);line-height:1.25;margin:0 0 16px}.lead{max-width:720px;color:#4b5563;font-size:17px;margin:0}.section{padding:42px 0}.section h2{font-size:24px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.card{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:22px;text-decoration:none;color:#111827;box-shadow:0 10px 30px rgba(17,24,39,.05)}.card:hover{border-color:#b99b4b;box-shadow:0 12px 34px rgba(17,24,39,.08);transform:translateY(-2px)}.tag{display:inline-block;background:#f6edcf;color:#3f2f0b;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;margin-bottom:12px}.card h3{font-size:19px;line-height:1.45;margin:0 0 10px}.card p{font-size:14px;color:#4b5563;margin:0}.meta{display:block;margin-top:14px;color:#6b7280;font-size:13px}.footer{padding:36px 0;color:#6b7280;font-size:13px}
</style>
</head>
<body>
<header class="top"><div class="wrap"><div class="brand">법무법인 태앤규<small>Legal Column</small></div><nav class="nav"><a href="https://taeandkyu.com/">공식 홈페이지</a><a href="/sitemap.xml">사이트맵</a><a href="/rss.xml">RSS</a></nav></div></header>
<main>
<section class="hero"><div class="wrap"><span class="badge">LAW COLUMN</span><h1>법무법인 태앤규 법률칼럼</h1><p class="lead">형사사건, 경찰조사, 이혼, 재산분할, 민사소송 등 실제 상담에서 자주 묻는 쟁점을 정리합니다.</p></div></section>
<section class="section"><div class="wrap"><h2>최신 칼럼</h2><div class="grid">
${indexCards}
</div></div></section>
</main>
<footer class="footer"><div class="wrap">본 칼럼은 일반적인 법률 정보이며, 개별 사건에 대한 법률 의견이 아닙니다.</div></footer>
</body>
</html>
`;

fs.writeFileSync('index.html', indexHtml);

const sitemapUrls = [
  { loc: `${site}/`, changefreq: 'weekly', priority: '1.0', lastmod: today },
  ...posts.map((post) => ({
    loc: post.url,
    changefreq: 'monthly',
    priority: '0.9',
    lastmod: post.date
  }))
];

const sitemapItems = sitemapUrls.map((item) => [
  '  <url>',
  `    <loc>${escapeXml(item.loc)}</loc>`,
  `    <lastmod>${escapeXml(item.lastmod)}</lastmod>`,
  `    <changefreq>${item.changefreq}</changefreq>`,
  `    <priority>${item.priority}</priority>`,
  '  </url>'
].join('\n')).join('\n');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  sitemapItems,
  '</urlset>',
  ''
].join('\n');

const rssPosts = posts.slice(0, 30).map((post) => [
  '    <item>',
  `      <title>${escapeXml(post.title)}</title>`,
  `      <link>${escapeXml(post.url)}</link>`,
  `      <guid isPermaLink="true">${escapeXml(post.url)}</guid>`,
  `      <description>${escapeXml(post.description)}</description>`,
  `      <pubDate>${new Date(`${post.date}T00:00:00+09:00`).toUTCString()}</pubDate>`,
  '    </item>'
].join('\n')).join('\n');

const rss = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0">',
  '  <channel>',
  '    <title>법무법인 태앤규 법률칼럼</title>',
  `    <link>${site}/</link>`,
  '    <description>법무법인 태앤규의 전주 형사, 성범죄, 이혼, 음주운전, 경찰조사 대응 법률칼럼</description>',
  '    <language>ko</language>',
  `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  rssPosts,
  '  </channel>',
  '</rss>',
  ''
].join('\n');

fs.writeFileSync('sitemap.xml', sitemap);
fs.writeFileSync('rss.xml', rss);
console.log(`Generated sitemap.xml with ${sitemapUrls.length} URLs`);
console.log(`Generated rss.xml with ${Math.min(posts.length, 30)} items`);
