const fs = require('fs');
const path = require('path');

const site = 'https://column.taeandkyu.com';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

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

// These older posts overlap stronger guide pages and permanently redirect there.
// Keep the redirect sources out of the homepage, sitemap, and RSS.
const redirectedSlugs = new Set([
  'civil-lawsuit-evidence-checklist',
  'criminal-case-first-statement-checklist',
  'police-investigation-first-response',
  'divorce-consultation-property-custody-guide',
  'divorce-property-division-documents'
]);

const posts = blogFiles.map((file) => {
  const fullPath = path.join(blogDir, file);
  const html = read(fullPath);
  const slug = file.replace(/\.html$/, '');
  const url = `${site}/blog/${slug}`;
  const rawTitle = match(html, /<title>([\s\S]*?)<\/title>/i)
    || match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || slug;
  const title = stripHtml(rawTitle).replace(/\s*\|\s*(법무법인|법률칼럼)[\s\S]*$/i, '');
  const description = match(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || stripHtml(match(html, /<article[^>]*>([\s\S]*?)<\/article>/i)).slice(0, 180);
  const robots = match(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const image = match(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const publishedDate = match(html, /"datePublished"\s*:\s*"([^"]+)"/i)
    || match(html, /<time[^>]*datetime=["']([^"']+)["']/i)
    || today;
  const date = match(html, /"dateModified"\s*:\s*"([^"]+)"/i) || publishedDate;

  return { file, slug, url, title, description, image, date, publishedDate, noindex: /\bnoindex\b/i.test(robots) };
}).filter((post) => !post.noindex && !redirectedSlugs.has(post.slug))
  .sort((a, b) => b.date.localeCompare(a.date) || a.file.localeCompare(b.file));

const indexCards = posts.slice(0, 30).map((post) => {
  return `<a class="card" href="/blog/${post.slug}"><span class="tag">법률칼럼</span><h3>${escapeXml(post.title)}</h3><p>${escapeXml(post.description)}</p><span class="meta">${escapeXml(post.date)}</span></a>`;
}).join('\n');

const indexHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>전주변호사 법률칼럼 | 법무법인 태앤규</title>
<meta name="description" content="전주변호사가 형사·민사·이혼 사건의 준비 자료와 대응 순서를 설명합니다. 전주·완주·군산·익산 법률상담 정보를 확인하세요.">
<meta name="google-site-verification" content="HfEaRDFGS9DffVHcE_ozGQFs3_G7P80xUwlJF6R12PU">
<meta name="naver-site-verification" content="2d925953126d9adbdf1535529dc2920148be222c">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="theme-color" content="#1a2740">
<link rel="canonical" href="${site}/">
<link rel="alternate" type="application/rss+xml" title="전주변호사 법률칼럼 RSS" href="${site}/rss.xml">
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="법무법인 태앤규 법률칼럼">
<meta property="og:title" content="전주변호사 법률칼럼 | 법무법인 태앤규">
<meta property="og:description" content="전주 지역 형사·민사·이혼 사건에서 자주 묻는 준비 자료와 대응 순서를 정리합니다.">
<meta property="og:url" content="${site}/">
<meta property="og:image" content="${site}/assets/lawyer-office-police-investigation.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="전주변호사 법률칼럼 | 법무법인 태앤규">
<meta name="twitter:description" content="전주 지역 형사·민사·이혼 사건의 준비 자료와 대응 순서를 확인하세요.">
<meta name="twitter:image" content="${site}/assets/lawyer-office-police-investigation.jpg">
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;color:#111827;background:#f6f7f9;line-height:1.75;word-break:keep-all}.top{background:#1a2740;color:#fff}.wrap{max-width:1040px;margin:0 auto;padding:0 22px}.top .wrap{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:800}.brand small{display:block;color:#cbd5e1;font-weight:400;font-size:12px}.nav a{color:#fff;text-decoration:none;font-size:14px;margin-left:14px}.hero{background:linear-gradient(135deg,#fff 56%,#fff8e7);border-bottom:1px solid #e5e7eb}.hero .wrap{padding:58px 22px 52px}.badge{display:inline-block;background:#f6edcf;color:#3f2f0b;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800;margin-bottom:18px}h1,h2{font-family:'Noto Serif KR',serif;color:#1a2740}h1{font-size:clamp(28px,4vw,44px);line-height:1.25;margin:0 0 16px}.lead{max-width:780px;color:#4b5563;font-size:17px;margin:0}.hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.btn{display:inline-block;padding:12px 17px;border-radius:8px;text-decoration:none;font-weight:900}.btn-main{background:#1a2740;color:#fff}.btn-sub{border:1px solid #b8922a;color:#6e5211;background:#fff}.section{padding:42px 0}.section+.section{padding-top:0}.section h2{font-size:24px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.card{display:block;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:22px;text-decoration:none;color:#111827;box-shadow:0 10px 30px rgba(17,24,39,.05);transition:border-color .2s,box-shadow .2s,transform .2s}.card:hover{border-color:#b8922a;box-shadow:0 12px 34px rgba(17,24,39,.08);transform:translateY(-2px)}.tag{display:inline-block;background:#f6edcf;color:#3f2f0b;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:900;margin-bottom:12px}.card h3{font-size:19px;line-height:1.45;margin:0 0 10px;color:#1a2740}.card p{font-size:14px;color:#4b5563;margin:0}.meta{display:block;margin-top:14px;color:#6b7280;font-size:13px}.case-note{color:#667085;font-size:13px;margin-top:-8px}.editorial-policy{background:#fff;border-left:4px solid #b8922a;border-radius:0 12px 12px 0;padding:20px 22px;color:#475467}.editorial-policy strong{display:block;color:#1a2740;margin-bottom:7px}.editorial-policy p{margin:0}.faq{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:4px 22px}.faq details{padding:17px 0;border-bottom:1px solid #e5e7eb}.faq details:last-child{border-bottom:0}.faq summary{cursor:pointer;color:#1a2740;font-weight:900}.faq p{margin:9px 0 0;color:#4b5563}.footer{padding:36px 0;color:#6b7280;font-size:13px}@media(max-width:600px){.top .wrap{align-items:flex-start;flex-direction:column;padding-top:16px;padding-bottom:16px}.nav a{margin:0 12px 0 0}.hero .wrap{padding-top:42px}.section{padding:32px 0}.hero-actions{flex-direction:column}.btn{text-align:center}}
</style>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"LegalService","@id":"https://taeandkyu.com/#legalservice","name":"법무법인 태앤규","url":"https://taeandkyu.com/","image":"${site}/assets/lawyer-office-police-investigation.jpg","telephone":"010-9886-3105","address":{"@type":"PostalAddress","streetAddress":"홍산남로 19 즐거운빌딩 3층 302호","addressLocality":"전주시 완산구","addressRegion":"전북특별자치도","addressCountry":"KR"},"areaServed":["전주시","완주군","군산시","익산시"],"knowsAbout":["형사사건","민사소송","이혼","재산분할"]},{"@type":"WebSite","@id":"${site}/#website","url":"${site}/","name":"전주변호사 법률칼럼","publisher":{"@id":"https://taeandkyu.com/#legalservice"},"inLanguage":"ko-KR"},{"@type":"CollectionPage","@id":"${site}/#webpage","url":"${site}/","name":"전주변호사 법률칼럼 | 법무법인 태앤규","isPartOf":{"@id":"${site}/#website"},"about":["전주변호사","전주형사전문변호사","전주민사변호사","전주이혼변호사"],"inLanguage":"ko-KR"},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"전주변호사 상담 전 무엇을 준비해야 하나요?","acceptedAnswer":{"@type":"Answer","text":"사건 경위를 날짜순으로 적고 계약서, 문자, 계좌내역, 사진 등 관련 자료의 원본을 함께 준비하면 쟁점을 빠르게 확인하는 데 도움이 됩니다."}},{"@type":"Question","name":"형사·민사·이혼 중 어떤 분야로 상담해야 하나요?","acceptedAnswer":{"@type":"Answer","text":"경찰·검찰 연락은 형사, 금전·계약 분쟁은 민사, 재산분할·양육권은 이혼·가사 분야를 먼저 확인하면 됩니다. 여러 문제가 겹치면 사실관계 전체를 설명해야 합니다."}},{"@type":"Question","name":"군산이나 익산 사건도 상담할 수 있나요?","acceptedAnswer":{"@type":"Answer","text":"전주뿐 아니라 군산과 익산 사건도 관할과 진행 방법을 확인해 상담할 수 있습니다."}}]}]}
</script>
</head>
<body>
<header class="top"><div class="wrap"><div class="brand">법무법인 태앤규<small>Legal Column</small></div><nav class="nav"><a href="https://taeandkyu.com/">공식 홈페이지</a><a href="/sitemap.xml">사이트맵</a><a href="/rss.xml">RSS</a></nav></div></header>
<main>
<section class="hero"><div class="wrap"><span class="badge">JEONJU LAW COLUMN</span><h1>전주변호사 법률칼럼</h1><p class="lead">전주형사전문변호사, 전주민사변호사, 전주이혼변호사 상담을 찾는 분들이 먼저 확인할 자료와 절차를 정리합니다. 실제 공개 수행사례와 개인정보 보호를 위해 일부 각색한 실제 상담사례를 구분해 설명합니다.</p><div class="hero-actions"><a class="btn btn-main" href="https://taeandkyu.com/">전주변호사 법무법인 태앤규 공식 홈페이지</a><a class="btn btn-sub" href="https://naver.me/Fy2SbxqM">네이버 상담 예약</a></div></div></section>
<section class="section"><div class="wrap"><h2>전주 법률상담 분야별 안내</h2><div class="grid">
<a class="card" href="/blog/jeonju-criminal-lawyer-early-response"><span class="tag">형사</span><h3>전주형사전문변호사 상담 안내</h3><p>경찰 연락, 출석요구, 첫 진술과 증거 정리에서 먼저 확인할 사항을 안내합니다.</p></a>
<a class="card" href="/blog/jeonju-divorce-lawyer-property-custody"><span class="tag">이혼·가사</span><h3>전주이혼변호사·전주이혼전문변호사 상담 안내</h3><p>재산분할, 위자료, 양육권과 양육비 쟁점을 준비하는 방법을 설명합니다.</p></a>
<a class="card" href="/blog/civil-lawsuit-before-filing-checklist"><span class="tag">민사</span><h3>전주민사변호사 상담 안내</h3><p>대여금, 공사대금, 손해배상과 계약 분쟁에서 필요한 자료를 정리합니다.</p></a>
</div></div></section>
<section class="section"><div class="wrap"><h2>공식 홈페이지 실제 수행사례</h2><p class="case-note">결과는 사건별 사실관계와 증거에 따라 달라지며 동일한 결과를 보장하지 않습니다.</p><div class="grid"><a class="card" href="https://taeandkyu.com/bbs/board.php?bo_table=notice&amp;wr_id=149"><span class="tag">형사</span><h3>상해죄 벌금형 방어사례</h3><p>공식 홈페이지에 공개된 형사 수행사례 원문을 확인합니다.</p></a><a class="card" href="https://taeandkyu.com/bbs/board.php?bo_table=notice&amp;wr_id=150"><span class="tag">이혼·가사</span><h3>양육비 사전처분 해결사례</h3><p>공식 홈페이지에 공개된 양육비 수행사례 원문을 확인합니다.</p></a><a class="card" href="https://taeandkyu.com/bbs/board.php?bo_table=notice&amp;wr_id=148"><span class="tag">민사</span><h3>매매예약금 반환 청구의 소</h3><p>공식 홈페이지에 공개된 민사 수행사례 원문을 확인합니다.</p></a></div></div></section>
<section class="section"><div class="wrap"><h2>최신 칼럼</h2><div class="grid">
${indexCards}
</div></div></section>
<section class="section"><div class="wrap"><div class="editorial-policy"><strong>법무법인 태앤규 콘텐츠 운영 원칙</strong><p>법무법인 태앤규가 실제 상담에서 반복되는 질문을 바탕으로 주제와 확인 기준을 구성합니다. 자동화는 정해진 형식에 따른 게시·메타·링크 검사를 담당합니다. 실제 상담사례는 의뢰인을 알아볼 수 없도록 일부 사실관계를 변경·재구성하며, 공개 수행사례는 <a href="https://taeandkyu.com/">공식 홈페이지</a> 원문으로 연결합니다. <a href="https://taeandkyu.com/page/page16.php">대표변호사 경력</a>과 작성 주체를 공개하고 법령·절차 변경 시 내용을 갱신합니다.</p></div></div></section>
<section class="section"><div class="wrap"><h2>전주변호사 상담 FAQ</h2><div class="faq"><details><summary>전주변호사 상담 전 무엇을 준비해야 하나요?</summary><p>사건 경위를 날짜순으로 적고 계약서, 문자, 계좌내역, 사진 등 관련 자료의 원본을 함께 준비하면 쟁점을 빠르게 확인하는 데 도움이 됩니다.</p></details><details><summary>형사·민사·이혼 중 어떤 분야로 상담해야 하나요?</summary><p>경찰·검찰 연락은 형사, 금전·계약 분쟁은 민사, 재산분할·양육권은 이혼·가사 분야를 먼저 확인하면 됩니다. 여러 문제가 겹치면 사실관계 전체를 설명해야 합니다.</p></details><details><summary>군산이나 익산 사건도 상담할 수 있나요?</summary><p>전주뿐 아니라 군산과 익산 사건도 관할과 진행 방법을 확인해 상담할 수 있습니다.</p></details></div></div></section>
</main>
<footer class="footer"><div class="wrap">본 칼럼은 일반적인 법률 정보이며, 개별 사건에 대한 법률 의견이 아닙니다.</div></footer>
</body>
</html>
`;

fs.writeFileSync('index.html', indexHtml);

const sitemapUrls = [
  { loc: `${site}/`, image: `${site}/assets/lawyer-office-police-investigation.jpg`, changefreq: 'weekly', priority: '1.0', lastmod: today },
  ...posts.map((post) => ({
    loc: post.url,
    image: post.image,
    changefreq: 'monthly',
    priority: '0.9',
    lastmod: post.date
  }))
];

const sitemapItems = sitemapUrls.map((item) => [
  '  <url>',
  `    <loc>${escapeXml(item.loc)}</loc>`,
  item.image ? '    <image:image>' : '',
  item.image ? `      <image:loc>${escapeXml(item.image)}</image:loc>` : '',
  item.image ? '    </image:image>' : '',
  `    <lastmod>${escapeXml(item.lastmod)}</lastmod>`,
  `    <changefreq>${item.changefreq}</changefreq>`,
  `    <priority>${item.priority}</priority>`,
  '  </url>'
].filter(Boolean).join('\n')).join('\n');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
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
  `      <pubDate>${new Date(`${post.publishedDate}T00:00:00+09:00`).toUTCString()}</pubDate>`,
  '    </item>'
].join('\n')).join('\n');

const rss = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  '    <title>전주변호사 법률칼럼 | 법무법인 태앤규</title>',
  `    <link>${site}/</link>`,
  `    <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />`,
  '    <description>전주변호사가 정리한 형사·민사·이혼 사건의 준비 자료와 대응 순서</description>',
  '    <language>ko</language>',
  `    <lastBuildDate>${new Date(`${today}T00:00:00+09:00`).toUTCString()}</lastBuildDate>`,
  rssPosts,
  '  </channel>',
  '</rss>',
  ''
].join('\n');

fs.writeFileSync('sitemap.xml', sitemap);
fs.writeFileSync('rss.xml', rss);
console.log(`Generated sitemap.xml with ${sitemapUrls.length} URLs`);
console.log(`Generated rss.xml with ${Math.min(posts.length, 30)} items`);
