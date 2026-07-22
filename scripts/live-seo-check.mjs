const site = 'https://column.taeandkyu.com';
const errors = [];
const redirectPairs = [
  ['/blog/civil-lawsuit-evidence-checklist', '/blog/civil-lawsuit-before-filing-checklist'],
  ['/blog/criminal-case-first-statement-checklist', '/blog/jeonju-criminal-lawyer-early-response'],
  ['/blog/police-investigation-first-response', '/blog/jeonju-criminal-lawyer-early-response'],
  ['/blog/divorce-consultation-property-custody-guide', '/blog/jeonju-divorce-lawyer-property-custody'],
  ['/blog/divorce-property-division-documents', '/blog/jeonju-divorce-lawyer-property-custody']
];

const fetchFresh = (url, options = {}) => fetch(url, {
  ...options,
  headers: { 'cache-control': 'no-cache', ...(options.headers || {}) }
});
const match = (html, regex) => (html.match(regex) || [])[1]?.trim() || '';

const sitemapResponse = await fetchFresh(`${site}/sitemap.xml?check=${Date.now()}`);
if (!sitemapResponse.ok) {
  errors.push(`sitemap.xml: ${sitemapResponse.status}`);
} else {
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/column\.taeandkyu\.com(?:\/[^<]*)?)<\/loc>/g)]
    .map((item) => item[1].replace(/&amp;/g, '&'))
    .filter((url) => !url.includes('/assets/'));

  for (const url of urls) {
    const response = await fetchFresh(`${url}${url.includes('?') ? '&' : '?'}check=${Date.now()}`);
    const html = await response.text();
    const canonical = match(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const robots = match(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
    const ogImage = match(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

    if (!response.ok) errors.push(`${url}: HTTP ${response.status}`);
    if (canonical !== url) errors.push(`${url}: canonical 불일치 (${canonical})`);
    if (/\bnoindex\b/i.test(robots)) errors.push(`${url}: 공개 URL에 noindex가 있습니다.`);
    if (!ogImage) errors.push(`${url}: og:image가 없습니다.`);
    if (html.includes('${')) errors.push(`${url}: 치환되지 않은 템플릿 문구가 있습니다.`);

    for (const block of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(block[1]); } catch (error) { errors.push(`${url}: JSON-LD 문법 오류`); }
    }

    if (ogImage) {
      const imageResponse = await fetchFresh(ogImage);
      const imageBytes = (await imageResponse.arrayBuffer()).byteLength;
      if (!imageResponse.ok || imageBytes < 5000) errors.push(`${url}: 대표이미지 응답 오류`);
    }
  }
}

for (const [source, target] of redirectPairs) {
  const response = await fetchFresh(`${site}${source}`, { redirect: 'manual' });
  const location = response.headers.get('location') || '';
  if (response.status !== 301 || !location.endsWith(target)) {
    errors.push(`${source}: 301 대상 오류 (${response.status}, ${location})`);
  }
}

const robotsResponse = await fetchFresh(`${site}/robots.txt?check=${Date.now()}`);
const robotsText = await robotsResponse.text();
if (!robotsResponse.ok || !robotsText.includes(`Sitemap: ${site}/sitemap.xml`)) {
  errors.push('robots.txt: 사이트맵 선언이 없습니다.');
}

if (errors.length > 0) {
  console.error(`Live SEO check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Live SEO check passed.');
