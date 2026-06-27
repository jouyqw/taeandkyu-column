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
