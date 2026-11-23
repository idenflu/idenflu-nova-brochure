# NOVA 브로슈어

아이덴플루 NOVA(WES/WCS 통합 플랫폼) 소개용 웹 슬라이드 덱입니다. `src/`의 원본을 작은 Node 빌드 스크립트로 합쳐, 언어별로 HTML 한 파일씩 `dist/`에 만듭니다. 외부 프레임워크는 쓰지 않습니다.

## 시작하기

Node.js 20 이상이 필요합니다.

```sh
npm install          # Pretendard 글꼴 패키지 설치 (최초 1회)
npm run dev          # 빌드 + 변경 감지 + http://localhost:5173 로컬 서버
npm run build        # dist/ 한 번 빌드 (전체 23장)
npm run build:public # 준비 중 플레이스홀더 슬라이드를 제외한 대외 배포본 빌드
npm run build:pdf    # 웹 덱 + 1440×810 공식 PDF(ko/en) 함께 빌드
npm run check        # 슬라이드 구조 · 에셋 · HTML 정적 검증
npm run og           # 공유 미리보기 이미지(og-image*.png) 재생성
npm run watch        # 서버 없이 빌드 + 변경 감지
```

`dev` 서버는 자동 새로고침을 하지 않으므로 수정 후 브라우저를 새로고침하세요.

## 폴더 구성

```
src/
  template.html        문서 뼈대 (head, 하단 컨트롤, 목차 대화상자)
  styles.css           전체 스타일
  viewer.js            슬라이드 뷰어 스크립트
  locales/ko.json      언어별 메타 정보 · UI 문구 · 출력 경로
  locales/en.json
  slides/ko/NN-이름.html   슬라이드 한 장 = 파일 하나 (파일명 순서대로 이어 붙임)
  slides/en/NN-이름.html
  partials/*.svg       여러 슬라이드에서 쓰는 큰 일러스트
public/                그대로 dist/에 복사되는 정적 파일 (브랜드·공유 이미지, 제품 화면, 시연 영상)
scripts/
  build.mjs            빌드 · 감시 · 로컬 미리보기 서버 (`--public-only`, `--with-pdf` 지원)
  build-pdf.mjs        웹 덱 + 1440×810 공식 PDF(ko/en) 함께 생성
  check.mjs            슬라이드 구조 · 에셋 · HTML 정적 검증
  og-image.mjs         공유 미리보기 이미지(1200×630) 생성
dist/                  빌드 결과 (git에 올리지 않음)
  index.html           한국어
  en/index.html        영어
  fonts/pretendard/    Pretendard 글꼴 (SIL OFL 1.1, 사용하는 글자 묶음만 내려받는 dynamic subset)
```

## 뷰어 사용법

| 동작 | 키 · 입력 |
| --- | --- |
| 이전 / 다음 슬라이드 | ← → · Page Up / Page Down · Space (Shift+Space: 이전) · 휠 · 스와이프 |
| 처음 / 마지막 | Home / End |
| 목차 (썸네일 · 검색) | O 또는 하단 목차 버튼 (키워드 검색 필터 지원) |
| 전체화면 | F (발표 중 미조작 시 하단 컨트롤 자동 흐림) |
| 발표자 노트 | Shift+N 또는 `?notes` 쿼리 파라미터 (인쇄·기본 공유 뷰에는 미노출) |
| 현재 슬라이드 링크 복사 | 하단 링크 버튼 |
| PDF 다운로드 · 인쇄 | P 또는 하단 인쇄/PDF 버튼 (공식 PDF 포함 빌드 시 즉시 다운로드) |
| 이미지 확대 보기 | 제품 이미지 클릭 또는 포커스 후 Enter/Space |
| 언어 전환 | 하단 EN / KO 버튼 (현재 슬라이드와 전체화면 유지) |
| 특정 슬라이드 링크 | `index.html#slide-7`, `en/index.html#slide-7` |
| 고객사 맞춤 표지/PDF | `CLIENT="○○물류" npm run build:pdf` |

