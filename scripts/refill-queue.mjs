/**
 * column.taeandkyu.com — 예약 큐 자동 보충
 *
 *   node scripts/refill-queue.mjs             큐가 THRESHOLD 미만이면 TARGET 까지 채운다
 *   node scripts/refill-queue.mjs --force 3   3건만 생성
 *   node scripts/refill-queue.mjs --check     현재 큐 상태만 출력
 *   node scripts/refill-queue.mjs --git       커밋·푸시까지
 *
 * content/queue/<slug>.json (초안 + publishAt) 을 채운다.
 * 발행은 publish-queue.yml 이 매일 00:10 KST 에 하루 1건씩 하고, 그때 render·seo-audit 을 돌린다.
 * 여기서는 초안을 만들고 renderArticle 로 미리 렌더·자체검증해 통과한 것만 큐에 넣는다.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderArticle } from './author/render-article.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, 'content', 'queue');
const DRAFTS = path.join(ROOT, 'content', 'drafts');
const BLOG = path.join(ROOT, 'blog');
const LOG = path.join(ROOT, 'refill.log');
const LOCK = path.join(ROOT, '.refill.lock');
const DESK = path.join(process.env.USERPROFILE || '', 'Desktop', '태앤규칼럼_보충_실패.txt');

const THRESHOLD = 6;    // 큐가 이 미만이면 채운다
const TARGET = 12;      // 목표(약 12일치)
const MAX_ADD = 12;
const RETRY = 2;
const BATCH_TIMEOUT = 30 * 60 * 1000;
const CATS = ['criminal', 'divorce', 'civil'];

/**
 * 분야별 타깃 키워드 풀.
 *
 * 예전에는 분야마다 키워드가 하나씩 고정이라, 159편을 써도 노리는 검색어가 셋뿐이었다.
 * 네이버·구글 웹사이트 영역은 "지역+분야+변호사" 형태로 잘게 갈린 검색어에서 자리가 난다.
 * 그래서 지역(전주·익산)과 세부 분야(성범죄 등)로 풀을 넓히고, 글마다 돌려 가며 배정한다.
 * 한 글에 여러 키워드를 욱여넣지 않는다 — 글 하나당 키워드 하나가 원칙이다.
 *
 * 주의: "전문변호사" 는 대한변호사협회에 그 분야로 전문 등록을 한 경우에만 자칭할 수 있다.
 * 형사는 기존부터 써 오던 표기라 그대로 두되, 등록하지 않은 분야는 자칭하지 않는다.
 * 등록이 없는 분야의 "전문" 검색어는 KEYWORD_INFORMATIONAL 로 따로 다룬다(자칭 대신 안내 각도).
 */
// 괄호 안은 네이버 검색광고 API 실측 월간 검색수(2026-09-19).
// 주변 지역은 분야를 붙이면 검색이 사라진다 — 익산변호사는 330회인데 익산형사변호사는 10회 미만이다.
// 그래서 전주만 분야를 쪼개고, 익산·군산·정읍·남원은 분야 없는 일반 키워드로 잡는다.
/**
 * 전문 등록 분야는 **형사·노동법·이혼·부동산** 네 가지다(2026-09-19 확인).
 * 이 넷은 "○○전문변호사" 로 자칭할 수 있다. 그 외 분야는 전문 표기를 붙이지 않는다.
 *
 * 노동은 따로 분야를 만들지 않고 civil 에 넣는다. 임금체불·퇴직금 청구가 실제로 민사소송이고,
 * 분야를 늘리면 렌더러 이미지·분야 페이지·검수까지 같이 고쳐야 해서 매일 발행이 멈출 위험이 있다.
 */
const KEYWORD = {
  criminal: [
    '전주형사전문변호사',   // 610 · 전문 등록 O
    '전주형사변호사',       // 360
    '전주성범죄변호사',     // 330
    '익산변호사',           // 330 (분야 무관 — 익산 사건 전반을 다룬다)
    '전주학교폭력변호사',   // 60 + 전주학폭변호사 60
  ],
  divorce: [
    '전주이혼전문변호사',   // 690 · 전문 등록 O — 전주 분야 중 검색이 가장 크다
    '전주이혼변호사',       // 550
    '군산변호사',           // 480 (분야 무관 — 군산 사건 전반)
    '군산이혼전문변호사',   // 80 · 전문 등록 O
    '군산이혼변호사',       // 80
  ],
  civil: [
    '노동전문변호사',       // 410 · 전문 등록 O · **노출광고 0개** — 정보성이라 가장 잡기 쉽다
    '전주부동산전문변호사', // 230 · 전문 등록 O
    '전주부동산변호사',     // 210
    '전주민사변호사',       // 180
    '노동법변호사',         // 150
    '정읍변호사',           // 80
    '전주상속변호사',       // 75
    '전주교통사고변호사',   // 60 · '전주교통사고' 단독은 1,330
  ],
};

