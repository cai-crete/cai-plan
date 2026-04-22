---
id: N15
title: 이미지 편집 모드 중 아트보드 배경 클릭 시 아트보드 이동 차단
status: active
date: 2026-04-22
---

## 문제

아트보드 선택 → 아트보드 내 업로드 이미지를 이동하려 할 때, 아트보드 모체 자체가 이동함.

## 원인

이미지 편집 모드(`imageEditingId === artboardId`) 상태에서
img-move-area·핸들 이외 아트보드 배경 영역을 클릭하면:

1. line 797: `imageEditingIdRef.current !== itemId` → false → 편집 모드 진입 조건 실패
2. line 818: `imageEditingIdRef.current !== itemId` → false → 스킵
3. line 823-828: 가드 없이 `isMovingItem = true`, `moveItemId = artboardId` → **아트보드 이동**

## 해결책

line 817 (기존 편집 모드 진입 블록 직후)에 가드 추가:

```ts
// 이미지 편집 모드 중인 아트보드 배경 클릭 → 아트보드 이동 방지
if (imageEditingIdRef.current === itemId) {
  canvasElRef.current?.setPointerCapture(e.pointerId);
  return;
}
```

이렇게 하면:
- img-move-area 클릭 → image 이동 (line 744에서 처리, 변경 없음)
- 핸들 클릭 → resize/rotate (line 683, 722에서 처리, 변경 없음)
- 아트보드 배경 클릭 → 아무것도 안 함 (이동 차단)

## 변경 파일

- `sketch-to-plan/src/app/page.tsx` line ~817 (편집 모드 진입 return 직후)

## 완료 기준

- 아트보드 첫 번째 클릭: 선택
- 두 번째 클릭: 이미지 편집 모드 진입 (img-move-area + 핸들 표시)
- 이미지 영역 드래그: 이미지만 이동 (아트보드 고정)
- 아트보드 배경 드래그: 이동 없음 (아트보드 고정)
