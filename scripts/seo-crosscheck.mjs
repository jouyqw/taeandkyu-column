// 세 사이트를 실제로 크롤해서 색인을 막는 구조적 문제를 찾는다.
// 검사 항목: 없는 주소가 404 를 주는지, 내부 링크가 깨지거나 리디렉션을 타는지,
// 사이트맵 주소가 전부 200 이고 자기 자신을 표준으로 가리키는지,
// 링크로 닿는 페이지가 사이트맵에 빠져 있지 않은지.

const sites = (process.env.SEO_SITES || [
  'https://column.taeandkyu.com/',
  'https://column.lawfirmyeyul.com/',
  'https://ulsanlawyer.kr/',
].join(',')).split(',').map((value) => value.trim()).filter(Boolean);

const maxPages = Number(process.env.SEO_MAX_PAGES || 400);
const UA = 'Mozilla/5.0 (compatible; SeoCrosscheck/1.0; +https://column.taeandkyu.com/)';

const problems = [];
const note = (site, kind, detail) => problems.push({ site, kind, detail });

function pathOnly(href, base) {
  try {
    const url = new URL(href, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    url.search = '';
    return url;
  } catch (_) {
    return null;
  }
}

async function head(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA } });
    return { status: response.status, location: response.headers.get('location'), response };
  } catch (error) {
    return { status: -1, error: error.message };
  }
}

function pick(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

async function checkSite(root) {
  const origin = new URL(root).origin;
  const host = new URL(root).host;
  console.log(`===== ${host} =====`);

  // 1. 없는 주소가 200 을 돌려주면 모든 오타 주소가 홈의 사본이 된다.
  const ghost = await head(`${origin}/seo-crosscheck-${Date.now()}-not-a-real-page`);
  if (ghost.status === 200) note(host, 'soft-404', '존재하지 않는 주소가 200 을 반환한다. 404 페이지를 두어야 한다.');
  else console.log(`  없는 주소 응답: ${ghost.status}`);

  // 2. 사이트맵
  const sitemapResponse = await fetch(`${origin}/sitemap.xml`, { headers: { 'user-agent': UA } });
  if (!sitemapResponse.ok) {
    note(host, 'sitemap', `사이트맵을 읽지 못했다 (${sitemapResponse.status})`);
    return;
  }
  const xml = await sitemapResponse.text();
  const sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].trim().replaceAll('&amp;', '&'));
  console.log(`  사이트맵 주소: ${sitemapUrls.length}건`);

  const rawKorean = sitemapUrls.filter((url) => /[^\x00-\x7F]/.test(url));
  if (rawKorean.length) {
    note(host, 'sitemap-encoding', `퍼센트 인코딩하지 않은 주소 ${rawKorean.length}건 (예: ${rawKorean[0]})`);
  }

  const normalize = (value) => {
    try { return new URL(value).href.replace(/\/$/, ''); } catch (_) { return value; }
  };
  const inSitemap = new Set(sitemapUrls.map(normalize));

  // 3. 사이트맵 + 홈에서 시작해 내부 링크를 따라간다.
  const queue = [...new Set([root, ...sitemapUrls])];
  const seen = new Set(queue.map(normalize));
  const sources = new Map();
  let visited = 0;

  while (queue.length && visited < maxPages) {
    const current = queue.shift();
    visited += 1;
    const { status, location, response, error } = await head(current);

    if (status === -1) {
      note(host, 'fetch-error', `${current} — ${error}`);
      continue;
    }
    if (status === 404 || status === 410) {
      note(host, '404', `${current}${sources.has(current) ? `  ← ${[...sources.get(current)].join(', ')}` : ''}`);
      continue;
    }
    if (status >= 300 && status < 400) {
      const from = sources.get(current);
      if (from) note(host, 'redirect-link', `${current} → ${location}  ← ${[...from].join(', ')}`);
      continue;
    }
    if (status !== 200) {
      note(host, 'status', `${current} — ${status}`);
      continue;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) continue;
    const html = await response.text();

    if (inSitemap.has(normalize(current))) {
      const canonical = pick(html, /<link[^>]+rel=["']?canonical["']?[^>]*href=["']([^"']+)["']/i);
      if (!canonical) note(host, 'no-canonical', current);
      else if (normalize(decodeURI(canonical)) !== normalize(decodeURI(current))) {
        note(host, 'canonical-mismatch', `${current} → ${canonical}`);
      }
      const robots = pick(html, /<meta[^>]+name=["']?robots["']?[^>]*content=["']([^"']+)["']/i);
      if (/noindex/i.test(robots)) note(host, 'noindex-in-sitemap', current);
    }

    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) {
      const target = pathOnly(match[1], current);
      if (!target || target.host !== host) continue;
      const key = normalize(target.href);
      if (!sources.has(target.href)) sources.set(target.href, new Set());
      if (sources.get(target.href).size < 3) sources.get(target.href).add(current);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(target.href);
      }
    }
  }

  console.log(`  크롤한 페이지: ${visited}건`);

  // 4. 링크로 닿는데 사이트맵에 없는 페이지
  const orphans = [...sources.keys()]
    .filter((url) => !inSitemap.has(normalize(url)))
    .filter((url) => !/\.(xml|txt|json|jpg|png|webp|svg|ico|css|js)$/i.test(url));
  if (orphans.length) {
    note(host, 'sitemap-gap', `링크로 닿지만 사이트맵에 없는 주소 ${orphans.length}건 (예: ${orphans.slice(0, 3).join(', ')})`);
  }
}

for (const site of sites) {
  try {
    await checkSite(site);
  } catch (error) {
    note(new URL(site).host, 'error', error.message);
  }
  console.log('');
}

if (!problems.length) {
  console.log('구조적으로 색인을 막는 문제는 찾지 못했다.');
  process.exit(0);
}

console.log(`발견한 문제 ${problems.length}건`);
for (const site of [...new Set(problems.map((p) => p.site))]) {
  console.log(`\n----- ${site} -----`);
  for (const kind of [...new Set(problems.filter((p) => p.site === site).map((p) => p.kind))]) {
    const list = problems.filter((p) => p.site === site && p.kind === kind);
    console.log(`  [${kind}] ${list.length}건`);
    for (const item of list.slice(0, 15)) console.log(`      ${item.detail}`);
    if (list.length > 15) console.log(`      ... 외 ${list.length - 15}건`);
  }
}
process.exit(1);
