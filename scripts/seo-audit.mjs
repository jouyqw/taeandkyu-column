import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const site = 'https://column.taeandkyu.com';
const errors = [];
const notices = [];

const read = (file) => readFileSync(file, 'utf8');
const match = (html, regex) => (html.match(regex) || [])[1]?.trim() || '';
const stripHtml = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const decodeXml = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");
const fail = (file, message) => errors.push(`${file}: ${message}`);

if (!existsSync('_redirects')) fail('_redirects', '리디렉션 파일이 없습니다.');
if (!existsSync('sitemap.xml')) fail('sitemap.xml', '사이트맵이 없습니다.');
if (!existsSync('rss.xml')) fail('rss.xml', 'RSS가 없습니다.');

const redirects = new Map();
if (existsSync('_redirects')) {
  for (const [index, rawLine] of read('_redirects').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [source, target, status] = line.split(/\s+/);
    if (!source || !target || status !== '301') fail('_redirects', `${index + 1}행 형식이 올바르지 않습니다.`);
    else redirects.set(source, target);
  }
}

const blogFiles = existsSync('blog')
  ? readdirSync('blog').filter((file) => file.endsWith('.html')).sort()
  : [];
const publicPages = [{ file: 'index.html', slug: '', expectedUrl: `${site}/`, isHome: true }];

for (const file of blogFiles) {
  const slug = file.replace(/\.html$/, '');
  const html = read(join('blog', file));
  const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*\bnoindex\b/i.test(html);
  if (!noindex && !redirects.has(`/blog/${slug}`)) {
    publicPages.push({ file: `blog/${file}`, slug, expectedUrl: `${site}/blog/${slug}`, isHome: false });
  }
}

const titleOwners = new Map();
const descriptionOwners = new Map();
const searchableTexts = [];

