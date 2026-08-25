// 변호사 문체 칼럼 렌더러 (column.taeandkyu.com)
// 사용: node scripts/author/render-article.mjs content/drafts/<slug>.json
// 초안 JSON(변호사가 직접 쓴 본문)을 받아 메타·OG·트위터·JSON-LD·내부링크가 완비된
// blog/<slug>.html 파일로 변환합니다. 자동화 고지 문구는 넣지 않습니다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const site = 'https://column.taeandkyu.com';
const officialHome = 'https://taeandkyu.com/';

// 분야별 고정 설정 (scheduled-publish.mjs와 동일한 자산/키워드 사용)
const GROUPS = {
  criminal: {
    category: '형사사건',
    image: '/assets/criminal-investigation-preparation.webp',
    imageAlt: '경찰조사 전 휴대전화 대화와 사건 시간표, 증거자료를 정리한 장면',
    practiceUrl: 'https://taeandkyu.com/page/page20.php',
    defaultKeyword: '전주형사전문변호사',
    officialSources: [{ name: '국가법령정보센터 형사소송법', url: 'https://www.law.go.kr/법령/형사소송법' }],
  },
  divorce: {
    category: '이혼·가사',
    image: '/assets/divorce-property-custody-consultation.webp',
    imageAlt: '이혼 상담실에서 주택 모형과 재산·양육 자료를 함께 검토하는 장면',
    practiceUrl: 'https://taeandkyu.com/page/page21.php',
    defaultKeyword: '전주이혼변호사',
    officialSources: [{ name: '국가법령정보센터 민법', url: 'https://www.law.go.kr/법령/민법' }],
  },
  civil: {
    category: '민사소송',
    image: '/assets/civil-contract-evidence-review.webp',
    imageAlt: '민사 분쟁 상담을 위해 계약서와 계산서, 부동산 자료를 검토하는 장면',
    practiceUrl: 'https://taeandkyu.com/page/page22.php',
    defaultKeyword: '전주민사변호사',
    officialSources: [
      { name: '국가법령정보센터 민법', url: 'https://www.law.go.kr/법령/민법' },
      { name: '국가법령정보센터 민사소송법', url: 'https://www.law.go.kr/법령/민사소송법' },
    ],
  },
};

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const STYLE = `:root{--navy:#1a2740;--navy2:#233758;--gold:#b8922a;--gold2:#d4a843;--ink:#182033;--muted:#667085;--line:#e3e8ef;--paper:#fff;--bg:#f3f5f8;--soft:#f8fafc;--gold-soft:#fbf6e8}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:'Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.82;word-break:keep-all}.site-wrap{max-width:980px;margin:0 auto;padding:0 22px}.top{background:var(--navy);color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}.top .site-wrap{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-weight:900;letter-spacing:-.02em}.top a{color:#fff;text-decoration:none}.home-link{font-size:13px;color:#f4d98d!important}.page{padding:24px 0 80px}.crumb{font-size:13px;color:var(--muted);margin:0 0 16px}.article{background:var(--paper);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(26,39,64,.09)}.hero-img{margin:0;background:#eef1f5}.hero-img img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover}.head{padding:52px 54px 38px;background:linear-gradient(145deg,#fff 0%,#fbfcfe 72%,#fbf6e8 100%);border-bottom:1px solid var(--line)}.badge{display:inline-flex;align-items:center;gap:7px;background:var(--gold-soft);color:#6c5014;border:1px solid #ead9a8;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:900;margin-bottom:18px}h1{font-size:clamp(29px,4.5vw,44px);line-height:1.3;letter-spacing:-.035em;margin:0 0 20px;color:var(--navy)}.answer{background:var(--navy);color:#fff;border-left:5px solid var(--gold2);border-radius:10px;padding:20px 22px;margin:0;font-size:17px;font-weight:750}.meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:18px;color:var(--muted);font-size:13px}.body{padding:42px 54px 48px}.body h2{font-size:26px;line-height:1.4;letter-spacing:-.025em;margin:54px 0 16px;color:var(--navy)}.body h2:first-of-type{margin-top:32px}.body h3{font-size:19px;color:var(--navy);margin:24px 0 10px}.body p{margin:0 0 18px}.body strong{color:var(--navy);font-weight:900}.body ul,.body ol{margin:0 0 18px;padding-left:22px}.body li{margin:7px 0}.table-wrap{overflow-x:auto;margin:20px 0 26px;border:1px solid var(--line);border-radius:12px;background:#fff}table{width:100%;border-collapse:collapse;min-width:680px}th,td{padding:15px 17px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}thead th{background:var(--navy);color:#fff;font-size:14px}tbody th{width:190px;background:var(--soft);color:var(--navy)}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}.callout,.warning{border-radius:14px;padding:22px 24px;margin:26px 0}.callout{background:#eef5ff;border:1px solid #c9ddfa}.warning{background:#fff2f3;border:1px solid #f1c8cd}.warning .label,.callout .label{display:inline-block;font-size:12px;font-weight:900;color:#755712;margin-bottom:8px}.source-list{padding-left:22px}.source-list li{margin:8px 0}.source-list a{color:var(--navy2);font-weight:800}.related-card{background:var(--soft);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:26px 0}.related-card b{display:block;color:var(--navy);margin-bottom:8px}.related-card a{display:block;color:var(--navy2);font-weight:800;margin:6px 0}.faq{margin-top:14px}.faq details{border-top:1px solid var(--line);padding:16px 2px}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-weight:850;color:var(--navy)}.faq details p{margin:10px 0 2px;color:#475467}.cta{margin-top:36px;padding:26px;border-radius:14px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff}.cta b{font-size:18px}.cta a{display:inline-block;color:#f4d98d;font-weight:900;margin-right:16px;margin-top:8px}.disclaimer{margin-top:30px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}.body p{font-size:16.5px}.infographic{margin:28px 0;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(26,39,64,.06)}.infographic-h{background:var(--navy);color:#fff;padding:15px 22px;font-weight:900;font-size:15px;letter-spacing:-.01em}.ig-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}.ig-item{background:#fff;padding:20px;display:flex;gap:13px;align-items:flex-start}.ig-ic{flex-shrink:0;width:42px;height:42px;border-radius:50%;background:var(--gold-soft);border:1px solid #ead9a8;display:flex;align-items:center;justify-content:center;color:#9a7a1e}.ig-item b{display:block;color:var(--navy);font-size:15px;margin-bottom:4px}.ig-item .t{font-size:13.5px;color:#4b5563;line-height:1.62}.figure-note{color:var(--muted);font-size:12.5px;margin:-16px 0 26px;text-align:center}.footer{padding:30px 0;color:var(--muted);font-size:13px}@media(max-width:720px){.top .site-wrap{align-items:flex-start;flex-direction:column;padding-top:15px;padding-bottom:15px}.head{padding:34px 20px 28px}.body{padding:30px 20px 40px}.body p{font-size:16px;line-height:1.9;margin-bottom:19px}.body h2{font-size:22px;margin:42px 0 14px}.body h3{font-size:18px}.answer{font-size:16px;padding:18px 19px}.page{padding-top:14px}.hero-img img{aspect-ratio:1200/760}.ig-grid{grid-template-columns:1fr}.table-wrap{margin:18px 0 22px}table{min-width:0}th,td{padding:12px 13px;font-size:14px}tbody th{width:40%}.callout,.warning{padding:17px 18px}}`;

