/**
 * Search Console 성과 조회 — 어떤 검색어가 몇 위에 걸려 있는지 본다.
 *
 * 색인 점검(gsc-diagnose)은 "구글이 이 페이지를 아느냐" 를 본다.
 * 색인은 이미 건강한데 유입이 적다면 병목은 색인이 아니라 **순위**다.
 * 그 둘은 손쓰는 방법이 다르다 — 색인은 링크와 사이트맵, 순위는 내용과 의도다.
 *
 * 특히 11~30위 구간을 따로 뽑는다. 이 구간은 이미 구글이 "관련은 있다" 고 본 것이라
 * 글을 조금만 손봐도 1페이지로 올라오는 경우가 많다. 50위 밖은 글을 새로 써야 한다.
 *
 * 환경변수
 *   GSC_SERVICE_ACCOUNT_JSON  서비스 계정 키 전문
 *   GSC_SITES                 쉼표로 구분한 속성 목록
 *   GSC_DAYS                  조회 기간(기본 28일)
 */
import { createSign } from 'node:crypto';

const sites = (process.env.GSC_SITES || 'https://column.taeandkyu.com/')
  .split(',').map((v) => v.trim()).filter(Boolean);
const DAYS = Number(process.env.GSC_DAYS || 28);

const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON || '{}');
if (!sa.client_email) { console.error('GSC_SERVICE_ACCOUNT_JSON 이 없습니다'); process.exit(1); }

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  };
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 실패: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 86400000);          // 구글 데이터는 2일 정도 늦는다
const start = new Date(end.getTime() - DAYS * 86400000);

const tk = await token();

for (const site of sites) {
  console.log(`\n===== ${site}  (${iso(start)} ~ ${iso(end)}) =====`);
  const call = async (dimensions, rowLimit = 200) => {
    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' },
        body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions, rowLimit }),
      });
    if (!r.ok) { console.log(`  조회 실패 ${r.status} ${(await r.text()).slice(0, 160)}`); return []; }
    return (await r.json()).rows || [];
  };

  const total = await call([]);
  if (total.length) {
    const t = total[0];
    console.log(`  합계  노출 ${t.impressions.toLocaleString()}  클릭 ${t.clicks.toLocaleString()}  평균순위 ${t.position.toFixed(1)}`);
  } else {
    console.log('  데이터 없음 (속성 권한이나 기간을 확인하세요)');
    continue;
  }

  const q = await call(['query'], 500);
  const sorted = [...q].sort((a, b) => b.impressions - a.impressions);

  console.log('\n  — 노출 많은 검색어 10개 —');
  sorted.slice(0, 10).forEach((r) => console.log(
    `    ${String(Math.round(r.impressions)).padStart(5)}회  ${r.position.toFixed(1).padStart(5)}위  클릭 ${String(r.clicks).padStart(3)}  ${r.keys[0]}`));

  // 11~30위: 조금만 손봐도 1페이지로 올라올 수 있는 구간
  const near = sorted.filter((r) => r.position > 10 && r.position <= 30 && r.impressions >= 5);
  console.log(`\n  — 1페이지 문턱(11~30위) ${near.length}개 —`);
  near.slice(0, 15).forEach((r) => console.log(
    `    ${String(Math.round(r.impressions)).padStart(5)}회  ${r.position.toFixed(1).padStart(5)}위  ${r.keys[0]}`));

  // 노출은 큰데 클릭이 없는 것 = 제목·설명이 안 먹히는 자리
  const noClick = sorted.filter((r) => r.impressions >= 20 && r.clicks === 0 && r.position <= 20);
  if (noClick.length) {
    console.log(`\n  — 노출 20회 이상인데 클릭 0 (제목·설명 문제) ${noClick.length}개 —`);
    noClick.slice(0, 8).forEach((r) => console.log(
      `    ${String(Math.round(r.impressions)).padStart(5)}회  ${r.position.toFixed(1).padStart(5)}위  ${r.keys[0]}`));
  }
}

/*
 * 순위는 높은데 클릭이 0인 검색어는 "어느 페이지가 걸렸는지" 를 봐야 한다.
 *
 * 변호사를 찾는 검색어에 칼럼이 걸리면 사람들은 안 누른다.
 * 그 자리에는 사무실 소개나 분야 안내 페이지가 걸려야 한다.
 * 제목을 고칠 문제인지, 걸리는 페이지 자체를 바꿀 문제인지는 이걸 봐야 갈린다.
 */
for (const site of sites) {
  const r = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        startDate: iso(start), endDate: iso(end),
        dimensions: ['query', 'page'], rowLimit: 500,
      }),
    });
  if (!r.ok) continue;
  const rows = (await r.json()).rows || [];
  const hot = rows.filter((x) => x.impressions >= 10 && x.clicks === 0 && x.position <= 10)
    .sort((a, b) => b.impressions - a.impressions);
  if (!hot.length) continue;
  console.log(`\n===== ${site} — 1페이지인데 클릭 0 =====`);
  hot.slice(0, 12).forEach((x) => console.log(
    `  ${String(Math.round(x.impressions)).padStart(4)}회 ${x.position.toFixed(1).padStart(5)}위  ${x.keys[0]}\n        ${decodeURIComponent(x.keys[1]).replace(/^https?:\/\/[^/]+/, '')}`));
}