/**
 * 자칭하면 안 되지만 검색 수요는 있는 키워드.
 * 제목에 "○○전문변호사, ~" 처럼 붙이지 말고, 그 표현을 찾는 사람에게 설명하는 각도로 쓴다.
 * (예: "이혼 전문 변호사를 고를 때 무엇을 확인해야 하나")
 */
// 전문 등록이 없는 분야는 여기에 적어 자칭 대신 안내 각도로 다룬다.
// 지금은 네 분야(형사·노동법·이혼·부동산)가 모두 등록돼 있어 비어 있다.
const KEYWORD_INFORMATIONAL = {};

/**
 * 주변 지역 키워드(익산변호사·군산변호사·정읍변호사)는 분야가 없다.
 * 그 지역 사람이 "우리 동네 변호사"를 찾는 검색이므로, 글도 그렇게 써야 한다.
 * 분야 주제를 그대로 쓰면서 지역명만 바꾸면 검색 의도와 어긋나 순위가 안 난다.
 */
const REGION_ONLY = new Set(['익산변호사', '군산변호사', '정읍변호사', '남원변호사']);

const CLAUDE = [
  'C:\\Users\\c\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\\claude.exe',
  'claude',
].find((p) => p === 'claude' || fs.existsSync(p));

const BANNED = ['승소율', '무죄를 보장', '반드시 무죄', '100%', '확실히 승소', '무조건'];

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function log(m) { const l = `[${stamp()}] ${m}`; console.log(l); try { fs.appendFileSync(LOG, l + '\n'); } catch { } }
const unlock = () => { try { fs.rmSync(LOCK); } catch { } };
function fail(m, d = '') {
  log('!! ' + m); if (d) log(String(d).slice(0, 700));
  try { fs.writeFileSync(DESK, `${stamp()}\ncolumn.taeandkyu.com 큐 보충 실패\n\n${m}\n\n${String(d).slice(0, 1200)}\n\n확인: node scripts/refill-queue.mjs --check\n`); } catch { }
  unlock(); process.exit(1);
}
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { } };
const len = (s) => [...String(s || '')].length;
const textOf = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const blogSlugs = () => new Set(fs.readdirSync(BLOG).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')));
const queueItems = () => (fs.existsSync(QUEUE) ? fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json')) : []);

/* ---------- 검사 ---------- */
function validate(slug, known) {
  const f = path.join(QUEUE, `${slug}.json`);
  if (!fs.existsSync(f)) return [`${slug}.json 없음`];
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return [`${slug} JSON 오류: ${e.message}`]; }
  const e = [];
  for (const k of ['category', 'slug', 'keyword', 'title', 'description', 'lead', 'bodyHtml', 'faqs', 'related', 'publishAt']) {
    if (d[k] === undefined || d[k] === '' || d[k] === null) e.push(`${k} 없음`);
  }
  if (e.length) return e.map((x) => `${slug}: ${x}`);
  if (d.slug !== slug) e.push('slug 불일치');
  if (!CATS.includes(d.category)) e.push(`category "${d.category}"`);
  if (len(d.title) > 50) e.push(`title 50자 초과(${len(d.title)})`);
  const desc = len(d.description);
  if (desc < 45 || desc > 160) e.push(`description ${desc}자(45~160)`);
  if (!Array.isArray(d.faqs) || d.faqs.length < 3) e.push('faqs 3개 미만');
  if (!Array.isArray(d.related) || d.related.length < 2) e.push('related 2개 미만');
  const bt = len(textOf(d.bodyHtml));
  if (bt < 2000) e.push(`본문 ${bt}자(최소 2000)`);
  const h2 = (String(d.bodyHtml).match(/<h2/g) || []).length;
  if (h2 < 4) e.push(`h2 ${h2}개(최소 4)`);
  if (!/class=['"]?(infographic|table-wrap|callout|warning)/.test(d.bodyHtml)) e.push('비주얼 블록 없음');
  for (const w of BANNED) if (String(d.bodyHtml).includes(w) || String(d.title).includes(w)) e.push(`금지표현: ${w}`);
  if (known.titles.has(d.title)) e.push('제목 중복');
  // related 실존
  for (const r of d.related || []) {
    const href = String(r.href || '');
    const m = href.match(/^\/blog\/(.+?)\/?$/);
    if (!m) { e.push(`related href 형식: ${href}`); continue; }
    if (!known.blog.has(m[1]) && !known.newSlugs.has(m[1])) e.push(`related 없는 글: ${href}`);
  }
  // renderArticle 이 예외 없이 되는지
  try { renderArticle(d); } catch (err) { e.push(`renderArticle 실패: ${err.message}`); }
  return e.map((x) => `${slug}: ${x}`);
}

/* ---------- 프롬프트 ---------- */
function prompt(batch, known) {
  const recent = [...known.titles].slice(-40).map((t) => `- ${t}`).join('\n');
  const rows = batch.map((b) => `- category: ${b.category} / keyword: ${b.keyword}${REGION_ONLY.has(b.keyword) ? ' (지역형: 분야를 좁히지 말고 그 지역에서 사건을 맡길 때 확인할 것을 쓴다)' : ''} / date(publishAt): ${b.publishAt} / slug 접두사: ${b.category}-`).join('\n');
  const relatable = [...known.blog].slice(-30).map((s) => `/blog/${s}`).join('\n');
  return `너는 법무법인 태앤규(전주)의 칼럼을 쓴다. column.taeandkyu.com 예약 큐에 ${batch.length}건을 채운다.

## 먼저 읽을 것
- AUTHORING.md — 특히 "★ 품질 상향 기준" 과 초안 JSON 형식, 비주얼 스니펫 예시
- content/topic-bank.json — 분야별 주제 후보. blog/ 에 이미 있는 주제는 피한다.

## 이번에 쓸 초안 (각 줄이 파일 하나: content/queue/<slug>.json)
${rows}

## 형식 (초안 JSON + publishAt 한 줄)
{ "category": "...", "slug": "<category>-...", "keyword": "<위 keyword>", "date": "<publishAt 과 동일>",
  "title": "50자 이하", "description": "45~160자", "lead": "결론부터 한두 문장",
  "bodyHtml": "<p>..</p><h2>..</h2>..", "faqs":[{"q","a"}x3], "related":[{"href":"/blog/<실제 슬러그>","label"}x2], "publishAt": "<위 date>" }

## 품질(발행일 seo-audit 을 반드시 통과해야 하니 미리 지킨다)
- 본문 텍스트 2,400~3,000자. <h2> 5~6개(질문형, 첫 문단은 요지부터).
- 비주얼 2종 이상을 bodyHtml 에 반드시 넣는다. 아래 형태 그대로(class 이름 유지):
  · 강조: <div class="callout"><span class="label">핵심</span><p>내용</p></div>
  · 주의: <div class="warning"><span class="label">주의</span><p>내용</p></div>
  · 표:   <div class="table-wrap"><table>...</table></div>
  · 인포그래픽: <div class="infographic">...</div> (svg 속성만 홑따옴표, class 는 큰따옴표)
- 도입부는 상담에서 겪는 구체적 장면 하나로 연다. 짧은 문단(1~2문장), 모바일 가독성 우선.
- keyword 를 본문에 자연스럽게 4~8회. 결과 보장·승소율·단정 표현 금지.
- **keyword 의 지역을 실제로 다룬다.** 익산 키워드면 전주 이야기만 쓰지 말고, 익산에서 사건이
  어디로 가는지(관할 법원·검찰청, 이동 동선, 조사 일정 잡는 법)를 구체적으로 적는다.
  지역명만 제목에 붙이고 본문은 똑같은 일반론이면 검색엔진이 대량생성으로 보고 걸러낸다.
  · 전주 → 전주지방법원 / 전주지방검찰청
  · 익산 → 전주지방법원 군산지원 / 전주지방검찰청 군산지청 (익산은 군산지원 관할이다)
- **"전문변호사" 표기는 등록 분야에만 쓴다.** 법무법인 태앤규(김기태 변호사)는 대한변호사협회에
  **형사·노동법·이혼·부동산** 네 분야로 전문 등록이 되어 있다. keyword 에 그 표현이 들어 있으면
  제목에 그대로 쓰면 된다. 등록되지 않은 분야(상속·교통사고·학교폭력 등)에는 절대 붙이지 않는다.
- **노동 사건 글**(keyword 가 노동전문변호사·노동법변호사)은 civil 로 분류하되, 내용은 노동이다.
  임금체불·퇴직금·해고를 다룬다. 다음 구분을 정확히 지킨다 — 틀리면 신뢰를 잃는다.
  · 임금·퇴직금 청구 → 민사소송(법원). 노동청 진정과 병행할 수 있다.
  · 부당해고 구제 → 지방노동위원회(법원 아님). 해고일로부터 3개월 안에 신청해야 한다.
  · 산업재해 → 근로복지공단. 요양·휴업급여 신청이 먼저다.
- related 는 아래 "실제 존재하는 글" 에서만 고른다(깨진 링크 금지):
${relatable}
- slug 은 영문 소문자·하이픈, category 접두사 필수, 날짜 붙이지 말 것. 기존과 중복 금지.

## 기존 제목(주제·표현 겹치지 않게)
${recent}

## 하지 말 것
- render/git/seo-audit 등 명령 실행 금지. content/queue 의 JSON 만 쓴다.
- 기존 파일 수정 금지.

다 쓰면 파일명만 한 줄씩 출력하고 끝내라.`;
}

function runClaude(text) {
  for (let t = 1; t <= 3; t += 1) {
    const res = spawnSync(CLAUDE, ['-p', text, '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Write,Glob,Grep'],
      { cwd: ROOT, encoding: 'utf8', timeout: BATCH_TIMEOUT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    if (!res.error && res.status === 0) return res;
    const why = String(res.stderr || res.stdout || res.error?.message || '').trim().slice(-300);
    log(`  !! claude 호출 실패 (${res.status ?? 'error'}) ${t}/3 — ${why}`);
    if (t < 3) { log('  60초 쉬었다가 다시'); sleep(60000); }
  }
  return null;
}

/* ---------- 본체 ---------- */
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const GIT = argv.includes('--git');
const fi = argv.indexOf('--force');
const FORCE = fi >= 0 ? Math.max(1, Math.min(MAX_ADD, Number(argv[fi + 1]) || 1)) : 0;

const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

fs.mkdirSync(QUEUE, { recursive: true });
fs.mkdirSync(DRAFTS, { recursive: true });

// 원격을 세기 전에 먼저 반영한다.
// 예전에는 큐를 센 뒤 "보충 불필요"로 조기 종료한 다음에야 당겨왔다. 그래서 보충이 필요 없는
// 날에는 로컬이 영영 뒤처지고, publish-queue 가 매일 원격에서 한 편씩 빼가는데도 로컬 큐 개수는
// 그대로라 기준 미만으로 내려가질 않았다. 실제 큐가 0이 될 때까지 보충이 한 번도 안 돈다.
if (GIT) {
  try { git(['fetch', 'origin', 'main']); git(['merge', '--ff-only', 'origin/main']); log('원격 반영'); }
  catch (e) { fail('원격과 갈라짐', String(e.stdout || e.message)); }
}

let qn = queueItems().length;
log(`─── 큐 점검 (KST ${TODAY}) ─── 큐 ${qn}편 · 발행글 ${blogSlugs().size}편`);
if (CHECK) {
  queueItems().sort().forEach((f) => { const d = JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')); console.log(`  ${d.publishAt}  ${d.category}  ${d.title}`); });
  process.exit(0);
}

let need = FORCE || (qn < THRESHOLD ? Math.min(MAX_ADD, TARGET - qn) : 0);
if (need <= 0) { log(`큐 ${qn}편 — 보충 불필요(기준 ${THRESHOLD})`); process.exit(0); }

if (fs.existsSync(LOCK)) { if (Date.now() - fs.statSync(LOCK).mtimeMs < BATCH_TIMEOUT * 2) { log('이미 실행 중'); process.exit(0); } unlock(); }
fs.writeFileSync(LOCK, stamp());

// 마지막 예약일 다음부터 하루 1건, category 순환
const existAt = queueItems().map((f) => JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')).publishAt).sort();
let base = existAt.length ? existAt[existAt.length - 1] : addDays(TODAY, -1);
const known = { blog: blogSlugs(), titles: new Set(), newSlugs: new Set() };
[...blogSlugs()].forEach(() => {}); // titles 는 blog 제목을 모르므로 큐/생성분만 비교
queueItems().forEach((f) => { try { known.titles.add(JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')).title); } catch {} });

/**
 * 이미 쓴 키워드를 세어 가장 적게 쓴 것부터 배정한다.
 * 순서대로만 돌리면 새로 넣은 키워드가 맨 뒤로 밀려 몇 주 동안 한 편도 안 나온다.
 */
function keywordUsage() {
  const used = new Map();
  const bump = (k) => { if (k) used.set(k, (used.get(k) ?? 0) + 1); };
  for (const dir of [DRAFTS, QUEUE]) {
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { }
    for (const f of files) {
      try { bump(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).keyword); } catch { }
    }
  }
  return used;
}

const usage = keywordUsage();
const pickKeyword = (cat) => {
  const pool = KEYWORD[cat];
  let best = pool[0];
  for (const k of pool) if ((usage.get(k) ?? 0) < (usage.get(best) ?? 0)) best = k;
  usage.set(best, (usage.get(best) ?? 0) + 1);   // 같은 배치 안에서도 겹치지 않게
  return best;
};

const batch = [];
for (let i = 0; i < need; i += 1) {
  const publishAt = addDays(base, i + 1);
  const category = CATS[i % 3];
  batch.push({ category, keyword: pickKeyword(category), publishAt });
}
log('배정 키워드: ' + batch.map((b) => b.keyword).join(', '));
log(`${need}건 보충 시작 → ${batch[0].publishAt} ~ ${batch[batch.length - 1].publishAt}`);

const written = [];
// 한 번에 3건씩(하루치 category 3개 형태로) claude 호출
for (let i = 0; i < batch.length; i += 3) {
  const group = batch.slice(i, i + 3);
  let ok = false;
  for (let attempt = 0; attempt <= RETRY; attempt += 1) {
    if (attempt) log(`  재작성 ${attempt}회차`);
    const before = new Set(queueItems());
    if (!runClaude(prompt(group, known))) fail('claude 세 번 실패(사용량 한도로 보임)', `여기까지 ${written.length}건 반영`);
    const added = queueItems().filter((f) => !before.has(f));
    if (!added.length) { log('  !! 새 파일 없음'); continue; }
    added.forEach((f) => known.newSlugs.add(f.replace(/\.json$/, '')));
    const errs = added.flatMap((f) => validate(f.replace(/\.json$/, ''), known));
    if (!errs.length) { added.forEach((f) => { known.titles.add(JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8')).title); written.push(f.replace(/\.json$/, '')); }); ok = true; break; }
    log('  !! 규격 불통과: ' + errs.slice(0, 4).join(' / '));
    added.forEach((f) => { try { fs.rmSync(path.join(QUEUE, f)); known.newSlugs.delete(f.replace(/\.json$/, '')); } catch {} });
  }
  if (!ok) fail('규격을 통과하지 못했습니다', `여기까지 ${written.length}건 반영`);
  try { fs.writeFileSync(LOCK, stamp()); } catch {}
  log(`  통과 ${group.length}건 — 누적 ${written.length}`);
}

log(`─── 보충 완료 · ${written.length}건 ───`);
written.forEach((s) => log(`   ${s}`));

if (GIT && written.length) {
  try {
    git(['add', 'content/queue']);
    git(['-c', 'user.name=publish-bot', '-c', 'user.email=bot@auto.local', 'commit', '-m', `큐 보충: 예약 칼럼 ${written.length}건`]);
    git(['push', 'origin', 'main']);
    log('GitHub 푸시 완료 — publish-queue 가 매일 1건 발행');
  } catch (e) { fail('푸시 실패(큐는 로컬에 있음)', String(e.stdout || e.message)); }
}
try { if (fs.existsSync(DESK)) fs.rmSync(DESK); } catch {}
unlock();