export function renderArticle(draft) {
  const group = GROUPS[draft.category];
  if (!group) throw new Error(`Unknown category: ${draft.category}`);
  const keyword = draft.keyword || group.defaultKeyword;
  const slug = draft.slug;
  const url = `${site}/blog/${slug}`;
  const title = draft.title;
  const description = draft.description;
  const lead = draft.lead;
  const publishDate = draft.date;
  const faqs = draft.faqs || [];
  const related = draft.related || [];

  const officialSourceHtml = group.officialSources
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`)
    .join('');
  const faqHtml = faqs
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
    .join('');
  const relatedHtml = related.length
    ? `<div class="related-card"><b>함께 보면 좋은 칼럼</b>${related
        .map((r) => `<a href="${esc(r.href)}">${esc(r.label)} →</a>`)
        .join('')}</div>`
    : '';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: title,
        description,
        image: `${site}${group.image}`,
        author: { '@type': 'Organization', name: '법무법인 태앤규', url: officialHome },
        publisher: { '@id': 'https://taeandkyu.com/#legalservice' },
        datePublished: publishDate,
        dateModified: publishDate,
        mainEntityOfPage: url,
        about: [keyword, group.category],
        isPartOf: { '@id': `${site}/#website` },
        inLanguage: 'ko',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '전주변호사 법률칼럼', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: group.category, item: group.practiceUrl },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
      ...(faqs.length
        ? [{
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }]
        : []),
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        url: `${site}/`,
        name: '전주변호사 법률칼럼',
        publisher: { '@id': 'https://taeandkyu.com/#legalservice' },
        inLanguage: 'ko-KR',
      },
      {
        '@type': 'LegalService',
        '@id': 'https://taeandkyu.com/#legalservice',
        name: '법무법인 태앤규',
        url: officialHome,
        telephone: '010-9886-3105',
        areaServed: ['전주시', '완주군', '군산시', '익산시'],
        address: {
          '@type': 'PostalAddress',
          streetAddress: '홍산남로 19 즐거운빌딩 3층 302호',
          addressLocality: '전주시 완산구',
          addressRegion: '전북특별자치도',
          addressCountry: 'KR',
        },
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | 법무법인 태앤규</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="법무법인 태앤규">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="법무법인 태앤규 법률칼럼">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site}${group.image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${site}${group.image}">
<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<header class="top"><div class="site-wrap"><a class="brand" href="/">전주변호사 법률칼럼 · 법무법인 태앤규</a><a class="home-link" href="${officialHome}">전주변호사 공식 홈페이지 →</a></div></header>
<main class="page"><div class="site-wrap"><nav class="crumb" aria-label="이동 경로"><a href="/">법률칼럼</a> &gt; <a href="/">${esc(group.category)}</a> &gt; ${esc(keyword)}</nav><article class="article">
<figure class="hero-img"><img src="${esc(group.image)}" alt="${esc(group.imageAlt)}" width="1200" height="630" fetchpriority="high"></figure>
<header class="head"><span class="badge">${esc(group.category)} · JEONJU</span><h1>${esc(title)}</h1><p class="answer">${esc(lead)}</p><div class="meta"><span>작성 법무법인 태앤규</span><span>최종 검토 ${publishDate}</span><span>상담지역 전주·완주·군산·익산</span></div></header>
<section class="body">
${draft.bodyHtml}
${relatedHtml}
<h2>공식 자료와 근거</h2>
<ul class="source-list">${officialSourceHtml}<li><a href="${group.practiceUrl}" target="_blank" rel="noopener">법무법인 태앤규 ${esc(group.category)} 안내</a></li></ul>
${faqs.length ? `<h2>자주 묻는 질문</h2><div class="faq">${faqHtml}</div>` : ''}
<div class="cta"><b>${esc(keyword)} 상담이 필요하신가요?</b><br>사건 단계와 남은 기한, 준비된 자료를 함께 검토해 다음 순서를 안내합니다.<br><a href="tel:010-9886-3105">전화 010-9886-3105</a><a href="${officialHome}">공식 홈페이지 →</a></div>
<p class="disclaimer">이 글은 일반적인 법률 정보 제공을 위한 것으로, 개별 사건에 대한 구체적 법률 자문이나 결과 보장이 아닙니다. 실제 대응은 사실관계와 증거, 법령·실무의 변경에 따라 달라질 수 있으므로 변호사와의 상담을 통해 확인하시기 바랍니다.</p>
</section>
</article></div></main>
<footer class="footer"><div class="site-wrap">© 법무법인 태앤규 · 전북 전주시 완산구 홍산남로 19 즐거운빌딩 3층 302호 · 대표전화 010-9886-3105</div></footer>
</body>
</html>`;
}

// CLI — 다른 스크립트가 renderArticle 을 import 할 때는 실행되면 안 된다.
const isEntry = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
const draftPath = isEntry ? process.argv[2] : undefined;
if (draftPath) {
  if (!existsSync(draftPath)) {
    console.error(`Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  const html = renderArticle(draft);
  const outPath = `blog/${draft.slug}.html`;
  writeFileSync(outPath, html, 'utf8');
  console.log(`Rendered ${outPath} (${html.length} bytes)`);
}
