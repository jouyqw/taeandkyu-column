import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const startDate = '2026-07-01';
const site = 'https://column.taeandkyu.com';
const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const publishDate = process.env.PUBLISH_DATE || kstNow.toISOString().slice(0, 10);

const daysBetween = (a, b) => Math.floor((new Date(`${b}T00:00:00+09:00`) - new Date(`${a}T00:00:00+09:00`)) / 86400000);
const dayIndex = daysBetween(startDate, publishDate);

if (dayIndex < 0 || dayIndex >= 30) {
  console.log(`No scheduled posts for ${publishDate}`);
  process.exit(0);
}

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const groups = [
  {
    key: 'criminal',
    category: '형사사건',
    keyword: '경찰조사',
    subjects: ['피의자 조사 전 확인할 점', '고소장 접수 후 대응 순서', '휴대폰 압수수색 전후 주의점', '합의가 필요한 사건의 기준', '초범이라도 조심해야 할 진술', '불송치 가능성을 높이는 자료', '피해자 진술과 증거 정리', '출석요구서 받은 뒤 준비', '변호인 의견서가 필요한 경우', '재판 전 단계에서 확인할 점']
  },
  {
    key: 'divorce',
    category: '이혼',
    keyword: '재산분할',
    subjects: ['이혼 전 재산자료 정리법', '양육권 상담 전 확인할 점', '별거 중 생활비와 증거', '상대방 명의 재산 확인', '협의이혼과 조정이혼 차이', '위자료 주장 전 필요한 자료', '양육비 산정 전 체크리스트', '퇴직금과 보험의 재산분할', '부동산이 있는 경우 준비', '이혼 합의서 작성 전 주의점']
  },
  {
    key: 'civil',
    category: '민사소송',
    keyword: '소송준비',
    subjects: ['내용증명 보내기 전 기준', '대여금 소송 증거 정리', '공사대금 청구 전 확인', '손해배상 청구 자료', '계약서 없는 거래의 입증', '가압류가 필요한 상황', '소장 접수 전 비용 점검', '답변서 제출 전 정리', '문자와 통화녹음 활용', '판결 후 강제집행 준비']
  }
];

const postFor = (group, index) => {
  const subject = group.subjects[index];
  const slug = `${group.key}-${subject.replaceAll(' ', '-').replace(/[^\uAC00-\uD7A3a-zA-Z0-9-]/g, '').toLowerCase()}-${publishDate}`;
  const title = `${subject}, 상담 전 무엇을 먼저 정리해야 할까요?`;
  const description = `${group.category} 상담에서는 사실관계, 증거, 일정, 상대방 주장까지 순서대로 정리해야 판단이 흔들리지 않습니다.`;
  return { ...group, slug, title, description, subject };
};

