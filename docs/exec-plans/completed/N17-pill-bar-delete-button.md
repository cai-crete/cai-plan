---
id: N17
title: 알약 바 (이미지 편집 모드 하단 컨트롤) 가장 오른쪽에 Delete 버튼 추가
status: completed
date: 2026-04-22
---

## 구현 내용

- 위치: 이미지 편집 모드 하단 알약 바 (Cancel 버튼 우측)
- 아이콘: Trash2 (lucide-react, 이미 import)
- 색상: `#ef4444` (상단 컨트롤바 delete 버튼과 동일)
- 동작:
  1. `imageEditSnapshot.current = null` — 스냅샷 정리
  2. `setImageEditingId(null)` — 이미지 편집 모드 종료
  3. `handleDeleteItem(id)` — 히스토리 push + 아이템 삭제

## 참고
- 이미지 편집 모드 중 상단 컨트롤바가 숨겨지므로 (line 1693: `imageEditingId !== id && ...`),
  알약 바의 delete가 편집 중 유일한 삭제 접근점임
