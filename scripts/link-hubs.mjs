/**
 * 분야 허브로 올려 보내는 링크를 모든 글에 넣는다.
 *
 *   node scripts/link-hubs.mjs            무엇이 바뀌는지만 본다
 *   node scripts/link-hubs.mjs --write    실제로 고친다
 *
 * 왜 하는가
 *   2026-11-07 GSC 28일치에서 전주 분야 검색어가 전부 홈(/)으로 올라오고 있었다.
 *     전주변호사상담 23회 7.4위 · 전주민사변호사 13회 2.8위 · 전주이혼변호사 7회 22.7위
 *   글이 215편인데 월 노출 500 — 글당 2.5회다. 글은 색인됐고 스키마도 붙어 있다.
 *
 *   원인은 분야를 받는 페이지가 없는 것이었다. 홈 한 장이 형사·이혼·민사 검색어를
 *   전부 받고 있어서 어느 분야에서도 깊이 들어가지 못한다.
 *
 *   홈에는 이미 "분야별 안내" 카드 셋이 있는데, 그게 허브 페이지가 아니라
 *   **글 세 편**을 가리키고 있었다. 그 셋을 진짜 허브로 쓰는 쪽이 낫다 —
 *   새 페이지를 만들면 이미 있는 그 셋과 같은 말로 경쟁한다.
 *
 *   그래서 같은 분야 글 전부가 자기 허브 글을 가리키게 한다.
 *   받는 링크가 몰리면 그 한 장이 분야 검색어를 받을 근거가 생긴다.
 *   (울산에서 /law-office/ 를 세워 '사무소 찾기' 일곱 개를 모은 것과 같은 수법인데,
 *    여기는 허브를 새로 만들 필요 없이 이미 있는 것을 쓴다.)
 *
 * 받는 링크 현황(2026-11-07 실측)
 *   0개 4편 · 1개 151편 · 2개 20편 · 3개 13편 · 4개 5편 · 5개 이상 26편
 *   151편이 홈에서만 링크를 받는다 — 분야 안에서 서로 받쳐 주는 구조가 없다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const BLOG = path.join(ROOT, 'blog');
const WRITE = process.argv.includes('--write');

// 홈 "분야별 안내" 카드가 가리키는 글 셋. 분류 접두사로 묶인다.
const HUBS = {
  criminal: {
    slug: 'jeonju-criminal-lawyer-early-response',
    label: '전주형사전문변호사 상담 안내 — 경찰 연락부터 첫 진술까지',
  },
  divorce: {
    slug: 'jeonju-divorce-lawyer-property-custody',
    label: '전주이혼전문변호사 상담 안내 — 재산분할과 양육 쟁점',
  },
  civil: {
    slug: 'civil-lawsuit-before-filing-checklist',
    label: '전주민사변호사 상담 안내 — 소를 내기 전에 확인할 것',
  },
};

const MARK = '<!-- hub-link -->';

// 접두사가 분류와 다른 글이 몇 편 있다(허브 둘이 jeonju- 로 시작한다).
// 접두사로만 가리면 그 글들이 조용히 빠지므로 따로 적어 둔다.
const BY_SLUG = {
  'jeonju-criminal-lawyer-early-response': 'criminal',
  'jeonju-divorce-lawyer-property-custody': 'divorce',
  'jeonju-criminal-lawyer-police-investigation-manual': 'criminal',
  'police-investigation-first-response': 'criminal',
};
const catOf = (slug) => BY_SLUG[slug] || slug.split('-')[0];

const files = fs.readdirSync(BLOG).filter((f) => f.endsWith('.html'));
let touched = 0;
let skipped = 0;
const noHub = [];

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  const cat = catOf(slug);
  const hub = HUBS[cat];
  if (!hub) { noHub.push(slug); continue; }
  if (slug === hub.slug) { skipped += 1; continue; }   // 허브 자신

  const file = path.join(BLOG, f);
  let s = fs.readFileSync(file, 'utf8');

  // 2026-11-10 처음에는 </main> 바로 앞에 넣었다. 그 자리는 article·site-wrap 바깥이라
  // 최대폭도 좌우 여백도 안 받는다. 화면 맨 왼쪽에 파란 밑줄 링크가 덩그러니 붙었다.
  // 이미 붙여 놓은 것을 먼저 걷어내고 본문 안으로 다시 넣는다.
  // 줄바꿈 자리에 기대면 안 된다. 워크플로가 만든 파일은 CRLF 이고 MARK 와 <p> 가
  // 같은 줄에 붙어 있어서, \n 을 끼워 넣은 정규식이 6편을 그냥 지나쳤다.
  s = s.replace(/\s*<!-- hub-link -->\s*<p class="hub-link"[\s\S]*?<\/p>/g, '');
  if (s.includes(MARK)) { skipped += 1; continue; }

  const block = `${MARK}\n<div class="related-card">`
    + `<span class="label">분야 안내</span><br>`
    + `<a href="/blog/${hub.slug}">${hub.label}</a></div>\n`;

  // 면책 문구 바로 앞에 둔다 — 상담 안내 다음, 면책 앞이 읽는 순서로 자연스럽다.
  // 면책 문구가 없는 옛 글은 article 닫기 직전에 넣는다.
  let i = s.indexOf('<p class="disclaimer">');
  if (i < 0) i = s.lastIndexOf('</article>');
  // 옛 형식 글 두 편은 article 도 면책 문구도 없이 main 안에 바로 본문이 있다.
  // 그 글들은 .cta 가 main 바로 아래에 놓여 있으니 같은 자리면 폭을 받는다.
  if (i < 0) i = s.lastIndexOf('</main>');
  if (i < 0) { noHub.push(`${slug} (넣을 자리를 못 찾음)`); continue; }
  s = s.slice(0, i) + block + s.slice(i);
  if (WRITE) fs.writeFileSync(file, s);
  touched += 1;
}

console.log(`${WRITE ? '고침' : '고칠 것'} ${touched}편 · 건너뜀 ${skipped}편`);
if (noHub.length) console.log(`분류를 못 가린 글 ${noHub.length}편: ${noHub.slice(0, 6).join(', ')}`);
if (!WRITE) console.log('실제로 고치려면 --write 를 붙이세요.');
