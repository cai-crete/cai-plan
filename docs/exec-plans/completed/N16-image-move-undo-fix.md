---
id: N16
title: 이미지 편집 모드 — 이동 미작동 수정 + undo/redo 지원
status: active
date: 2026-04-22
---

## 문제 1: 이미지 이동 미작동

### 원인
아트보드 div 내부 DOM 렌더 순서:
1. `<img>` (img-move-area) — z-index auto
2. Handles overlay div (pointer-events: none, z-index: 10)
3. **Scale div** (position: absolute, inset: 0, z-index: auto, 명시적 pointer-events 없음)

CSS 기본 stacking: 후순위 DOM 요소가 앞. Scale div가 img 위를 덮어
사용자가 img 클릭 시 e.target = scale div → `img-move-area` 클래스 감지 실패.

### 수정
Scale div에 이미지 편집 모드 시 `pointerEvents: 'none'` 추가:
```tsx
<div
  style={{
    ...
    pointerEvents: imageEditingId === item.id ? 'none' : undefined,
  }}
>
```
이미지 편집 모드에서 scale div의 pointer-events를 none으로 설정하면
클릭이 img까지 통과됨. (grid/canvas는 이미 pointer-events: none이므로 동작 무관)

## 문제 2: undo/redo 미반영

### 원인
image transform(move/resize/rotate) pointerDown 시 `setHistoryStates` 미호출.
transform 중 `setCanvasItems`만 업데이트 → "이전" 스냅샷이 없어 undo 불가.

### 수정
각 transform 시작 (line ~702 rotate, ~731 resize, ~751 move) 직전에 추가:
```ts
setHistoryStates(h => [...h, canvasItemsRef.current]);
setRedoStates([]);
```

## 변경 파일
- `sketch-to-plan/src/app/page.tsx`
  - Scale div: `pointerEvents: imageEditingId === item.id ? 'none' : undefined`
  - Rotate start: history push 추가
  - Resize start: history push 추가
  - Move start: history push 추가

## 완료 기준
- 이미지 편집 모드에서 이미지 드래그 이동 작동
- 이미지 이동/리사이즈/회전 후 Ctrl+Z로 이전 상태 복원
