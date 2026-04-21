---
id: N05
title: Generated Image Aspect Ratio Fix
date: 2026-04-21
status: active
---

# N05 — 생성 이미지 비율 불일치 버그 수정

## 문제 정의

생성된 평면도 이미지의 비율이 소스 아트보드 비율과 다르게 출력됨.

### 원인 (3개 레이어)

| # | 레이어 | 원인 |
|---|--------|------|
| 1 | **API (route.ts)** | Gemini에 아트보드 치수 미전달 → 모델이 자체 기본 규격(예: 1024×1024)으로 생성 |
| 2 | **클라이언트 배치 (page.tsx)** | `generatedPlanImage` effect에서 `planItem.width/height`를 `sourceArtboardSize`로 고정 설정. 실제 생성 이미지의 intrinsic 치수 미감지 |
| 3 | **렌더 (page.tsx JSX)** | `sketch_generated` img 태그에 `object-cover` 사용 → 컨테이너에 맞춰 이미지 크롭·왜곡 |

## 해결 방안

### Step 1 — API에 아트보드 비율 전달 (route.ts)
- 요청 body에 `artboard_width`, `artboard_height` 추가
- Generation Room 프롬프트에 비율 지시 추가:
  ```
  "출력 이미지의 가로:세로 비율은 {artboard_width}:{artboard_height}와 동일해야 합니다."
  ```

### Step 2 — Hook에 치수 파라미터 추가 (usePlanGeneration.ts)
- `PlanGenerationParams`에 `artboardWidth?: number`, `artboardHeight?: number` 추가
- fetch body에 `artboard_width`, `artboard_height` 포함

### Step 3 — generate() 호출 시 치수 전달 (page.tsx)
- `handleGenerate`에서 `artboardWidth: item.width, artboardHeight: item.height` 전달

### Step 4 — 생성 이미지 intrinsic 치수 감지 후 배치 (page.tsx)
- `generatedPlanImage` effect에서 `new Image()` 로 실제 W×H 감지
- `planItem.width = detected.width`, `planItem.height = detected.height` 사용
- (fallback: `sourceArtboardSize`)

### Step 5 — object-cover → object-fill (page.tsx JSX)
- 컨테이너 치수 = 이미지 intrinsic 치수이므로 크롭 불필요
- `object-cover` → `object-fill` 또는 CSS 제거

## 수정 파일

- `sketch-to-plan/src/app/api/sketch-to-plan/route.ts`
- `sketch-to-plan/src/hooks/usePlanGeneration.ts`
- `sketch-to-plan/src/app/page.tsx`
