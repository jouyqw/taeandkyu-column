import { createSign } from 'node:crypto';

// Search Console URL Inspection API 로 색인 상태를 직접 물어본다.
// 워크플로에서 GSC_SERVICE_ACCOUNT_JSON 시크릿을 받아 실행한다.

const sites = (process.env.GSC_SITES || [
  'https://column.taeandkyu.com/',
  'https://column.lawfirmyeyul.com/',
  'https://ulsanlawyer.kr/',
].join(',')).split(',').map((value) => value.trim()).filter(Boolean);

const extraUrls = (process.env.GSC_EXTRA_URLS || '').split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
const limitPerSite = Number(process.env.GSC_LIMIT || 200);

function base64url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeXml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

async function createAccessToken() {
  const rawJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawJson) throw new Error('GSC_SERVICE_ACCOUNT_JSON secret is missing.');
  const credentials = JSON.parse(rawJson);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claim))}`;
  const jwt = `${unsigned}.${base64url(createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key))}`;
  const response = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`token error: ${JSON.stringify(data)}`);
  return { accessToken: data.access_token, clientEmail: credentials.client_email };
}

async function listProperties(token) {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`property list error: ${JSON.stringify(data)}`);
  return (data.siteEntry || []).map((entry) => entry.siteUrl);
}

function findProperty(properties, siteUrl) {
  if (properties.includes(siteUrl)) return siteUrl;
  const host = new URL(siteUrl).hostname;
  return properties.find((property) => {
    if (!property.startsWith('sc-domain:')) return false;
    const domain = property.slice('sc-domain:'.length);
    return host === domain || host.endsWith(`.${domain}`);
  }) || null;
}

async function sitemapUrls(siteUrl) {
  const response = await fetch(new URL('/sitemap.xml', siteUrl), { cache: 'no-store' });
  if (!response.ok) throw new Error(`sitemap ${siteUrl}: ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1].trim()));
}

async function inspect(token, property, url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'ko' }),
    });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    const data = await response.json();
    if (!response.ok) return { url, error: JSON.stringify(data.error?.message || data) };
    const result = data.inspectionResult?.indexStatusResult || {};
    return {
      url,
      verdict: result.verdict,
      coverageState: result.coverageState,
      robotsTxtState: result.robotsTxtState,
      pageFetchState: result.pageFetchState,
      googleCanonical: result.googleCanonical,
      userCanonical: result.userCanonical,
      lastCrawlTime: result.lastCrawlTime,
      referringUrls: result.referringUrls,
    };
  }
  return { url, error: 'rate limited' };
}

const auth = await createAccessToken();
console.log(`service account: ${auth.clientEmail}`);
const properties = await listProperties(auth.accessToken);
console.log(`accessible properties (${properties.length}):`);
for (const property of properties) console.log(`  - ${property}`);
console.log('');

const problems = [];

for (const siteUrl of sites) {
  const property = findProperty(properties, siteUrl);
  console.log(`===== ${siteUrl} =====`);
  if (!property) {
    console.log(`  SKIP: ${auth.clientEmail} 을(를) 이 속성의 사용자로 추가해야 합니다.`);
    console.log('');
    continue;
  }
  console.log(`  property: ${property}`);

  let urls = [];
  try {
    urls = await sitemapUrls(siteUrl);
  } catch (error) {
    console.log(`  sitemap error: ${error.message}`);
  }
  urls = [...new Set([...urls, ...extraUrls.filter((url) => url.startsWith(siteUrl))])].slice(0, limitPerSite);
  console.log(`  inspecting ${urls.length} url(s)`);

  const buckets = new Map();
  for (const url of urls) {
    const result = await inspect(auth.accessToken, property, url);
    const key = result.error ? `ERROR: ${result.error}` : `${result.verdict} / ${result.coverageState}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(result);
    if (!result.error && result.verdict !== 'PASS') problems.push({ site: siteUrl, ...result });
    if (!result.error && result.userCanonical && result.googleCanonical && result.userCanonical !== result.googleCanonical) {
      problems.push({ site: siteUrl, note: 'canonical mismatch', ...result });
    }
  }

  for (const [key, list] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  [${list.length}] ${key}`);
    for (const item of list.slice(0, 8)) {
      console.log(`      ${item.url}`);
      if (item.googleCanonical && item.googleCanonical !== item.url) console.log(`        google canonical: ${item.googleCanonical}`);
      if (item.userCanonical && item.userCanonical !== item.url) console.log(`        user canonical:   ${item.userCanonical}`);
      if (item.pageFetchState && item.pageFetchState !== 'SUCCESSFUL') console.log(`        fetch: ${item.pageFetchState}`);
      if (item.referringUrls?.length) console.log(`        referrers: ${item.referringUrls.slice(0, 3).join(', ')}`);
    }
    if (list.length > 8) console.log(`      ... 외 ${list.length - 8}건`);
  }
  console.log('');
}

console.log(`총 문제 URL: ${problems.length}`);
