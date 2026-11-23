# assets-src — 슬라이드 이미지 원본

`public/media/`에 들어가는 이미지는 용량을 줄이려고 잘라내거나 WebP로 압축한 것입니다. 이 폴더에는 그 원본과 다시 만들 수 있는 소스를 보관합니다. 빌드 대상이 아니라서 `dist/`에는 복사되지 않습니다.

> 이 저장소는 공개 저장소입니다. 고객사명, 실제 프로젝트명, 개인 이름이나 프로필 사진이 보이는 원본은 그대로 올리지 말고, 가린 뒤 보관하세요.

## workspace/ — NOVA Workspace 화면 시안 (4·11·12·13장)

| 파일 | 내용 |
| --- | --- |
| `screens.html` | 화면 시안 소스. 레이아웃, 문구(KO/EN), 예시 데이터가 모두 여기 있습니다. `?screen=overview\|waves\|alarms\|roles\|schedules&lang=ko\|en` |
| `png/*.png` | 2배 해상도로 렌더링한 무손실 원본 |
| `legacy/*.webp` | 2026-11-23 개편 전에 쓰던 이전 시안 (참고용) |

수정 후 `npm run screens`(특정 화면만: `node scripts/workspace-screens.mjs roles`)를 실행하면 `png/`와 `public/media/workspace/*.webp`가 함께 갱신됩니다. 각 화면의 CSS 해상도는 슬라이드 이미지 칸 비율에 맞춰 `scripts/workspace-screens.mjs`의 `SPECS`에 정해져 있습니다.

| 출력 | CSS 해상도 (×2 렌더링) | 사용 위치 |
| --- | --- | --- |
| `waves-wide-*` | 1920×1011 (1.9:1) | 4장 |
| `overview-*` | 1440×1058 (1.36:1) | 11장 |
| `waves-*`, `alarms-*` | 1600×860 (1.86:1) | 12장 |
| `roles-*`, `schedules-*` | 1600×860 (1.86:1) | 13장 |

## studio/ — NOVA Studio 화면 캡처 (4장)

| 파일 | 내용 |
| --- | --- |
| `alarm-layout-original.png` | Studio 운영 화면(Glass Horizon) 캡처 원본 3690×2172 |
| `operations-light-original.png` | Studio 운영 화면(Glass Horizon, 라이트 테마) 캡처 원본 3690×2172. 고객사 현장명을 `샘플 물류센터 B동`으로 교체 (배경색으로 덮고 같은 폰트로 다시 씀) |
| `layout-alarm-original.png` | Studio 3D 배치도 알람 화면(운영 진행 패널) 캡처 원본 3690×2172. 3D 공간 뷰 라벨의 고객사 현장명을 `샘플 물류센터 A동 3F`로 교체 (글자 픽셀만 주변으로 채운 뒤 같은 회색으로 다시 씀) |
| `legacy/alarm-layout-original.png` | 이전에 쓰던 3D 배치도 알람 캡처 (상단 바의 이름·프로필 사진·프로젝트 파일명 가림) |

공개 저장소라서 원본 좌측 상단의 고객사 현장명은 지우고, 같은 폰트(Pretendard Bold 54px, #f5f5f5)로 `샘플 물류센터 A동 3F`를 다시 써 넣었습니다. 지운 자리는 주변 픽셀로 채운 뒤 글자 아래에 옅은 그림자를 깔았고, 나머지는 원본 그대로입니다.

`public/media/studio/alarm-layout.webp`는 위 원본에서 브라우저 창 테두리를 빼고 4장 이미지 칸 비율(1.9:1)로 잘라낸 것입니다.

- 자른 영역(원본 픽셀): x 113–3576, y 167–1990 → 3463×1823
- WebP 품질 86

`public/media/studio/operations-light.webp`(17장)는 `operations-light-original.png`에서 창 테두리를 빼고 17장 이미지 칸 비율(1.85:1)로 잘라낸 것입니다.

- 자른 영역(원본 픽셀): x 127–3562, y 151–2008 → 3435×1857
- WebP 품질 86

`public/media/studio/layout-alarm.webp`(16장)는 `layout-alarm-original.png`에서 창 테두리(파란 포커스 테두리 포함)를 빼고 1.85:1로 잘라낸 것입니다.

- 자른 영역(원본 픽셀): x 132–3556, y 157–2008 → 3424×1851
- WebP 품질 86
