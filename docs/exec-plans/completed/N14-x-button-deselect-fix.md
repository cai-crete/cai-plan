---
id: N14
title: X 버튼 클릭 → 빈 캔버스 클릭과 동일한 동작으로 변경
status: completed
date: 2026-04-22
---

## 문제

업로드된 이미지가 있는 아트보드를 선택 → 아트보드 하단의 'X' 버튼 클릭 → 이미지를 다시 클릭하면 이미지가 아트보드 전체로 팽창되는 버그.

## 원인

`handleImageTransformCancel`이 `imageEditingId = null`만 설정하고, `setSelectedItemIds([])`를 호출하지 않음.
→ X 버튼 클릭 후에도 아이템이 `selectedItemIds`에 남아있음.
→ 다시 클릭 시 `selectedItemIds.includes(itemId)` 조건이 true → 즉시 이미지 편집 모드 재진입.
→ 이때 `contentTransform`이 null이면 `{ x:0, y:0, width:item.width, height:item.height }` 초기화 → 이미지 팽창.

## 해결책

X 버튼의 `handleImageTransformCancel`을 빈 캔버스 클릭과 동일하게 변경:
1. `handleImageTransformConfirm()` — 편집 모드 종료(현재 transform 확정)
2. `setSelectedItemIds([])` — 선택 해제

## 변경 파일

- `sketch-to-plan/src/app/page.tsx`
  - `handleImageTransformCancel`: snapshot restore 로직 제거, confirm + deselect로 대체

## 완료 기준

- X 버튼 클릭 후 아이템이 비선택 상태로 전환됨
- 이후 이미지 재클릭 시 팽창 없이 정상 선택됨
