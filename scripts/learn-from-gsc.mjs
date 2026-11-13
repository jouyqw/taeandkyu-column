/**
 * 무엇이 실제로 올라가는지 GSC 에 물어본다 — 그리고 그 답을 글쓰기 기준으로 되돌린다.
 *
 *   GSC_SITES=... node scripts/learn-from-gsc.mjs
 *
 * 왜 만드나
 *   지금까지 글쓰기 기준은 전부 "이렇게 하면 잘 될 것이다" 였다. 근거가 내 짐작이다.
 *   그런데 어느 글이 올라갔는지는 GSC 가 이미 알고 있다. 올라간 글과 안 올라간 글의
 *   **차이**를 세어 보면 다음 글에 무엇을 넣어야 하는지가 나온다.
 *
 * 어떻게 세나
 *   1) GSC 에서 page 단위 노출·순위를 받는다.
 *   2) 그 주소에 해당하는 글을 열어 특징을 뽑는다
 *      (제목에 붙여 쓴 지역 키워드가 있는지, 표·FAQ·목록이 있는지, 분량, 소제목 수,
 *       첫 문단이 답부터 시작하는지, 내부링크 수 …).
 *   3) 특징이 있는 글과 없는 글의 **노출 중앙값**을 비교한다.
 *
 *   평균이 아니라 중앙값으로 본다. 노출은 한두 편에 쏠려서 평균을 쓰면
 *   그 한 편이 전체 결론을 끌고 간다.
 *
 * 읽는 법
 *   표본이 적으면 숫자가 흔들린다. 그래서 각 줄에 **글 수**를 같이 찍는다.
 *   한쪽이 10편 미만이면 참고만 하고 기준을 바꾸지 않는다.
 *   데이터는 쌓일수록 정확해진다 — 매달 한 번 돌려 보는 용도다.
 *
 * GEO(AI 검색) 쪽
 *   AI 가 인용하는 형태(FAQ, 소제목 바로 뒤 결론 문단)를 따로 센다.
 *   지금은 GSC 가 AI 인용을 따로 주지 않으므로 노출로 간접 확인한다.
 */
import { createSign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.GSC_SITES || 'https://column.taeandkyu.com/';
const DAYS = Number(process.env.GSC_DAYS || 90);
// 글 파일이 있는 폴더와 주소 접두사. 다른 저장소로 복사해 쓸 때 환경변수로 바꾼다.
// 이 도구는 **자기 저장소의 글만** 읽을 수 있다 — 울산 사이트를 여기서 돌리면
// 주소는 169개 나오는데 파일이 없어 0편으로 끝난다(2026-11-13 실제로 그랬다).
const BLOG = path.join(ROOT, process.env.ARTICLE_DIR || 'blog');
const URL_PREFIX = process.env.ARTICLE_URL_PREFIX || '/blog/';

const sa = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON || '{}');
if (!sa.private_key) { console.error('GSC_SERVICE_ACCOUNT_JSON 이 없습니다'); process.exit(1); }

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sig}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 실패: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 86400000);
const start = new Date(end.getTime() - DAYS * 86400000);

const access = await token();
const res = await fetch(
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
  {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions: ['page'], rowLimit: 1000 }),
  },
);
const data = await res.json();
if (!res.ok) { console.error(`조회 실패 ${res.status}: ${JSON.stringify(data).slice(0, 300)}`); process.exit(1); }

const rows = data.rows || [];
console.log(`${SITE}  (${iso(start)} ~ ${iso(end)}, ${DAYS}일)`);
console.log(`노출이 잡힌 주소 ${rows.length}개\n`);

/** 주소 → 글 파일 */
const slugOf = (url) => decodeURIComponent(url)
  .replace(/^https?:\/\/[^/]+/, '')
  .replace(URL_PREFIX, '')
  .replace(/\/$/, '');
const stats = new Map();
for (const r of rows) {
  const s = slugOf(r.keys[0]);
  const f = path.join(BLOG, `${s}.html`);
  if (!fs.existsSync(f)) continue;
  stats.set(s, { impressions: r.impressions, clicks: r.clicks, position: r.position });
}

