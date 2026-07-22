import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const startDate = '2026-07-23';
const site = 'https://column.taeandkyu.com';
const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const publishDate = process.env.PUBLISH_DATE || kstNow.toISOString().slice(0, 10);

const daysBetween = (a, b) => Math.floor((new Date(`${b}T00:00:00+09:00`) - new Date(`${a}T00:00:00+09:00`)) / 86400000);
const dayIndex = daysBetween(startDate, publishDate);

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const groups = [
  {
    key: 'criminal',
    category: '형사사건',
    searchKeywords: ['전주형사전문변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page20.php',
    topics: [
      { slug: 'suspect-investigation-checklist', title: '피의자 조사 전 확인할 사항', point: '조사 전에 사건 지위와 혐의 범위부터 확인하고, 기억과 추측을 구분해 진술 순서를 정리해야 합니다.', materials: '출석요구 연락 내용, 사건 시간표, 관련 대화와 계좌내역', caution: '확인되지 않은 내용을 짐작으로 답하면 이후 조서와 다른 진술로 보일 수 있습니다.' },
      { slug: 'complaint-response-order', title: '고소장 접수 후 대응 순서', point: '고소 사실을 알게 된 직후에는 상대방에게 연락하기보다 고소 내용과 확보된 증거를 먼저 확인해야 합니다.', materials: '고소 관련 연락, 상대방과의 대화, 사건 전후 자료', caution: '성급한 합의 연락은 회유나 압박으로 오해받을 수 있어 사건 성격을 먼저 살펴야 합니다.' },
      { slug: 'phone-search-seizure', title: '휴대폰 압수수색 전후 주의점', point: '압수 범위와 절차를 확인하고, 임의제출인지 영장 집행인지 구분해 대응 기록을 남겨야 합니다.', materials: '영장 사본, 압수목록, 휴대폰 제출 경위와 시간', caution: '자료를 삭제하거나 기기를 초기화하면 증거인멸 문제로 이어질 수 있습니다.' },
      { slug: 'criminal-settlement-timing', title: '형사합의가 필요한 시점과 기준', point: '합의는 무조건 빠르게 하기보다 혐의 내용, 피해 정도, 처벌 의사와 양형에 미치는 영향을 함께 검토해야 합니다.', materials: '피해 내용, 치료비·손해자료, 기존 연락과 제안 내용', caution: '합의금만 먼저 제시하면 책임을 인정한 취지로 해석될 가능성도 살펴야 합니다.' },
      { slug: 'first-offense-statement', title: '초범이 조사에서 주의할 진술', point: '초범이라는 사정과 혐의 인정 여부는 별개이므로 사실관계와 법적 평가를 나누어 준비해야 합니다.', materials: '전과 조회 관련 자료, 사건 경위 메모, 유리·불리한 자료', caution: '선처를 기대해 사실과 다른 자백을 하면 이후 번복이 매우 어려워질 수 있습니다.' },
      { slug: 'non-referral-evidence', title: '불송치 판단에 필요한 자료', point: '수사기관이 확인할 수 있도록 주장과 증거의 연결 관계를 날짜순으로 명확하게 보여주는 것이 중요합니다.', materials: '주장별 증거 목록, 통화·메시지 원본, 객관적 위치·결제 기록', caution: '자료가 많아도 쟁점과 연결되지 않으면 핵심 주장이 흐려질 수 있습니다.' },
      { slug: 'victim-statement-evidence', title: '피해자 진술과 증거 정리 방법', point: '피해 사실은 시간, 장소, 행동, 이후 반응을 구분하고 객관 자료와 일치하는지 확인해야 합니다.', materials: '진단서, 신고 기록, 대화 원본, 목격자와 현장 자료', caution: '기억이 불분명한 부분을 단정하면 전체 진술의 신뢰도에 영향을 줄 수 있습니다.' },
      { slug: 'summons-preparation', title: '출석요구서를 받은 뒤 준비할 것', point: '출석 일정을 바로 확정하기보다 사건번호, 조사 지위, 담당자와 준비 가능한 시간을 먼저 확인해야 합니다.', materials: '출석요구서, 담당 수사관 연락처, 사건 관련 자료 목록', caution: '정당한 사유 없이 출석을 미루거나 연락을 끊는 방식은 피해야 합니다.' },
      { slug: 'attorney-opinion-needed', title: '변호인 의견서가 필요한 경우', point: '사실관계가 복잡하거나 법적 쟁점이 분명한 사건은 주장과 증거를 서면으로 구조화할 필요가 있습니다.', materials: '수사 진행 경과, 핵심 증거, 반박할 주장과 관련 판결 자료', caution: '쟁점과 무관한 장문의 사정 설명은 중요한 근거를 가릴 수 있습니다.' },
      { slug: 'before-criminal-trial', title: '형사재판 전 확인할 핵심 쟁점', point: '공소사실, 증거목록, 인정 여부와 양형자료를 나누어 재판 준비 계획을 세워야 합니다.', materials: '공소장, 증거목록, 수사기록, 합의·공탁과 양형자료', caution: '수사 단계의 진술과 재판 주장이 충돌하지 않는지 반드시 확인해야 합니다.' }
    ]
  },
  {
    key: 'divorce',
    category: '이혼·가사',
    searchKeywords: ['전주이혼변호사', '전주이혼전문변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page21.php',
    topics: [
      { slug: 'property-document-list', title: '이혼 전 재산자료 정리 방법', point: '명의만 보지 말고 혼인 중 형성된 재산과 채무, 취득 시기와 자금 출처를 함께 정리해야 합니다.', materials: '부동산·예금·보험·퇴직금 자료, 대출내역, 취득 자금 증빙', caution: '상대방 명의라는 이유로 재산분할 대상에서 바로 제외되는 것은 아닙니다.' },
      { slug: 'custody-consultation', title: '양육권 상담 전 확인할 사항', point: '현재 양육 상황, 자녀의 생활환경, 돌봄 가능 시간과 부모 간 협력 정도를 구체적으로 살펴야 합니다.', materials: '양육일지, 학교·병원 기록, 주거와 근무 일정, 돌봄 자료', caution: '상대방을 비난하는 자료보다 자녀의 안정에 도움이 되는 사정을 중심으로 정리해야 합니다.' },
      { slug: 'separation-living-cost', title: '별거 중 생활비와 증거 준비', point: '별거 경위와 혼인관계 유지 여부, 부양 필요와 각자의 소득을 구분해 생활비 문제를 검토해야 합니다.', materials: '별거 전후 지출, 소득자료, 생활비 요청과 송금 내역', caution: '일방적으로 모든 지원을 중단하면 부양의무 문제로 이어질 수 있습니다.' },
      { slug: 'spouse-assets-check', title: '상대방 명의 재산 확인 방법', point: '혼인 기간의 소득과 재산 변동을 기준으로 누락된 재산이 있는지 단계적으로 확인해야 합니다.', materials: '재산목록, 세금·등기 자료, 금융거래 단서, 기존 계약서', caution: '불법적인 계정 접속이나 위치 추적은 별도 분쟁을 만들 수 있습니다.' },
      { slug: 'agreement-vs-mediation', title: '협의이혼과 조정이혼의 차이', point: '재산분할, 양육, 위자료에 합의가 되는지와 집행 가능한 문서가 필요한지를 기준으로 절차를 선택해야 합니다.', materials: '합의 가능한 항목 목록, 재산·양육 자료, 상대방 제안', caution: '구두 약속만으로 이혼을 먼저 진행하면 나중에 합의 내용을 입증하기 어려울 수 있습니다.' },
      { slug: 'alimony-evidence', title: '위자료 청구 전 필요한 자료', point: '혼인 파탄의 원인과 상대방의 책임, 그로 인한 정신적 손해를 뒷받침할 자료가 필요합니다.', materials: '대화·사진·진료 기록, 사건 시간표, 신고와 상담 기록', caution: '위법하게 수집한 자료는 증거능력뿐 아니라 형사 문제도 함께 검토해야 합니다.' },
      { slug: 'child-support-checklist', title: '양육비 산정 전 체크리스트', point: '부모의 소득, 자녀의 나이와 특별한 지출, 실제 양육 상황을 기준으로 적정 금액을 살펴야 합니다.', materials: '소득증명, 교육·의료비, 보험료, 기존 양육비 지급 내역', caution: '양육비와 면접교섭은 서로 맞바꾸는 조건으로 처리해서는 안 됩니다.' },
      { slug: 'retirement-insurance-division', title: '퇴직금과 보험의 재산분할 기준', point: '혼인 기간 중 형성된 부분과 개인적 기여를 구분해 현재 가치와 장래 수령 가능성을 검토해야 합니다.', materials: '퇴직금 예상액, 보험 해약환급금, 가입·납입 내역', caution: '세금과 중도해지 손실을 빼지 않으면 실제 분할 가치가 달라질 수 있습니다.' },
      { slug: 'real-estate-division', title: '부동산 재산분할 준비 방법', point: '취득 시기, 명의, 대출, 시세와 자금 출처를 함께 확인해 순가치를 계산해야 합니다.', materials: '등기부, 매매계약서, 대출잔액, 시세자료, 자금 흐름', caution: '시세만 기준으로 삼지 말고 처분비용과 담보채무도 함께 반영해야 합니다.' },
      { slug: 'divorce-agreement-caution', title: '이혼 합의서 작성 전 주의점', point: '지급 금액과 기한, 양육·면접교섭, 불이행 시 조치가 실제 집행 가능한 문구인지 확인해야 합니다.', materials: '합의 항목표, 지급 일정, 재산목록, 양육 계획', caution: '포괄적인 권리 포기 문구는 예상하지 못한 청구까지 막을 수 있어 범위를 분명히 해야 합니다.' }
    ]
  },
  {
    key: 'civil',
    category: '민사소송',
    searchKeywords: ['전주민사변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page22.php',
    topics: [
      { slug: 'certified-letter', title: '내용증명 보내기 전 확인할 기준', point: '요구 내용과 근거, 이행 기한을 분명히 하고 이후 소송에서 불리한 표현이 없는지 확인해야 합니다.', materials: '계약서, 정산표, 기존 연락, 청구 금액 계산 자료', caution: '감정적인 비난이나 과도한 법적 위협은 분쟁 해결에 도움이 되지 않습니다.' },
      { slug: 'loan-evidence', title: '대여금 소송의 핵심 증거', point: '돈이 오간 사실뿐 아니라 빌려준 돈이라는 점과 변제기, 남은 금액을 입증해야 합니다.', materials: '계좌내역, 차용증, 이자 지급, 상환 약속 대화', caution: '투자금이나 공동사업 정산금으로 해석될 여지가 있는지 먼저 확인해야 합니다.' },
      { slug: 'construction-payment', title: '공사대금 청구 전 확인할 것', point: '계약 범위, 추가 공사, 완성 여부와 미지급 금액을 항목별로 구분해야 합니다.', materials: '계약서·견적서, 작업사진, 세금계산서, 추가 지시 대화', caution: '하자 주장이나 지체상금 반박 자료도 함께 준비해야 합니다.' },
      { slug: 'damage-claim', title: '손해배상 청구자료 정리법', point: '위법행위, 실제 손해, 두 요소 사이의 원인관계를 각각 입증할 자료가 필요합니다.', materials: '사건 기록, 영수증·진단서, 소득 감소 자료, 대화 원본', caution: '추정 금액만 크게 제시하면 실제 인정 가능한 손해가 흐려질 수 있습니다.' },
      { slug: 'no-contract-proof', title: '계약서 없는 거래의 입증 방법', point: '계약서가 없어도 거래 목적, 금액, 이행 내용과 상대방의 인식을 다른 자료로 확인할 수 있습니다.', materials: '송금내역, 문자·이메일, 견적서, 세금계산서, 녹음', caution: '일부 문장만 떼어내기보다 대화 전체 흐름을 보존해야 합니다.' },
      { slug: 'provisional-seizure', title: '가압류가 필요한 상황과 준비', point: '본안 청구의 근거와 함께 상대방이 재산을 처분할 위험, 보전의 필요성을 소명해야 합니다.', materials: '채권 근거, 재산 단서, 독촉 내역, 처분 위험 자료', caution: '가압류에는 담보 제공이 필요할 수 있어 비용과 회수 가능성을 함께 검토해야 합니다.' },
      { slug: 'filing-cost', title: '소장 접수 전 비용 점검', point: '인지대와 송달료뿐 아니라 감정·집행 비용, 승소 후 실제 회수 가능성까지 계산해야 합니다.', materials: '청구금액 계산표, 상대방 재산 단서, 예상 증거비용', caution: '승소 가능성과 돈을 실제로 받는 가능성은 서로 다릅니다.' },
      { slug: 'answer-deadline', title: '답변서 제출 전 정리 순서', point: '원고의 청구원인별로 인정, 부인, 모름을 나누고 각 반박에 맞는 증거를 연결해야 합니다.', materials: '소장과 첨부서류, 계약·지급 자료, 사건 시간표', caution: '제출 기한을 넘기거나 막연히 전부 부인하면 방어 기회를 놓칠 수 있습니다.' },
      { slug: 'message-recording-evidence', title: '문자와 통화녹음 증거 활용법', point: '누가 언제 어떤 맥락에서 한 말인지 확인할 수 있도록 원본과 전체 대화를 보존해야 합니다.', materials: '원본 기기, 전체 대화 내보내기, 녹음파일과 녹취서', caution: '대화 당사자가 아닌 제3자 간 통화를 몰래 녹음하면 법적 문제가 생길 수 있습니다.' },
      { slug: 'post-judgment-enforcement', title: '판결 후 강제집행 준비 방법', point: '확정 여부와 집행문을 확인하고 채무자의 재산 종류에 맞는 집행 절차를 선택해야 합니다.', materials: '판결문·확정증명, 집행문, 계좌·부동산·급여 단서', caution: '소멸시효와 재산 변동을 고려해 집행 시기를 놓치지 않아야 합니다.' }
    ]
  }
];

const totalPosts = groups.reduce((sum, group) => sum + group.topics.length, 0);

if (dayIndex < 0 || dayIndex >= totalPosts) {
  console.log(`No scheduled post for ${publishDate}`);
  process.exit(0);
}

const group = groups[dayIndex % groups.length];
const topicIndex = Math.floor(dayIndex / groups.length);
const topic = group.topics[topicIndex];
const searchKeyword = group.searchKeywords[topicIndex % group.searchKeywords.length];

const post = {
  ...group,
  ...topic,
  searchKeyword,
  slug: `${group.key}-${topic.slug}-${publishDate}`,
  title: `${searchKeyword}, ${topic.title}`,
  description: `${searchKeyword} 상담을 알아보는 분들을 위해 ${topic.title}을 정리했습니다. ${topic.point}`
};

const renderPost = (item) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(item.title)} | 법무법인 태앤규</title>
<meta name="description" content="${esc(item.description)}">
<meta name="author" content="법무법인 태앤규">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${site}/blog/${item.slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(item.title)}">
<meta property="og:description" content="${esc(item.description)}">
<meta property="og:url" content="${site}/blog/${item.slug}">
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,'Noto Sans KR',sans-serif;background:#f6f7f9;color:#111827;line-height:1.8;word-break:keep-all}.wrap{max-width:920px;margin:0 auto;padding:34px 22px 76px}.top{background:#111827;color:#fff}.top .wrap{padding-top:18px;padding-bottom:18px}.top a{color:#fff;text-decoration:none}.article{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}.head{padding:40px 42px 28px;border-bottom:1px solid #e5e7eb}.badge{display:inline-block;background:#f6edcf;color:#3f2f0b;border-radius:4px;padding:6px 10px;font-size:12px;font-weight:900;margin-bottom:16px}h1{font-size:clamp(27px,4vw,42px);line-height:1.34;margin:0 0 16px}.answer{background:#f9fafb;border-left:5px solid #b99b4b;padding:17px 20px;font-weight:800}.meta{margin-top:16px;color:#6b7280;font-size:13px}.body{padding:36px 42px}.body h2{font-size:24px;margin:38px 0 14px}.body p{margin:0 0 17px}.body strong{color:#111827;font-weight:900}.body u{text-decoration-thickness:8px;text-underline-offset:-3px;text-decoration-color:#f1d993;text-decoration-skip-ink:none}.table-wrap{overflow-x:auto;margin:24px 0;border:1px solid #e5e7eb;border-radius:8px}table{width:100%;border-collapse:collapse;min-width:640px}th,td{padding:14px 15px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}th{background:#f8fafc}.callout{background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;margin:24px 0}.warning{background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:18px 20px;margin:24px 0}.cta{margin-top:30px;padding:20px;border-radius:8px;background:#111827;color:#fff}.cta a{color:#f1d993;font-weight:900}.footer{padding:26px 0;color:#6b7280;font-size:13px}@media(max-width:720px){.head,.body{padding-left:22px;padding-right:22px}}
</style>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: item.title,
  description: item.description,
  author: { '@type': 'Organization', name: '법무법인 태앤규' },
  publisher: { '@type': 'LegalService', name: '법무법인 태앤규', url: 'https://taeandkyu.com/' },
  datePublished: publishDate,
  dateModified: publishDate,
  mainEntityOfPage: `${site}/blog/${item.slug}`,
  inLanguage: 'ko'
})}</script>
</head>
<body>
<header class="top"><div class="wrap"><a href="/">전주변호사 법률칼럼 · 법무법인 태앤규</a></div></header>
<main class="wrap"><article class="article">
<header class="head"><span class="badge">${esc(item.category)}</span><h1>${esc(item.title)}</h1><p class="answer">결론부터 말하면, ${esc(item.point)}</p><div class="meta">작성일 ${publishDate} · 전주·완주·군산·익산 상담</div></header>
<section class="body">
<p>${esc(item.searchKeyword)}를 찾는 분들은 사건이 이미 진행된 뒤 급하게 상담하는 경우가 많습니다. 하지만 ${esc(item.title.replace(`${item.searchKeyword}, `, ''))}은 결론부터 정하기보다 현재 단계와 남은 기한을 먼저 확인해야 합니다.</p>
<p>전주 지역 사건이라도 같은 유형이라는 이유만으로 결과가 정해지지는 않습니다. <strong>사실관계, 증거, 상대방 주장, 절차상 기한</strong>을 나누어 보면 지금 해야 할 일과 미뤄도 되는 일을 구분할 수 있습니다.</p>
<h2>상담 전에 준비할 자료</h2>
<div class="table-wrap"><table><thead><tr><th>확인 항목</th><th>정리할 내용</th></tr></thead><tbody><tr><td>핵심 자료</td><td>${esc(item.materials)}</td></tr><tr><td>사건 순서</td><td>문제가 시작된 날부터 현재까지 날짜순으로 작성한 메모</td></tr><tr><td>상대방 주장</td><td>동의하는 부분과 사실과 다른 부분을 구분한 목록</td></tr><tr><td>남은 기한</td><td>조사·답변·제출·이의신청 등 예정된 날짜</td></tr></tbody></table></div>
<p>자료는 양보다 연결 관계가 중요합니다. 어떤 사실을 어떤 자료로 확인할 수 있는지 표시하면 상담에서 쟁점을 빠르게 파악할 수 있습니다. 불리해 보이는 자료도 숨기지 않고 함께 검토해야 대응 방향이 흔들리지 않습니다.</p>
<div class="callout"><strong>이번 글의 핵심</strong><p>${esc(item.point)}</p></div>
<h2>특히 주의할 점</h2>
<div class="warning"><strong>주의</strong><p>${esc(item.caution)}</p></div>
<p>인터넷의 일반적인 설명은 준비 방향을 잡는 데에는 도움이 되지만, 개별 사건의 결론을 대신할 수 없습니다. 현재 가지고 있는 자료와 절차를 기준으로 선택지별 부담을 확인하는 것이 안전합니다.</p>
<div class="cta"><p><strong>${esc(item.category)} 업무분야 안내</strong></p><p><a href="${item.practiceUrl}">법무법인 태앤규 업무분야 자세히 보기</a> · <a href="https://taeandkyu.com/">공식 홈페이지</a></p></div>
</section></article></main>
<footer class="footer"><div class="wrap">본 글은 일반적인 법률 정보이며, 개별 사건의 결과를 보장하지 않습니다.</div></footer>
</body></html>
`;

mkdirSync('blog', { recursive: true });

const file = `blog/${post.slug}.html`;
if (existsSync(file)) {
  console.log(`Already published ${file}`);
  process.exit(0);
}

writeFileSync(file, renderPost(post), 'utf8');
console.log(`Scheduled publish completed for ${publishDate}: ${file}`);
