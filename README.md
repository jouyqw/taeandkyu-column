# taeandkyu-column

법무법인 태앤규 칼럼 자동화 사이트입니다.

운영 주소:

```txt
https://column.taeandkyu.com/
```

새 칼럼은 `blog/` 폴더에 HTML 파일로 추가합니다.
GitHub Actions가 `sitemap.xml`과 `rss.xml`을 자동으로 갱신합니다.

## 검색엔진 제출

- 네이버: 변경된 URL만 IndexNow로 자동 알림합니다.
- Google: `GSC_SERVICE_ACCOUNT_JSON` 저장소 Secret이 설정되어 있으면 변경된 사이트맵만 Search Console API로 제출합니다.
- 메인 사이트용 IndexNow 키 파일 `1c271ef7c79c4a3abc5b43a40dc1e3b8.txt`는 `https://taeandkyu.com/` 루트에 있어야 합니다.
- 일반 법률 페이지의 Google 개별 색인 요청은 공식 API 대상이 아니므로 Search Console의 URL 검사 화면에서 1회 수동 요청합니다.
