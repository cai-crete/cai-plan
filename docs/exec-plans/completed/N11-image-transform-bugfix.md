---
id: N11
title: 이미지 변환 UX 버그 수정 5건
status: completed
date: 2026-04-22
---

## 목적
N10에서 구현된 아트보드 이미지 리사이즈/로테이트 기능의 버그 수정.

## 수정 항목 (Fix 1,2,4는 이전에 완료됨)

### Fix 0 — 이미지 팽창 버그 (루트 원인)
- **원인**: 배경 이미지와 핸들이 `scale(contentScale/100)` 래퍼 div 내부에 렌더링됨.
  아트보드를 ZoomIn(`contentScale > 100`)한 상태에서 이미지 편집 모드 진입 시
  `overflow: visible`과 합산되어 이미지가 아트보드 밖으로 팽창.
- **변경**: 배경 `<img>` + 핸들 오버레이를 `scale()` div 외부, `<>` Fragment 내부로 이동.
  grid + sketch canvas만 scale div 내부에 유지.

### Fix 1 — 아트보드 선택 테두리 주황 → 파랑 유지 ✓ (이미 완료)

### Fix 2 — 회전 핸들 SVG 커서 ✓ (이미 완료)

### Fix 3 — Confirm 시 history push 제거
- `handleImageTransformConfirm`에서 `setHistoryStates` / `setRedoStates` 호출 제거.
- 확정/취소는 이미지 편집에만 적용. undo/redo는 좌측 컨트롤 바에서 관리.

### Fix 4 — 모서리 resize 항상 비율 유지 ✓ (이미 완료)