for (const page of publicPages) {
  if (!existsSync(page.file)) {
    fail(page.file, '파일이 없습니다.');
    continue;
  }

  const html = read(page.file);
  const title = stripHtml(match(html, /<title>([\s\S]*?)<\/title>/i));
  const description = match(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const canonical = match(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const robots = match(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const ogTitle = match(html, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogDescription = match(html, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const ogUrl = match(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);
  const ogImage = match(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const body = match(html, /<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = stripHtml(body);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const h2Count = (html.match(/<h2\b/gi) || []).length;

  if (!title) fail(page.file, 'title이 없습니다.');
  else if ([...title].length > 50) fail(page.file, `title이 너무 깁니다 (${[...title].length}자).`);
  if (!description) fail(page.file, 'description이 없습니다.');
  else if ([...description].length < 45 || [...description].length > 160) {
    fail(page.file, `description 길이가 권장 범위를 벗어납니다 (${[...description].length}자).`);
  }
  if (canonical !== page.expectedUrl) fail(page.file, `canonical이 예상 URL과 다릅니다: ${canonical}`);
  if (!/\bindex\b/i.test(robots) || /\bnoindex\b/i.test(robots)) fail(page.file, '공개 문서 robots 설정을 확인하세요.');
  if (h1Count !== 1) fail(page.file, `h1은 1개여야 합니다 (현재 ${h1Count}개).`);
  if (!page.isHome && h2Count < 4) fail(page.file, `상세 글의 h2가 부족합니다 (현재 ${h2Count}개).`);
  if (bodyText.length < (page.isHome ? 800 : 1800)) fail(page.file, `본문 정보량이 부족합니다 (${bodyText.length}자).`);
  if (!ogTitle || !ogDescription || !ogImage || ogUrl !== page.expectedUrl) fail(page.file, 'Open Graph 정보가 불완전합니다.');
  if (!/<meta\s+name=["']twitter:card["']/i.test(html)) fail(page.file, 'Twitter 카드 정보가 없습니다.');
  if (!html.includes('https://taeandkyu.com/')) fail(page.file, '공식 홈페이지 연결이 없습니다.');
  if (!page.isHome && !/(href=["']\/|href=["']https:\/\/column\.taeandkyu\.com\/)/i.test(html)) {
    fail(page.file, '칼럼 사이트 내부링크가 없습니다.');
  }
  if (html.includes('${')) fail(page.file, '치환되지 않은 템플릿 문구가 있습니다.');

  if (ogImage.startsWith(`${site}/`)) {
    const localImage = ogImage.slice(site.length + 1).split(/[?#]/)[0];
    if (!existsSync(localImage)) fail(page.file, `대표이미지 파일이 없습니다: ${localImage}`);
    else if (statSync(localImage).size < 5000) fail(page.file, `대표이미지가 5KB보다 작습니다: ${localImage}`);
  }

  const jsonBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  if (jsonBlocks.length === 0) fail(page.file, 'JSON-LD가 없습니다.');
  const schemaTypes = new Set();
  for (const block of jsonBlocks) {
    try {
      const value = JSON.parse(block[1]);
      const nodes = value['@graph'] || [value];
      for (const node of nodes) if (node?.['@type']) schemaTypes.add(node['@type']);
    } catch (error) {
      fail(page.file, `JSON-LD 문법 오류: ${error.message}`);
    }
  }
  if (!page.isHome && !schemaTypes.has('Article')) fail(page.file, 'Article 구조화 정보가 없습니다.');
  if (page.isHome && !schemaTypes.has('LegalService')) fail(page.file, 'LegalService 구조화 정보가 없습니다.');

  if (titleOwners.has(title)) fail(page.file, `다른 문서와 title이 같습니다: ${titleOwners.get(title)}`);
  else titleOwners.set(title, page.file);
  if (descriptionOwners.has(description)) fail(page.file, `다른 문서와 description이 같습니다: ${descriptionOwners.get(description)}`);
  else descriptionOwners.set(description, page.file);

  if (!page.isHome) {
    const tokens = new Set(bodyText.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || []);
    searchableTexts.push({ file: page.file, tokens });
  }

  for (const hrefMatch of html.matchAll(/href=["'](\/blog\/[^"'#?]+)[^"']*["']/gi)) {
    const href = hrefMatch[1];
    const targetFile = `blog/${href.slice('/blog/'.length)}.html`;
    if (!existsSync(targetFile) && !redirects.has(href)) fail(page.file, `깨진 내부링크: ${href}`);
  }

  if (/\-\d{4}-\d{2}-\d{2}\.html$/.test(page.file)) {
    if (!html.includes('class="hero-img"')) fail(page.file, '자동 발행 글에 본문 대표이미지가 없습니다.');
    if (!html.includes('공식 자료')) fail(page.file, '자동 발행 글에 공식 자료 출처가 없습니다.');
    if (!html.includes('콘텐츠 제작 방식')) fail(page.file, '자동 발행 방식을 공개하지 않았습니다.');
    if (!html.includes('개인정보 보호를 위해 일부 각색한 실제 상담사례')) fail(page.file, '실제 상담사례 개인정보 안내가 없습니다.');
  }
}

for (let i = 0; i < searchableTexts.length; i += 1) {
  for (let j = i + 1; j < searchableTexts.length; j += 1) {
    const left = searchableTexts[i];
    const right = searchableTexts[j];
    const intersection = [...left.tokens].filter((token) => right.tokens.has(token)).length;
    const union = new Set([...left.tokens, ...right.tokens]).size;
    const similarity = union ? intersection / union : 0;
    if (similarity >= 0.82) fail(left.file, `${right.file}과 본문 유사도가 너무 높습니다 (${(similarity * 100).toFixed(1)}%).`);
  }
}

for (const [source, target] of redirects) {
  const sourceSlug = source.replace(/^\/blog\//, '');
  const targetSlug = target.replace(/^\/blog\//, '');
  if (!existsSync(`blog/${sourceSlug}.html`)) fail('_redirects', `원본 파일이 없습니다: ${source}`);
  if (!existsSync(`blog/${targetSlug}.html`)) fail('_redirects', `대상 파일이 없습니다: ${target}`);
}

if (existsSync('sitemap.xml')) {
  const sitemap = read('sitemap.xml');
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((item) => decodeXml(item[1])));
  const expectedUrls = new Set(publicPages.map((page) => page.expectedUrl));
  for (const url of expectedUrls) if (!sitemapUrls.has(url)) fail('sitemap.xml', `공개 URL이 빠졌습니다: ${url}`);
  for (const url of sitemapUrls) if (!expectedUrls.has(url) && !url.includes('/assets/')) fail('sitemap.xml', `불필요한 URL이 있습니다: ${url}`);
  for (const source of redirects.keys()) if (sitemap.includes(source)) fail('sitemap.xml', `리디렉션 원본이 포함됐습니다: ${source}`);
}

notices.push(`공개 문서 ${publicPages.length}개`);
notices.push(`검색 제외 문서 ${blogFiles.length - publicPages.length + 1 - redirects.size}개`);
notices.push(`301 통합 ${redirects.size}개`);

if (errors.length > 0) {
  console.error(`SEO audit failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO audit passed: ${notices.join(', ')}`);