const renderPost = (post) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(post.title)} | 법률칼럼</title>
<meta name="description" content="${esc(post.description)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${site}/blog/${post.slug}">
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;background:#f6f7f9;color:#111827;line-height:1.8;word-break:keep-all}.wrap{max-width:920px;margin:0 auto;padding:34px 22px 76px}.top{background:#111827;color:#fff}.top .wrap{padding-top:18px;padding-bottom:18px}.top a{color:#fff;text-decoration:none}.article{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}.head{padding:40px 42px 28px;border-bottom:1px solid #e5e7eb}.badge{display:inline-block;background:#f6edcf;color:#3f2f0b;border-radius:4px;padding:6px 10px;font-size:12px;font-weight:900;margin-bottom:16px}h1{font-size:clamp(27px,4vw,42px);line-height:1.34;margin:0 0 16px}.answer{background:#f9fafb;border-left:5px solid #b99b4b;padding:17px 20px;font-weight:800}.meta{margin-top:16px;color:#6b7280;font-size:13px}.body{padding:36px 42px}.body h2{font-size:24px;margin:38px 0 14px}.body p{margin:0 0 17px}.body strong{color:#111827;font-weight:900}.body u{text-decoration-thickness:8px;text-underline-offset:-3px;text-decoration-color:#f1d993;text-decoration-skip-ink:none}.table-wrap{overflow-x:auto;margin:24px 0;border:1px solid #e5e7eb;border-radius:8px}table{width:100%;border-collapse:collapse;min-width:640px}th,td{padding:14px 15px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}th{background:#f8fafc}.callout{background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin:24px 0}.footer{padding:26px 0;color:#6b7280;font-size:13px}@media(max-width:720px){.head,.body{padding-left:22px;padding-right:22px}}
</style>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  description: post.description,
  author: { '@type': 'Organization', name: '법무법인 태앤규' },
  publisher: { '@type': 'Organization', name: '법무법인 태앤규', url: 'https://taeandkyu.com/' },
  datePublished: publishDate,
  dateModified: publishDate,
  mainEntityOfPage: `${site}/blog/${post.slug}`,
  inLanguage: 'ko'
})}</script>
</head>
<body>
<header class="top"><div class="wrap"><a href="/">법무법인 태앤규 법률칼럼</a></div></header>
<main class="wrap"><article class="article">
<header class="head"><span class="badge">${esc(post.category)}</span><h1>${esc(post.title)}</h1><p class="answer">결론부터 말하면, ${esc(post.subject)}은 감정적으로 대응하기보다 <u>자료와 일정, 상대방 주장</u>을 먼저 나눠 정리해야 합니다.</p><div class="meta">작성일 ${publishDate} · 주제 ${esc(post.keyword)}</div></header>
<section class="body">
<p>${esc(post.category)} 문제는 처음 연락을 받았을 때의 대응이 이후 방향에 큰 영향을 줍니다. 말로 설명할 수 있다고 생각해도 실제 상담에서는 날짜, 금액, 대화 내용, 증거 위치가 섞여 판단이 흐려지는 경우가 많습니다.</p>
<p>따라서 상담 전에는 사건을 길게 설명하려 하기보다 <strong>언제, 누가, 무엇을, 어떤 자료로 확인할 수 있는지</strong>를 표로 정리하는 것이 좋습니다. 이 방식이 되어야 쟁점이 빨리 보이고 불필요한 주장도 줄일 수 있습니다.</p>
<h2>먼저 정리할 자료</h2>
<div class="table-wrap"><table><thead><tr><th>구분</th><th>확인할 내용</th><th>준비 자료</th></tr></thead><tbody><tr><td>사실관계</td><td>일어난 순서와 상대방 주장</td><td>메모, 문자, 카카오톡, 이메일</td></tr><tr><td>증거</td><td>내 주장을 뒷받침할 자료</td><td>계약서, 입금내역, 녹취, 사진</td></tr><tr><td>일정</td><td>조사, 답변, 제출 마감</td><td>출석요구서, 법원 서류</td></tr><tr><td>위험요소</td><td>불리하게 해석될 수 있는 부분</td><td>상대방 자료, 기존 진술</td></tr></tbody></table></div>
<p>중요한 것은 유리한 자료만 고르는 것이 아닙니다. 불리해 보이는 내용도 미리 확인해야 대응 방향을 정할 수 있습니다. 숨기거나 늦게 말한 자료는 오히려 전체 전략을 흔들 수 있습니다.</p>
<div class="callout"><strong>상담 전 핵심</strong><p>자료는 많을수록 좋은 것이 아니라, 쟁점별로 정리되어 있어야 도움이 됩니다. 특히 ${esc(post.keyword)} 관련 사안은 처음 진술과 첫 서류가 이후 절차에서 반복해 확인됩니다.</p></div>
<h2>주의할 점</h2>
<p>인터넷 글만 보고 결론을 정한 뒤 움직이면 실제 사건의 차이를 놓치기 쉽습니다. 같은 유형처럼 보여도 금액, 시기, 증거, 상대방 태도에 따라 선택지는 달라집니다.</p>
<p>그래서 상담에서는 결론을 단정하기보다 가능한 선택지와 각 선택지의 부담을 나눠 보는 것이 현실적입니다. 준비된 자료가 많을수록 상담 시간은 짧아지고 판단은 선명해집니다.</p>
</section></article></main>
<footer class="footer"><div class="wrap">본 글은 일반 법률 정보이며, 개별 사건의 결과를 보장하지 않습니다.</div></footer>
</body></html>
`;

mkdirSync('blog', { recursive: true });

let created = 0;
groups.forEach((group) => {
  const post = postFor(group, dayIndex % group.subjects.length);
  const file = `blog/${post.slug}.html`;
  if (existsSync(file)) return;
  writeFileSync(file, renderPost(post), 'utf8');
  console.log(`Created ${file}`);
  created += 1;
});

console.log(`Scheduled publish completed for ${publishDate}: ${created} new posts`);
