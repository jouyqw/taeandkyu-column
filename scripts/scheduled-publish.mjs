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
    image: '/assets/criminal-investigation-preparation.webp',
    imageAlt: '경찰조사 전 휴대전화 대화와 사건 시간표, 증거자료를 정리한 장면',
    pillarUrl: 'https://column.taeandkyu.com/blog/jeonju-criminal-lawyer-early-response',
    pillarTitle: '전주형사전문변호사, 경찰 연락을 받았다면',
    officialSources: [
      { name: '국가법령정보센터 형사소송법', url: 'https://www.law.go.kr/법령/형사소송법' }
    ],
    searchKeywords: ['전주형사전문변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page20.php',
    successCase: {
      title: '전주형사전문변호사 상해죄 벌금형 방어사례',
      url: 'https://taeandkyu.com/bbs/board.php?bo_table=notice&wr_id=149',
      summary: '법무법인 태앤규 홈페이지에 공개된 실제 형사사건 수행사례입니다.'
    },
    consultationQuestions: [
      ['현재 사건 단계', '신고·고소 전인지, 경찰 연락이나 출석요구를 받았는지 확인합니다.'],
      ['조사받는 지위', '피의자·피해자·참고인 중 어떤 지위인지에 따라 준비 방향이 달라집니다.'],
      ['처음 남긴 말', '전화 통화나 현장 진술처럼 이미 수사기관에 전달된 내용이 있는지 봅니다.'],
      ['객관 자료', 'CCTV, 메시지, 계좌내역, 위치기록처럼 진술을 확인할 자료를 찾습니다.']
    ],
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
    image: '/assets/divorce-property-custody-consultation.webp',
    imageAlt: '이혼 상담실에서 주택 모형과 재산·양육 자료를 함께 검토하는 장면',
    pillarUrl: 'https://column.taeandkyu.com/blog/jeonju-divorce-lawyer-property-custody',
    pillarTitle: '전주이혼전문변호사, 재산분할·양육권 준비',
    officialSources: [
      { name: '국가법령정보센터 민법', url: 'https://www.law.go.kr/법령/민법' }
    ],
    searchKeywords: ['전주이혼변호사', '전주이혼전문변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page21.php',
    successCase: {
      title: '전주이혼변호사 양육비 사전처분 해결사례',
      url: 'https://taeandkyu.com/bbs/board.php?bo_table=notice&wr_id=150',
      summary: '법무법인 태앤규 홈페이지에 공개된 실제 이혼·가사사건 수행사례입니다.'
    },
    consultationQuestions: [
      ['혼인과 별거 기간', '혼인 기간, 별거를 시작한 시점과 현재 생활 상태를 확인합니다.'],
      ['재산 형성 과정', '부동산·예금·채무가 언제 누구의 기여로 형성되었는지 살펴봅니다.'],
      ['자녀의 현재 생활', '주 양육자, 학교와 병원, 돌봄 시간과 주거환경을 구체적으로 봅니다.'],
      ['상대방과 합의 가능성', '재산·양육·위자료 중 합의되는 부분과 다투는 부분을 나눕니다.']
    ],
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
    image: '/assets/civil-contract-evidence-review.webp',
    imageAlt: '민사 분쟁 상담을 위해 계약서와 계산서, 부동산 자료를 검토하는 장면',
    pillarUrl: 'https://column.taeandkyu.com/blog/civil-lawsuit-before-filing-checklist',
    pillarTitle: '전주민사변호사, 소송 전 확인할 3가지',
    officialSources: [
      { name: '국가법령정보센터 민법', url: 'https://www.law.go.kr/법령/민법' },
      { name: '국가법령정보센터 민사소송법', url: 'https://www.law.go.kr/법령/민사소송법' }
    ],
    searchKeywords: ['전주민사변호사'],
    practiceUrl: 'https://taeandkyu.com/page/page22.php',
    successCase: {
      title: '전주민사소송변호사 매매예약금 반환 청구의 소',
      url: 'https://taeandkyu.com/bbs/board.php?bo_table=notice&wr_id=148',
      summary: '법무법인 태앤규 홈페이지에 공개된 실제 민사소송 수행사례입니다.'
    },
    consultationQuestions: [
      ['청구하려는 내용', '돈의 지급, 계약 해제, 손해배상 등 원하는 결과를 먼저 구체화합니다.'],
      ['약속의 근거', '계약서가 없다면 송금, 대화, 견적서 등 약속을 보여줄 자료를 확인합니다.'],
      ['금액과 계산 방식', '원금·이자·손해액을 구분하고 각 금액의 계산 근거를 정리합니다.'],
      ['회수 가능성', '승소 가능성과 별도로 상대방 재산과 강제집행 가능성을 살펴봅니다.']
    ],
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

const planErrors = [];
const topicCounts = new Set(groups.map((group) => group.topics.length));
if (topicCounts.size !== 1) planErrors.push('분야별 예약 글 수가 서로 다릅니다.');
for (const group of groups) {
  for (const [index, topic] of group.topics.entries()) {
    const keyword = group.searchKeywords[index % group.searchKeywords.length];
    const plannedTitle = `${keyword}, ${topic.title} | 법무법인 태앤규`;
    const plannedDescription = `${keyword} 상담을 알아보는 분들을 위해 ${topic.title}을 정리했습니다. ${topic.point}`;
    if ([...plannedTitle].length > 50) planErrors.push(`${topic.slug}: title이 50자를 넘습니다.`);
    if ([...plannedDescription].length < 45 || [...plannedDescription].length > 160) {
      planErrors.push(`${topic.slug}: description 길이를 확인하세요.`);
    }
    if (!topic.point || !topic.materials || !topic.caution) planErrors.push(`${topic.slug}: 핵심 콘텐츠 항목이 비었습니다.`);
    if (!group.pillarUrl || !group.image || !group.imageAlt || !group.officialSources?.length) {
      planErrors.push(`${group.key}: 내부링크·이미지·공식 출처 설정이 비었습니다.`);
    }
  }
}
if (planErrors.length > 0) {
  console.error(`Scheduled content plan failed with ${planErrors.length} error(s):`);
  for (const error of planErrors) console.error(`- ${error}`);
  process.exit(1);
}

const publishGroup = (process.env.PUBLISH_GROUP || 'all').trim().toLowerCase();
const allowedPublishGroups = new Set(['all', ...groups.map((group) => group.key)]);
if (!allowedPublishGroups.has(publishGroup)) {
  console.error(`Unknown PUBLISH_GROUP: ${publishGroup}`);
  process.exit(1);
}

const topicsPerGroup = Math.min(...groups.map((group) => group.topics.length));
if (dayIndex < 0 || dayIndex >= topicsPerGroup) {
  console.log(`No scheduled posts for ${publishDate}`);
  process.exit(0);
}

const selectedGroups = publishGroup === 'all'
  ? groups
  : groups.filter((group) => group.key === publishGroup);

const createPost = (group) => {
  const topicIndex = dayIndex;
  const topic = group.topics[topicIndex];
  const searchKeyword = group.searchKeywords[topicIndex % group.searchKeywords.length];
  const faqs = [
    {
      question: `전주에서 ${group.category} 상담을 받을 때 무엇을 준비해야 하나요?`,
      answer: `${topic.materials}을 우선 준비하고, 사건이 시작된 날부터 현재까지의 순서를 한 장으로 정리하면 상담에서 핵심 쟁점을 빠르게 확인할 수 있습니다.`
    },
    {
      question: '전화상담만으로 사건 결과를 알 수 있나요?',
      answer: '전화로 기본 방향은 확인할 수 있지만, 정확한 판단에는 계약서·대화 원본·수사기관 또는 법원 서류 등 실제 자료 검토가 필요합니다.'
    },
    {
      question: '전주 외 군산·익산 사건도 상담할 수 있나요?',
      answer: '법무법인 태앤규는 전주를 중심으로 완주·군산·익산 등 전북 지역 사건을 상담합니다. 구체적인 진행 가능 여부는 사건 관할과 일정을 확인해 안내합니다.'
    }
  ];

  return {
    ...group,
    ...topic,
    searchKeyword,
    faqs,
    slug: `${group.key}-${topic.slug}-${publishDate}`,
    title: `${searchKeyword}, ${topic.title}`,
    description: `${searchKeyword} 상담을 알아보는 분들을 위해 ${topic.title}을 정리했습니다. ${topic.point}`
  };
};

const posts = selectedGroups.map(createPost);

const renderPost = (item) => {
  const consultationRows = item.consultationQuestions.map(([question, reason]) =>
    `<tr><th scope="row">${esc(question)}</th><td>${esc(reason)}</td></tr>`
  ).join('');
  const faqHtml = item.faqs.map((faq) =>
    `<details><summary>${esc(faq.question)}</summary><p>${esc(faq.answer)}</p></details>`
  ).join('');
  const officialSourceHtml = item.officialSources.map((source) =>
    `<li><a href="${esc(source.url)}">${esc(source.name)}</a></li>`
  ).join('');
  const topicTitle = item.title.replace(`${item.searchKeyword}, `, '');
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${site}/blog/${item.slug}#article`,
        headline: item.title,
        description: item.description,
        image: `${site}${item.image}`,
        author: { '@type': 'Organization', name: '법무법인 태앤규', url: 'https://taeandkyu.com/' },
        publisher: { '@id': 'https://taeandkyu.com/#legalservice' },
        datePublished: publishDate,
        dateModified: publishDate,
        mainEntityOfPage: `${site}/blog/${item.slug}`,
        about: [item.searchKeyword, item.category, topicTitle],
        citation: [item.successCase.url, item.practiceUrl, ...item.officialSources.map((source) => source.url)],
        isPartOf: { '@id': `${site}/#website` },
        inLanguage: 'ko'
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '전주변호사 법률칼럼', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: item.category, item: item.practiceUrl },
          { '@type': 'ListItem', position: 3, name: item.title, item: `${site}/blog/${item.slug}` }
        ]
      },
      {
        '@type': 'FAQPage',
        mainEntity: item.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      },
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        url: `${site}/`,
        name: '전주변호사 법률칼럼',
        publisher: { '@id': 'https://taeandkyu.com/#legalservice' },
        inLanguage: 'ko-KR'
      },
      {
        '@type': 'LegalService',
        '@id': 'https://taeandkyu.com/#legalservice',
        name: '법무법인 태앤규',
        url: 'https://taeandkyu.com/',
        telephone: '010-9886-3105',
        areaServed: ['전주시', '완주군', '군산시', '익산시'],
        address: {
          '@type': 'PostalAddress',
          streetAddress: '홍산남로 19 즐거운빌딩 3층 302호',
          addressLocality: '전주시 완산구',
          addressRegion: '전북특별자치도',
          addressCountry: 'KR'
        }
      }
    ]
  };

  return `<!DOCTYPE html>
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
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="법무법인 태앤규 법률칼럼">
<meta property="og:title" content="${esc(item.title)}">
<meta property="og:description" content="${esc(item.description)}">
<meta property="og:url" content="${site}/blog/${item.slug}">
<meta property="og:image" content="${site}${item.image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(item.title)}">
<meta name="twitter:description" content="${esc(item.description)}">
<meta name="twitter:image" content="${site}${item.image}">
<style>
:root{--navy:#1a2740;--navy2:#233758;--gold:#b8922a;--gold2:#d4a843;--ink:#182033;--muted:#667085;--line:#e3e8ef;--paper:#fff;--bg:#f3f5f8;--soft:#f8fafc;--gold-soft:#fbf6e8}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:'Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.82;word-break:keep-all}.site-wrap{max-width:980px;margin:0 auto;padding:0 22px}.top{background:var(--navy);color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}.top .site-wrap{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-weight:900;letter-spacing:-.02em}.top a{color:#fff;text-decoration:none}.home-link{font-size:13px;color:#f4d98d!important}.page{padding:24px 0 80px}.crumb{font-size:13px;color:var(--muted);margin:0 0 16px}.article{background:var(--paper);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(26,39,64,.09)}.hero-img{margin:0;background:#eef1f5}.hero-img img{display:block;width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover}.head{padding:52px 54px 38px;background:linear-gradient(145deg,#fff 0%,#fbfcfe 72%,#fbf6e8 100%);border-bottom:1px solid var(--line)}.badge{display:inline-flex;align-items:center;gap:7px;background:var(--gold-soft);color:#6c5014;border:1px solid #ead9a8;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:900;margin-bottom:18px}h1{font-size:clamp(29px,4.5vw,44px);line-height:1.3;letter-spacing:-.035em;margin:0 0 20px;color:var(--navy)}.answer{background:var(--navy);color:#fff;border-left:5px solid var(--gold2);border-radius:10px;padding:20px 22px;margin:0;font-size:17px;font-weight:750}.meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:18px;color:var(--muted);font-size:13px}.body{padding:42px 54px 48px}.body h2{font-size:26px;line-height:1.4;letter-spacing:-.025em;margin:54px 0 16px;color:var(--navy)}.body h2:first-of-type{margin-top:32px}.body h3{font-size:19px;color:var(--navy);margin:24px 0 10px}.body p{margin:0 0 18px}.body strong{color:var(--navy);font-weight:900}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 28px}.summary-grid div{border:1px solid var(--line);background:var(--soft);border-radius:12px;padding:18px}.summary-grid strong{display:block;margin-bottom:5px;color:var(--gold)}.toc{border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px 20px;margin:24px 0}.toc strong{display:block;margin-bottom:8px}.toc a{color:var(--navy2);font-size:14px;margin-right:14px}.table-wrap{overflow-x:auto;margin:20px 0 26px;border:1px solid var(--line);border-radius:12px;background:#fff}table{width:100%;border-collapse:collapse;min-width:680px}th,td{padding:15px 17px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}thead th{background:var(--navy);color:#fff;font-size:14px}tbody th{width:190px;background:var(--soft);color:var(--navy)}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}.callout,.example-box,.case-box,.warning,.related-card{border-radius:14px;padding:22px 24px;margin:26px 0}.callout{background:#eef5ff;border:1px solid #c9ddfa}.example-box{background:var(--gold-soft);border:1px solid #ead9a8}.case-box{background:#fff;border:1px solid var(--gold);box-shadow:0 12px 30px rgba(184,146,42,.1)}.case-box a,.related-card a{color:var(--navy);font-size:18px;font-weight:900}.related-card{background:var(--soft);border:1px solid var(--line)}.source-list{padding-left:22px}.source-list li{margin:8px 0}.source-list a{color:var(--navy2);font-weight:800}.warning{background:#fff2f3;border:1px solid #f1c8cd}.label{display:inline-block;font-size:12px;font-weight:900;color:#755712;margin-bottom:8px}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.steps div{background:#fff;border:1px solid rgba(184,146,42,.28);border-radius:10px;padding:15px}.steps b{display:block;color:var(--gold);margin-bottom:5px}.faq details{border-top:1px solid var(--line);padding:16px 2px}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-weight:850;color:var(--navy)}.faq details p{margin:10px 0 2px;color:#475467}.local{background:var(--soft);border-left:4px solid var(--gold);padding:18px 20px;margin:24px 0}.cta{margin-top:36px;padding:26px;border-radius:14px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff}.cta a{display:inline-block;color:#f4d98d;font-weight:900;margin-right:16px}.editorial{border-top:1px solid var(--line);background:var(--soft);padding:24px 54px;color:#475467;font-size:14px}.editorial a{color:var(--navy);font-weight:800}.footer{padding:30px 0;color:var(--muted);font-size:13px}.small{font-size:13px;color:var(--muted)}@media(max-width:720px){.top .site-wrap{align-items:flex-start;flex-direction:column;padding-top:15px;padding-bottom:15px}.head,.body,.editorial{padding-left:22px;padding-right:22px}.head{padding-top:38px}.summary-grid,.steps{grid-template-columns:1fr}.body h2{font-size:23px}.answer{font-size:16px}.page{padding-top:16px}.toc a{display:block;margin:5px 0}table{min-width:620px}}
</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<header class="top"><div class="site-wrap"><a class="brand" href="/">전주변호사 법률칼럼 · 법무법인 태앤규</a><a class="home-link" href="https://taeandkyu.com/">전주변호사 공식 홈페이지 →</a></div></header>
<main class="page"><div class="site-wrap"><nav class="crumb" aria-label="이동 경로"><a href="/">법률칼럼</a> &gt; ${esc(item.category)} &gt; ${esc(item.searchKeyword)}</nav><article class="article">
<figure class="hero-img"><img src="${esc(item.image)}" alt="${esc(item.imageAlt)}" width="1200" height="630" fetchpriority="high"></figure>
<header class="head"><span class="badge">${esc(item.category)} · JEONJU</span><h1>${esc(item.title)}</h1><p class="answer">결론부터 말하면, ${esc(item.point)}</p><div class="meta"><span>콘텐츠 운영: 법무법인 태앤규</span><span>최종 업데이트: ${publishDate}</span><span>상담지역: 전주·완주·군산·익산</span></div></header>
<section class="body">
<div class="summary-grid"><div><strong>누가 읽어야 하나요?</strong>${esc(topicTitle)} 문제로 상담을 준비하는 분</div><div><strong>가장 먼저 볼 것</strong>현재 절차와 남은 기한</div><div><strong>핵심 준비</strong>${esc(item.materials)}</div></div>
<nav class="toc" aria-label="본문 목차"><strong>빠르게 보기</strong><a href="#checklist">준비자료</a><a href="#questions">상담 질문</a><a href="#example">각색한 실제 상담사례</a><a href="#case">실제 수행사례</a><a href="#sources">공식 자료</a><a href="#related">관련 칼럼</a><a href="#faq">자주 묻는 질문</a></nav>
<p>${esc(item.searchKeyword)}를 찾는 분들은 사건이 진행된 뒤 급하게 상담하는 경우가 많습니다. 그러나 ${esc(topicTitle)}은 결론부터 정하기보다 <strong>지금 어느 단계인지, 상대방 주장이 무엇인지, 다음 기한이 언제인지</strong>를 먼저 구분해야 합니다.</p>
<p>전주 지역에서 진행되는 사건도 사실관계와 증거에 따라 선택지가 달라집니다. 유리한 설명만 준비하기보다 불리할 수 있는 자료까지 함께 확인해야 상담 이후의 방향이 바뀌는 일을 줄일 수 있습니다.</p>
<h2 id="checklist">상담 전에 어떤 자료를 준비해야 할까요?</h2>
<div class="table-wrap"><table><thead><tr><th>확인 항목</th><th>정리할 내용</th></tr></thead><tbody><tr><td>핵심 자료</td><td>${esc(item.materials)}</td></tr><tr><td>사건 순서</td><td>문제가 시작된 날부터 현재까지 날짜순으로 작성한 메모</td></tr><tr><td>상대방 주장</td><td>동의하는 부분과 사실과 다른 부분을 구분한 목록</td></tr><tr><td>남은 기한</td><td>조사·답변·제출·이의신청 등 예정된 날짜</td></tr></tbody></table></div>
<p>자료는 양보다 연결 관계가 중요합니다. 메모 옆에 “이 사실은 문자 3번”, “이 금액은 계좌내역 2쪽”처럼 근거를 표시하면 상담에서 핵심을 빠르게 찾을 수 있습니다. 원본은 보존하고 제출용 사본을 따로 만드는 것이 안전합니다.</p>
<div class="callout"><strong>이번 글의 핵심</strong><p>${esc(item.point)}</p></div>
<h2 id="questions">실제 상담에서는 무엇을 확인하나요?</h2>
<p>상담 시간에 사건 전체를 처음부터 길게 설명하기보다 아래 질문에 대한 답을 준비하면 현재 쟁점과 우선순위를 더 빨리 나눌 수 있습니다.</p>
<div class="table-wrap"><table><thead><tr><th>상담 질문</th><th>확인하는 이유</th></tr></thead><tbody>${consultationRows}</tbody></table></div>
<h2 id="example">실제 상담을 바탕으로 각색한 사례</h2>
<div class="example-box"><span class="label">개인정보 보호를 위해 일부 각색한 실제 상담사례</span><h3>전주 지역 A씨의 상담 사례</h3><p>A씨는 ${esc(topicTitle)} 문제로 상담을 요청했습니다. 처음에는 본인에게 유리한 대화만 준비했지만, 상담 과정에서 상대방 주장과 절차상 기한을 함께 확인하면서 우선 처리할 일이 달라졌습니다.</p><div class="steps"><div><b>1. 상황 구분</b>현재 단계와 남은 기한을 먼저 확인했습니다.</div><div><b>2. 자료 연결</b>${esc(item.materials)}을 사실관계 순서에 맞춰 배치했습니다.</div><div><b>3. 대응 선택</b>즉시 할 일과 추가 확인 후 결정할 일을 나누었습니다.</div></div><p class="small">실제 상담에서 반복적으로 확인되는 사건 유형을 바탕으로 여러 사례를 결합했습니다. 특정 의뢰인을 알아볼 수 없도록 이름·지역·금액·시점과 세부 경위를 변경·재구성했으며, 특정 사건을 그대로 나타내지 않습니다.</p></div>
<h2 id="case">관련 실제 수행사례</h2>
<div class="case-box"><span class="label">법무법인 태앤규 홈페이지 공개 사례</span><p><a href="${esc(item.successCase.url)}">${esc(item.successCase.title)} →</a></p><p>${esc(item.successCase.summary)} 구체적인 사실관계와 대응 내용은 사례 원문에서 확인할 수 있습니다.</p><p class="small">과거 수행사례의 결과는 다른 사건에 동일하게 적용되지 않으며, 사건 결과를 보장하지 않습니다.</p></div>
<h2>특히 주의할 점</h2>
<div class="warning"><strong>주의</strong><p>${esc(item.caution)}</p></div>
<p>인터넷의 일반적인 설명은 준비 방향을 잡는 데에는 도움이 되지만, 개별 사건의 결론을 대신할 수 없습니다. 실제 자료와 현재 절차를 기준으로 가능한 선택지, 예상되는 부담, 추가로 필요한 증거를 나누어 확인해야 합니다.</p>
<div class="local"><strong>전주·완주·군산·익산 지역 상담</strong><p>법무법인 태앤규는 전주 완산구 사무실을 중심으로 전주지방법원 관할과 전북 지역 사건을 상담합니다. 사건 관할, 조사기관, 재판 일정에 따라 구체적인 진행 방법을 안내합니다.</p></div>
<h2 id="sources">근거로 확인할 공식 자료</h2><ul class="source-list">${officialSourceHtml}</ul><p class="small">법령은 개정될 수 있으므로 실제 상담 시에는 사건 시점에 적용되는 조문과 시행일을 다시 확인합니다.</p>
<h2 id="related">함께 읽을 전주 법률칼럼</h2><div class="related-card"><a href="${esc(item.pillarUrl)}">${esc(item.pillarTitle)} →</a><p>해당 분야의 상담 준비 순서와 핵심 자료를 한 번에 정리한 기본 안내 글입니다.</p></div>
<h2 id="faq">자주 묻는 질문</h2><div class="faq">${faqHtml}</div>
<div class="cta"><p><strong>${esc(item.category)} 상담 전 자료와 기한부터 확인하세요.</strong></p><p><a href="${esc(item.practiceUrl)}">${esc(item.category)} 업무분야 보기</a><a href="https://taeandkyu.com/">전주변호사 법무법인 태앤규 공식 홈페이지</a></p></div>
</section><section class="editorial"><strong>콘텐츠 제작 방식</strong><p>법무법인 태앤규가 실제 상담에서 반복되는 질문과 공개 법령·절차를 바탕으로 주제와 확인 기준을 구성했습니다. 자동화는 정해진 형식에 따른 게시·메타·링크 검사를 담당하며, 개별 사건의 법률 판단과 결과를 대신하지 않습니다.</p><p><a href="https://taeandkyu.com/page/page16.php">김기태 대표변호사 경력 확인</a> · 법령·제도 변경 시 내용을 갱신합니다.</p></section></article></div></main>
<footer class="footer"><div class="site-wrap">본 글은 일반적인 법률 정보이며, 개별 사건의 결과를 보장하지 않습니다.</div></footer>
</body></html>
`;
};

mkdirSync('blog', { recursive: true });

let publishedCount = 0;
for (const post of posts) {
  const file = `blog/${post.slug}.html`;
  if (existsSync(file)) {
    console.log(`Already published ${file}`);
    continue;
  }

  writeFileSync(file, renderPost(post), 'utf8');
  publishedCount += 1;
  console.log(`Scheduled publish completed for ${publishDate} (${post.key}): ${file}`);
}

console.log(`Scheduled publish summary for ${publishDate}: ${publishedCount}/${posts.length} new post(s)`);
