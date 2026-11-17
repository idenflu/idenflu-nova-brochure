# NOVA 브로슈어

아이덴플루 NOVA(WES/WCS 통합 플랫폼) 소개용 웹 슬라이드 덱입니다. 빌드 과정 없이 `index.html` 한 파일로 동작합니다.

## 파일 구성

| 파일 | 용도 |
| --- | --- |
| `index.html` | 슬라이드 본문, 스타일, 뷰어 스크립트 |
| `nova-symbol.png` | 파비콘 · 홈 화면 아이콘 |
| `og-image.png` | 링크 공유 미리보기 이미지 (1200×630, 표지 슬라이드 캡처) |

## 로컬에서 보기

`index.html`을 브라우저로 바로 열거나, 정적 서버로 띄웁니다.

```sh
npx serve .
# 또는
python3 -m http.server 8000
```

## 뷰어 사용법

| 동작 | 키 · 입력 |
| --- | --- |
| 이전 / 다음 슬라이드 | ← → · Page Up / Page Down · Space (Shift+Space: 이전) · 휠 · 스와이프 |
| 처음 / 마지막 | Home / End |
| 목차 | O 또는 하단 쪽 번호 버튼 |
| 전체화면 | F |
| 특정 슬라이드 링크 | `index.html#slide-7` |

- 화면 폭 900px 이하에서는 슬라이드가 세로로 스크롤되는 읽기 모드로 바뀝니다.
- 브라우저 인쇄(⌘P / Ctrl+P)로 슬라이드 한 장당 한 쪽(1440×810)인 PDF를 만들 수 있습니다.

## 슬라이드 추가 · 수정

각 슬라이드는 `<main class="deck">` 안의 `<section class="page">` 하나입니다. 기존 슬라이드를 복사해 시작하는 것이 가장 쉽습니다.

```html
<section class="page" aria-labelledby="example-title" tabindex="-1" aria-roledescription="슬라이드" hidden>
  <header class="topline">…</header>
  <div class="content"> … <h2 id="example-title">제목</h2> … </div>
  <footer class="footer"><span>IDENFLU · COMPANY &amp; SOLUTIONS</span><span class="footer-topic">TOPIC</span><span class="footer-page"></span></footer>
</section>
```

- **첫 슬라이드를 뺀 나머지에는 `hidden`을 붙입니다.**
- 쪽 번호(`.footer-page`, 하단 컨트롤)는 슬라이드 순서대로 자동으로 채워지므로 직접 적지 않습니다.
- 목차(O)의 항목 이름은 각 슬라이드의 첫 `h1`/`h2`에서 가져옵니다.
- 어두운 배경 슬라이드는 `class="page theme-dark"`를 씁니다.
- 슬라이드는 1440×810 기준으로 디자인하고 화면 크기에 맞춰 축소·확대됩니다. 내용이 이 높이를 넘지 않는지 확인하세요.

## 배포

정적 파일 3개(`index.html`, `nova-symbol.png`, `og-image.png`)를 그대로 올리면 됩니다(GitHub Pages, Netlify, S3 등). `#slide-N` 해시 주소를 쓰므로 서버 리라이트 설정은 필요 없습니다.

배포 주소가 정해지면 `index.html`의 `og:image`를 절대 주소(예: `https://<도메인>/og-image.png`)로 바꾸고, `og:url`도 추가하세요. 대부분의 메신저·SNS 미리보기는 상대 경로 이미지를 읽지 못합니다.

### 공유 미리보기 이미지 다시 만들기

표지 슬라이드를 바꿨다면 `og-image.png`도 다시 만듭니다. 1440×888 창에서 표지를 캡처한 뒤 위아래를 잘라 1200×630으로 줄입니다.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1440,888 --virtual-time-budget=2000 \
  --screenshot=cover.png "file://$PWD/index.html#slide-1"
python3 -c "from PIL import Image; Image.open('cover.png').convert('RGB').crop((0,27,1440,783)).resize((1200,630), Image.LANCZOS).save('og-image.png', optimize=True)"
rm cover.png
```