- 상단 진행률 바로 전체 위치가 표시되며, 목차(O)는 챕터별로 묶여 표시됩니다.
- 슬라이드는 옆으로 밀려나며 넘어갑니다(약 0.6초). 키를 꾹 누르고 있거나 시스템의 '동작 줄이기'가 켜져 있으면 바로 바뀝니다.
- 목차 상단에서 제품 구성, NOVA 실행과 연동, Workspace, Studio, 도입 사례, 문의 슬라이드로 바로 이동할 수 있습니다.
- 문의 슬라이드에서는 메일 열기 링크와 함께 이메일 주소 복사 버튼을 제공합니다.
- 화면 폭 900px 이하에서는 세로로 스크롤되는 읽기 모드로 바뀌고, 각 페이지 하단에 다음 슬라이드 이동 버튼이 표시됩니다.
- 슬라이드를 차례로 넘길 때는 브라우저 기록이 쌓이지 않습니다. 목차에서 이동하거나 Home/End로 점프할 때만 기록이 남으므로, 뒤로가기는 직전에 보던 위치나 덱 이전 페이지로 돌아갑니다.
- 영상에 포커스가 있으면 방향키와 스페이스는 영상에서 동작합니다. 다른 장으로 이동하면 재생이 멈춥니다.
- 하단 인쇄 버튼이나 브라우저 인쇄(⌘P / Ctrl+P)로 슬라이드 한 장당 한 쪽(1440×810)인 PDF를 만들 수 있습니다.

## 슬라이드 추가 · 수정

각 슬라이드는 `src/slides/<언어>/` 안의 파일 하나이고, 파일명 순서대로 이어 붙습니다. 기존 파일을 복사해 시작하는 것이 가장 쉽습니다. 순서를 바꾸려면 파일명 앞 번호를 바꾸세요.

```html
<section class="page" aria-labelledby="example-title" tabindex="-1" aria-roledescription="슬라이드" hidden>
  <header class="topline">…</header>
  <div class="content"> … <h2 id="example-title">제목</h2> … </div>
  <footer class="footer"><span class="footer-page"></span></footer>
</section>
```

- **첫 슬라이드를 뺀 나머지에는 `hidden`을 붙입니다.**
- 쪽 번호(`.footer-page`, 하단 컨트롤)는 순서대로 자동으로 채워지므로 직접 적지 않습니다.
- 목차의 제목은 각 슬라이드의 첫 `h1`/`h2`에서 가져옵니다.
- 어두운 배경 슬라이드는 `class="page theme-dark"`를 씁니다.
- 슬라이드는 1440×810 기준으로 디자인하고 화면 크기에 맞춰 축소·확대됩니다. 내용이 이 높이를 넘지 않는지 확인하세요. 영어 문장은 한국어보다 길어지기 쉬우니 특히 주의합니다.
- **언어별 슬라이드 파일명 목록을 일치시킵니다.** 빌드는 기본 언어를 기준으로 각 번역의 누락·추가 파일을 검사합니다. 슬라이드를 추가하거나 순서를 바꿀 때는 모든 언어에서 같은 파일명을 사용하세요.

### 공용 일러스트 (partials)

큰 SVG는 `src/partials/`에 두고 슬라이드에서 불러옵니다. 언어마다 다른 문구는 매개변수로 넘깁니다.

```html
<!--@include partials/warehouse-scene-dark.svg aria-label="자동창고 랙과 컨베이어 …"-->
```

partial 안의 `{{aria-label}}`처럼 `{{이름}}`으로 적힌 자리가 넘긴 값으로 바뀝니다. 필요한 값을 빠뜨리면 빌드가 실패합니다.

### 언어 추가

1. `src/locales/<lang>.json`을 만듭니다(`ko.json`을 복사해 `lang`, `output`, `languageName`, `languageShort`, 문구를 바꿉니다).
2. `src/slides/<lang>/`에 슬라이드를 둡니다.
3. 빌드하면 하단 컨트롤에 언어 전환 버튼과 `<link rel="alternate" hreflang>`이 자동으로 생깁니다.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 `dist/`를 빌드해 GitHub Pages에 배포합니다. Actions 탭에서 수동으로 실행할 수도 있습니다(workflow_dispatch).

처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔야 합니다.

다른 정적 호스팅(Netlify, S3 등)을 쓸 때는 `npm run build` 후 `dist/` 폴더 전체를 올리면 됩니다. `#slide-N` 해시 주소를 쓰므로 서버 리라이트 설정은 필요 없습니다.

공유 미리보기(`og:image`, `og:url`), `canonical`, `hreflang`은 `package.json`의 `homepage`(현재 `https://idenflu.github.io/idenflu-nova-brochure/`)를 기준으로 절대 주소로 만들어집니다. 대부분의 메신저·SNS 미리보기와 검색엔진은 상대 경로를 제대로 읽지 못하기 때문입니다. 배포 주소가 바뀌면(사용자 지정 도메인 등) `homepage`를 고치거나 빌드할 때 `SITE_URL=https://… npm run build`로 덮어쓰세요.

### 공유 미리보기 이미지 다시 만들기

표지 슬라이드나 전체 장수를 바꿨다면 `public/og-image.png`(한국어)와 `public/og-image-en.png`(영어)를 다시 만듭니다. Google Chrome과 Python Pillow가 필요합니다.

```sh
npm run og
```
