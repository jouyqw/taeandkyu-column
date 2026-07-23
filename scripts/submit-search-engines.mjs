import { createHash, createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const stateFile = process.env.SUBMISSION_STATE_FILE || 'data/search-submission-state.json';
const mainPageUrl = 'https://taeandkyu.com/page/page30.php';
const dryRun = process.env.SUBMISSION_DRY_RUN === '1';

const targets = [
  {
    id: 'column',
    siteUrl: 'https://column.taeandkyu.com/',
    sitemapUrl: 'https://column.taeandkyu.com/sitemap.xml',
    indexNowKey: '91a7460f8c9b4e8db4f2a13d67a0c5e2',
    indexNowKeyLocation: 'https://column.taeandkyu.com/91a7460f8c9b4e8db4f2a13d67a0c5e2.txt',
    includeIndexNowUrl: (url) => url.startsWith('https://column.taeandkyu.com/'),
    requiredUrls: [],
  },
  {
    id: 'main',
    siteUrl: 'https://taeandkyu.com/',
    sitemapUrl: 'https://taeandkyu.com/sitemap.xml',
    indexNowKey: '1c271ef7c79c4a3abc5b43a40dc1e3b8',
    indexNowKeyLocation: 'https://taeandkyu.com/1c271ef7c79c4a3abc5b43a40dc1e3b8.txt',
    includeIndexNowUrl: (url) => url === mainPageUrl,
    requiredUrls: [mainPageUrl],
  },
];

const emptyState = () => ({ version: 1, indexNow: {}, googleSitemaps: {} });

function loadState() {
  if (!existsSync(stateFile)) return emptyState();
  try {
    const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
    return {
      version: 1,
      indexNow: saved.indexNow || {},
      googleSitemaps: saved.googleSitemaps || {},
    };
  } catch (error) {
    throw new Error(`Submission state is invalid: ${error.message}`);
  }
}

function saveState(state) {
  mkdirSync(dirname(stateFile), { recursive: true });
  const next = `${JSON.stringify(state, null, 2)}\n`;
  const previous = existsSync(stateFile) ? readFileSync(stateFile, 'utf8') : '';
  if (previous !== next) writeFileSync(stateFile, next, 'utf8');
}

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeXml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const block = match[1];
    const url = decodeXml((block.match(/<loc>([^<]+)<\/loc>/) || [])[1]?.trim() || '');
    const lastmod = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1]?.trim() || '';
    return { url, version: lastmod || createHash('sha256').update(block).digest('hex') };
  }).filter((item) => item.url);
}

async function fetchTarget(target) {
  const response = await fetch(`${target.sitemapUrl}?submit=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${target.id} sitemap fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const entries = parseSitemap(xml);
  const urls = new Set(entries.map((entry) => entry.url));
  for (const requiredUrl of target.requiredUrls) {
    if (!urls.has(requiredUrl)) throw new Error(`${target.id} sitemap is missing ${requiredUrl}`);
  }

  return { ...target, xml, entries };
}

async function validateMainPage() {
  const response = await fetch(`${mainPageUrl}?submit-check=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`page30 live check failed: ${response.status} ${response.statusText}`);
  const html = await response.text();
  if (!html.includes(`<link rel="canonical" href="${mainPageUrl}">`)) {
    throw new Error('page30 canonical check failed.');
  }
  if (/name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)) {
    throw new Error('page30 is marked noindex.');
  }
}

