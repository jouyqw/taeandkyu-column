/**
 * 예약 칼럼 발행기 — node scripts/publish-queue.mjs [--dry]
 *
 * content/queue/*.json 중 publishAt 이 오늘(KST) 이하인 초안을
 *   1) content/drafts/<slug>.json 으로 옮기고
 *   2) scripts/author/render-article.mjs 로 blog/<slug>.html 을 만든다
 * 이후 피드 재생성과 seo-audit 는 워크플로가 이어서 실행한다.
 *
 * 초안 형식은 content/drafts/*.json 과 같고, publishAt 한 줄만 더 있다.
 * date 가 비어 있으면 publishAt 을 발행일로 쓴다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { renderArticle } from './author/render-article.mjs';

const DRY = process.argv.includes('--dry');
const QUEUE = path.join('content', 'queue');
const DRAFTS = path.join('content', 'drafts');

const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
console.log(`KST 오늘 = ${today}`);

const out = process.env.GITHUB_OUTPUT;
const emit = (line) => {
  if (out) fs.appendFileSync(out, `${line}\n`);
};

if (!fs.existsSync(QUEUE)) {
  console.log('큐 폴더가 없습니다. 발행할 것이 없습니다.');
  emit('published=0');
  process.exit(0);
}

const files = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json')).sort();
const due = [];
for (const f of files) {
  const draft = JSON.parse(fs.readFileSync(path.join(QUEUE, f), 'utf8'));
  const at = String(draft.publishAt || draft.date || '').slice(0, 10);
  if (at && at <= today) due.push({ file: f, draft, at });
}

if (!due.length) {
  console.log(`발행일이 된 글이 없습니다. 큐에 ${files.length}편 남아 있습니다.`);
  emit('published=0');
  process.exit(0);
}

// 같은 날짜로 예약된 글은 함께 낸다(2026-10-15 부터 평일 2편).
// 다만 밀린 날짜까지 한꺼번에 쏟지는 않는다 — 대량생성 신호가 된다.
due.sort((a, b) => a.at.localeCompare(b.at) || a.file.localeCompare(b.file));
// 하루치만 내면 밀린 날을 영영 못 따라잡는다. 예약은 평일마다 2편씩 쌓이는데
// 소화는 하루치씩이라, 주말이나 실행이 걸러진 날 생긴 공백이 그대로 남는다.
// 2026-10-25 에 세 사이트가 똑같이 10/23 자 2편씩 밀려 있었다.
// 이틀치까지 허용하면 밀린 분이 한 번에 한 칸씩 당겨지고, 한꺼번에 쏟지도 않는다.
const dueDays = [...new Set(due.map((x) => x.at))];
const takeDays = dueDays.slice(0, 2);
const publishNow = due.filter((x) => takeDays.includes(x.at));
if (due.length > publishNow.length) {
  console.log(`발행일이 지난 글이 ${due.length}편입니다. 오늘은 ${takeDays.join(', ')} 자 ${publishNow.length}편만 냅니다.`);
} else if (takeDays.length > 1) {
  console.log(`밀린 분을 따라잡습니다 — ${takeDays.join(', ')} 자 ${publishNow.length}편.`);
}

fs.mkdirSync(DRAFTS, { recursive: true });
const titles = [];

for (const { file, draft, at } of publishNow) {
  if (fs.existsSync(path.join('blog', `${draft.slug}.html`))) {
    console.warn(`건너뜀 ${draft.slug} — 이미 발행된 글입니다.`);
    if (!DRY) fs.rmSync(path.join(QUEUE, file));
    continue;
  }

  const { publishAt, ...rest } = draft;
  // date 는 publishAt 을 따른다. rest.date 를 우선하면 안 된다.
  // 예약일을 옮기면 publishAt 만 바뀌고 date 는 초안 쓴 날로 남아, 새 글이 옛 날짜로
  // 올라간다. 그러면 검색엔진이 새 글로 보지 않고 사이트맵 lastmod 도 안 움직인다
  // (2026-10-13 전주개인회생에서 실제로 그렇게 됐다).
  const final = { ...rest, date: at || rest.date };
  const html = renderArticle(final);

  if (DRY) {
    console.log(`[dry] ${final.slug} (${at}) — ${html.length} bytes`);
    titles.push(final.title);   // --dry 에서도 편수가 맞게 보이도록
    continue;
  }

  fs.writeFileSync(path.join(DRAFTS, `${final.slug}.json`), `${JSON.stringify(final, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join('blog', `${final.slug}.html`), html, 'utf8');
  fs.rmSync(path.join(QUEUE, file));
  titles.push(final.title);
  console.log(`발행 ${final.slug} (${at})`);
}

emit(`published=${titles.length}`);
emit(`summary=${titles.join(' / ').slice(0, 180)}`);
console.log(`\n발행 ${titles.length}편, 큐 잔량 ${files.length - publishNow.length}편`);
