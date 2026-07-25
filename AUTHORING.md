# 일일 칼럼 발행 플레이북 — column.taeandkyu.com

이 문서는 매일 자동 세션(클라우드)이 그대로 따라 실행하는 지침입니다.
목표: **변호사가 직접 쓴 것 같은 고품질 칼럼 3개**를 매일 발행 (형사·이혼·민사 각 1개).
자동화 티가 나는 문구(“자동 발행”, “콘텐츠 제작 방식” 등)는 **넣지 않습니다.**

## 매일 실행 순서

1. 저장소 루트에서 시작합니다. 오늘 날짜(KST, `YYYY-MM-DD`)를 확인합니다.
2. `blog/` 의 기존 파일명을 확인해 이미 다룬 주제를 파악합니다.
3. `content/topic-bank.json` 에서 형사·이혼·민사 각 1개씩, **아직 blog/에 없는** 주제를 고릅니다.
   - 후보가 모두 소진되면 실제 상담에서 자주 나오는 새 주제를 직접 만듭니다(슬러그 중복 금지).
4. 각 분야마다 `content/drafts/<slug>.json` 초안을 작성합니다(아래 형식·품질 기준).
5. 렌더링: `node scripts/author/render-article.mjs content/drafts/<slug>.json`
6. 피드 재생성: `node scripts/generate-feeds.js`
7. 품질 게이트: `node scripts/seo-audit.mjs` — **반드시 통과**해야 합니다. 실패 시 원인을 고쳐 다시 실행.
8. 커밋 & 푸시:
   ```
   git add blog index.html sitemap.xml rss.xml content/drafts
   git commit -m "칼럼 발행: <오늘 날짜> 형사·이혼·민사"
   git push
   ```
   push 하면 Cloudflare 자동 배포 + GitHub Actions가 검색엔진(구글·네이버) 제출까지 처리합니다.

## 초안 JSON 형식

```json
{
  "category": "criminal | divorce | civil",
  "slug": "criminal-example-topic",        // 영문·소문자·하이픈, 분야 접두사 필수, 날짜 붙이지 말 것
  "keyword": "전주형사전문변호사",           // 분야 기본: 형사=전주형사전문변호사, 이혼=전주이혼변호사, 민사=전주민사변호사
  "date": "2026-07-25",
  "title": "전주형사전문변호사, 핵심 주제",   // 반드시 50자 이하(렌더러가 ' | 법무법인 태앤규' 자동 추가)
  "description": "45~160자 사이 요약. 키워드 자연스럽게 1회 포함.",
  "lead": "결론부터 말씀드리면, ...",         // 한두 문장 결론 요약
  "bodyHtml": "<p>...</p><h2>...</h2>...",   // 아래 품질 기준 참고
  "faqs": [{"q":"...","a":"..."}, ... 3개],
  "related": [{"href":"/blog/<기존 슬러그>","label":"..."}, ... 2개]  // 반드시 실제 존재하는 글로 연결
}
```

## 품질 기준 (seo-audit 통과 조건 + 사람 다움)

- **문체**: 변호사가 상담 경험을 바탕으로 직접 쓰는 칼럼 톤. “실무에서 보면”, “상담을 하다 보면” 같은 자연스러운 표현. 정형화된 반복 금지.
- **가독성(모바일 우선)**: 한 문단은 1~2문장. 긴 문단 금지. 문단을 자주 나눕니다.
- **분량**: 본문 텍스트 **1,800자 이상**(권장 2,000~2,600자).
- **구조**: `<h1>`은 렌더러가 제목으로 자동 생성하므로 bodyHtml에는 넣지 말 것. **`<h2>`는 4개 이상**(권장 5~6개, 번호로 시작하면 깔끔).
- **비주얼 1개 이상**: `.infographic`(아이콘 카드), `.table-wrap` 표, `.callout`, `.warning` 중 최소 1개를 본문에 포함해 “깔끔하고 세련된 이미지”를 넣습니다. 인포그래픽 아이콘은 인라인 SVG(속성은 홑따옴표)로 작성.
- **키워드**: 분야 키워드를 본문에 자연스럽게 4~8회. 억지로 반복(키워드 스터핑) 금지.
- **중복 방지**: 다른 글과 제목·description 동일 금지, 본문 유사도 82% 미만(seo-audit이 자동 검사). 매번 다른 각도·사례로.
- **법률 준수**: 결과 보장·단정 표현 금지. 일반적 정보 안내로 작성(렌더러가 하단 면책 문구 자동 추가). 사례는 특정인 식별 불가하도록 각색.
- **내부링크**: related는 실제 존재하는 슬러그로만. 없는 파일로 링크하면 seo-audit이 실패합니다.

## 비주얼 스니펫 예시 (인포그래픽)

```html
<div class="infographic"><div class="infographic-h">제목</div><div class="ig-grid">
  <div class="ig-item"><span class="ig-ic"><svg viewBox='0 0 24 24' width='21' height='21' fill='none' stroke='currentColor' stroke-width='1.8'><circle cx='12' cy='8' r='3.6'/><path d='M4.5 20c0-3.6 3.6-5.6 7.5-5.6s7.5 2 7.5 5.6'/></svg></span><div><b>항목</b><span class="t">설명</span></div></div>
  ... (2~4개)
</div></div>
<p class="figure-note">▲ 캡션</p>
```

`.callout`(파란 강조), `.warning`(빨간 주의)도 `<span class="label">라벨</span><p>내용</p>` 형태로 사용합니다.