async function verifyIndexNowKey(target) {
  const response = await fetch(`${target.indexNowKeyLocation}?verify=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return false;
  return (await response.text()).trim() === target.indexNowKey;
}

async function submitIndexNow(target, state) {
  const changedEntries = target.entries.filter((entry) => (
    target.includeIndexNowUrl(entry.url) && state.indexNow[entry.url] !== entry.version
  ));

  if (changedEntries.length === 0) {
    console.log(`Naver IndexNow ${target.id}: no changed URLs, skipped.`);
    return;
  }

  if (!dryRun && !(await verifyIndexNowKey(target))) {
    console.log(`::warning::Naver IndexNow ${target.id}: upload ${target.indexNowKeyLocation} first; ${changedEntries.length} URL(s) remain pending.`);
    return;
  }

  if (dryRun) {
    console.log(`Naver IndexNow ${target.id}: dry run (${changedEntries.length} URL(s))`);
    for (const entry of changedEntries) state.indexNow[entry.url] = entry.version;
    return;
  }

  const response = await fetch('https://searchadvisor.naver.com/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(target.siteUrl).host,
      key: target.indexNowKey,
      keyLocation: target.indexNowKeyLocation,
      urlList: changedEntries.map((entry) => entry.url),
    }),
  });

  console.log(`Naver IndexNow ${target.id}: ${response.status} ${response.statusText} (${changedEntries.length} URL(s))`);
  if (!response.ok && response.status !== 202) {
    throw new Error((await response.text()) || `IndexNow submission failed: ${response.status}`);
  }

  for (const entry of changedEntries) state.indexNow[entry.url] = entry.version;
}

async function createGoogleAccessToken() {
  const rawJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    console.log('::warning::Google Search Console: GSC_SERVICE_ACCOUNT_JSON secret is missing; sitemap submission is pending.');
    return null;
  }

  const credentials = JSON.parse(rawJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters',
    aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(claim.aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function listGoogleProperties(token) {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google property list error: ${JSON.stringify(data)}`);
  return (data.siteEntry || []).map((entry) => entry.siteUrl);
}

function findGoogleProperty(properties, siteUrl) {
  if (properties.includes(siteUrl)) return siteUrl;
  const host = new URL(siteUrl).hostname;
  return properties.find((property) => {
    if (!property.startsWith('sc-domain:')) return false;
    const domain = property.slice('sc-domain:'.length);
    return host === domain || host.endsWith(`.${domain}`);
  }) || null;
}

async function submitGoogleSitemaps(targetsWithSitemaps, state) {
  if (dryRun) {
    for (const target of targetsWithSitemaps) {
      const stateKey = `dry-run:${target.id}|${target.sitemapUrl}`;
      const sitemapVersion = createHash('sha256').update(target.xml).digest('hex');
      if (state.googleSitemaps[stateKey] === sitemapVersion) {
        console.log(`Google sitemap ${target.id}: unchanged, skipped.`);
      } else {
        state.googleSitemaps[stateKey] = sitemapVersion;
        console.log(`Google sitemap ${target.id}: dry run`);
      }
    }
    return;
  }

  const token = await createGoogleAccessToken();
  if (!token) return;
  const properties = await listGoogleProperties(token);

  for (const target of targetsWithSitemaps) {
    const property = findGoogleProperty(properties, target.siteUrl);
    if (!property) {
      console.log(`::warning::Google Search Console: add the service-account email as a full user of ${target.siteUrl}; ${target.sitemapUrl} remains pending.`);
      continue;
    }

    const stateKey = `${property}|${target.sitemapUrl}`;
    const sitemapVersion = createHash('sha256').update(target.xml).digest('hex');
    if (state.googleSitemaps[stateKey] === sitemapVersion) {
      console.log(`Google sitemap ${target.id}: unchanged, skipped.`);
      continue;
    }

    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(target.sitemapUrl)}`;
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    });

    console.log(`Google sitemap ${target.id}: ${response.status} ${response.statusText}`);
    if (!response.ok && response.status !== 204) {
      throw new Error((await response.text()) || `Google sitemap submission failed: ${response.status}`);
    }
    state.googleSitemaps[stateKey] = sitemapVersion;
  }
}

const state = loadState();
const errors = [];
const targetsWithSitemaps = [];

try {
  await validateMainPage();
  for (const target of targets) targetsWithSitemaps.push(await fetchTarget(target));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

for (const target of targetsWithSitemaps) {
  try {
    await submitIndexNow(target, state);
  } catch (error) {
    errors.push(`${target.id} IndexNow: ${error.message}`);
  }
}

try {
  await submitGoogleSitemaps(targetsWithSitemaps, state);
} catch (error) {
  errors.push(`Google Search Console: ${error.message}`);
}

saveState(state);

if (errors.length > 0) {
  console.error(`Search-engine submission completed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Search-engine submission completed.');
