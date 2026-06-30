import { createSign } from 'node:crypto';

const siteUrl = 'https://column.taeandkyu.com/';
const sitemapUrl = 'https://column.taeandkyu.com/sitemap.xml';
const indexNowKey = '91a7460f8c9b4e8db4f2a13d67a0c5e2';

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function submitIndexNow() {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      host: new URL(siteUrl).host,
      key: indexNowKey,
      keyLocation: `${siteUrl}${indexNowKey}.txt`,
      urlList: [sitemapUrl],
    }),
  });

  console.log(`IndexNow ${new URL(siteUrl).host}: ${response.status} ${response.statusText}`);
  if (!response.ok && response.status !== 202) {
    throw new Error(await response.text());
  }
}

async function createGoogleAccessToken() {
  const rawJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    console.log('Google Search Console: GSC_SERVICE_ACCOUNT_JSON secret is missing, skipped.');
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
  if (!response.ok) {
    throw new Error(`Google token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function submitGoogleSitemap() {
  const token = await createGoogleAccessToken();
  if (!token) return;

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });

  console.log(`Google sitemap ${sitemapUrl}: ${response.status} ${response.statusText}`);
  if (!response.ok && response.status !== 204) {
    throw new Error(await response.text());
  }
}

await submitIndexNow();
await submitGoogleSitemap();
