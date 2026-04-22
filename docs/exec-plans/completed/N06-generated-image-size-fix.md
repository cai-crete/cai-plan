---
id: N06
title: Generated Image Size Fix — Match Source Artboard Dimensions
date: 2026-04-22
status: active
---

## 문제

생성된 평면도 이미지의 캔버스 아이템 크기가 소스 아트보드 규격과 다름.
- 소스 아트보드: 세로형(portrait)
- 생성 결과 아이템: 가로형(landscape) — Gemini 출력 intrinsic 크기를 그대로 사용

## 근본 원인

`page.tsx:316` — `place(img.naturalWidth, img.naturalHeight)` 호출 시
Gemini 생성 이미지의 고유 크기(예: 1024×1024)를 캔버스 아이템 크기로 사용.
소스 아트보드 크기(`sourceArtboardSize`)를 무시함.

## 수정 범위

`sketch-to-plan/src/app/page.tsx` — `generatedPlanImage` effect (lines 282–320)

## 수정 내용

1. `targetW = sourceArtboardSize?.width`, `targetH = sourceArtboardSize?.height` 사용
2. offscreen canvas (targetW × targetH) 생성
3. 생성 이미지를 `object-contain` 방식(letterbox, 흰 배경)으로 offscreen canvas에 그리기
4. offscreen canvas 결과를 `src`로 사용
5. 캔버스 아이템 width/height = targetW/targetH (항상 소스 아트보드 규격)

## 기대 결과

- 생성 이미지 캔버스 아이템 크기 = 소스 아트보드 크기
- 생성 이미지 내용 비율 유지 (letterbox)
- 왜곡 없음