/** 글 하나에서 특징을 뽑는다 */
function features(slug) {
  const h = fs.readFileSync(path.join(BLOG, `${slug}.html`), 'utf8');
  const title = (h.match(/<title>([^<]*)/) || [])[1] || '';
  const body = (h.match(/<article[\s\S]*?<\/article>/) || h.match(/<main[\s\S]*?<\/main>/) || [h])[0];
  const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

  // 소제목 바로 뒤 문단이 결론부터 시작하는가 — AI 가 인용할 때 그 한 문단만 떼어 간다.
  // "~입니다/됩니다/아닙니다" 로 끝나는 단정 문장이 첫 문장이면 결론부터로 본다.
  let answerFirst = 0;
  for (const m of body.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const first = m[1].replace(/<[^>]+>/g, '').trim().split(/(?<=[.!?。]|다\.)\s/)[0] || '';
    if (/(습니다|입니다|됩니다|아닙니다|합니다)\.?$/.test(first.trim())) answerFirst += 1;
  }

  return {
    chars: [...text].length,
    h2: h2s.length,
    // 제목이 "지역+분야변호사" 를 띄어쓰기 없이 들고 있는가
    titleKeyword: /(전주|익산|군산|김제|정읍|남원|완주)[가-힣]{0,6}변호사/.test(title),
    titleQuestion: /[?]|나요|까요|하나$|되나/.test(title),
    table: /<table/.test(body),
    faq: /<details|faq/i.test(body),
    list: /<ul[\s>]/.test(body),
    callout: /callout|warning|case-box|related-card/.test(body),
    answerFirstRatio: h2s.length ? answerFirst / h2s.length : 0,
    inLinks: new Set([...body.matchAll(/href="[^"]*\/blog\/([^"/]+)"/g)].map((m) => m[1])).size,
  };
}

const items = [...stats.entries()].map(([slug, s]) => ({ slug, ...s, f: features(slug) }));
if (items.length < 10) {
  console.log(`!! 분석할 글이 ${items.length}편뿐입니다. 노출이 더 쌓인 뒤에 다시 돌리세요.`);
  process.exit(0);
}

const median = (a) => {
  if (!a.length) return 0;
  const v = [...a].sort((x, y) => x - y);
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
};

/** 특징 있는 쪽과 없는 쪽의 노출 중앙값을 비교한다 */
function compare(label, pick) {
  const yes = items.filter((x) => pick(x.f));
  const no = items.filter((x) => !pick(x.f));
  if (!yes.length || !no.length) return null;
  const my = median(yes.map((x) => x.impressions));
  const mn = median(no.map((x) => x.impressions));
  const py = median(yes.map((x) => x.position));
  const pn = median(no.map((x) => x.position));
  const thin = yes.length < 10 || no.length < 10;
  return { label, yes: yes.length, no: no.length, my, mn, py, pn, thin, lift: mn ? my / mn : 0 };
}

const checks = [
  ['제목에 지역+변호사 (붙여 쓰기)', (f) => f.titleKeyword],
  ['제목이 질문형', (f) => f.titleQuestion],
  ['표가 있다', (f) => f.table],
  ['FAQ 가 있다', (f) => f.faq],
  ['강조 박스가 있다', (f) => f.callout],
  ['소제목 7개 이상', (f) => f.h2 >= 7],
  ['본문 2,500자 이상', (f) => f.chars >= 2500],
  ['소제목 뒤 결론부터 — 절반 이상', (f) => f.answerFirstRatio >= 0.5],
  ['글 안 내부링크 3개 이상', (f) => f.inLinks >= 3],
].map(([l, p]) => compare(l, p)).filter(Boolean)
  .sort((a, b) => b.lift - a.lift);

console.log('특징별 노출 중앙값 (있음 / 없음)\n');
for (const c of checks) {
  const mark = c.thin ? '· 표본적음' : '';
  const arrow = c.lift >= 1.5 ? '↑↑' : c.lift >= 1.15 ? '↑ ' : c.lift <= 0.85 ? '↓ ' : '  ';
  console.log(`${arrow} ${c.label.padEnd(28)} ${String(c.my).padStart(5)} / ${String(c.mn).padStart(5)}`
    + `  (${c.yes}편 / ${c.no}편)  순위 ${c.py.toFixed(1)} vs ${c.pn.toFixed(1)} ${mark}`);
}

console.log('\n노출 상위 10편 — 이 글들이 무엇을 하고 있는지 본다');
for (const x of [...items].sort((a, b) => b.impressions - a.impressions).slice(0, 10)) {
  const f = x.f;
  const tags = [f.table && '표', f.faq && 'FAQ', f.callout && '박스',
    f.titleKeyword && '제목키워드', f.titleQuestion && '질문형'].filter(Boolean).join('·');
  console.log(`  ${String(x.impressions).padStart(4)}회 ${x.position.toFixed(1).padStart(5)}위  `
    + `${f.chars}자 h2 ${f.h2} 결론부터 ${Math.round(f.answerFirstRatio * 100)}%  ${tags}`);
  console.log(`        ${x.slug}`);
}

console.log('\n※ 한쪽이 10편 미만이면 "표본적음" 이다. 그 줄로는 기준을 바꾸지 않는다.');
console.log('※ 노출은 쏠림이 커서 평균 대신 중앙값으로 봤다.');
