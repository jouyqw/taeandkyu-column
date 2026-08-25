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

// 밀린 날짜가 여러 개여도 하루에 한 편만 낸다. 한꺼번에 쏟으면 대량생성 신호가 된다.
due.sort((a, b) => a.at.localeCompare(b.at));
const publishNow = due.slice(0, 1);
if (due.length > 1) {
  console.log(`발행일이 지난 글이 ${due.length}편입니다. 오늘은 가장 오래된 1편만 냅니다.`);
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
  const final = { ...rest, date: rest.date || at };
  const html = renderArticle(final);

  if (DRY) {
    console.log(`[dry] ${final.slug} (${at}) — ${html.length} bytes`);
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
