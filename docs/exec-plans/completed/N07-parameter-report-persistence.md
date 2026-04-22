---
id: N07
title: Parameter Report Persistence Fix
date: 2026-04-22
status: active
---

## 문제

생성된 이미지의 파라미터 리포트가 사라지는 2가지 버그

### 버그 1 — sync effect 조건 누락
sketch_generated가 아닌 아이템 선택 시 parameterReport가 지워지지 않음
→ 다른 아이템 선택 후에도 이전 리포트가 계속 표시됨

### 버그 2 — localStorage 용량 초과 시 parameterReport 유실
roomAnalysis 텍스트가 길면 lsSaveItems() 전체가 조용히 실패
→ 페이지 리로드 후 item.parameters.parameterReport = null

## 수정 범위

`sketch-to-plan/src/app/page.tsx`

## 수정 내용

### Fix 1: sync effect (line ~217)
- canvasItems → canvasItemsRef.current (stale closure 방지)
- else { setParameterReport(null) } 추가 (비-생성 아이템 선택 시 지우기)
- eslint-disable 주석 제거 (deps 배열 정상화)

### Fix 2: placeItem에서 IndexedDB 저장
- saveImageToDB(`report_${planItemId}`, roomAnalysis) 추가

### Fix 3: lsSaveItems에서 parameterReport 제거
- parameters.parameterReport를 localStorage에서 제외 (용량 절감)

### Fix 4: 마운트 복원에서 IndexedDB 리포트 로드
- sketch_generated 아이템에 대해 loadImageFromDB(`report_${id}`) 호출
- item.parameters.parameterReport 업데이트

### Fix 5: handleDeleteItem에서 리포트 정리
- deleteImageFromDB(`report_${id}`) 추가

## 기대 결과
- 생성된 이미지 선택 시 → 파라미터 리포트 표시
- 다른 아이템 선택 시 → 파라미터 리포트 숨김
- 페이지 리로드 후 생성된 이미지 선택 시 → 파라미터 리포트 복원
