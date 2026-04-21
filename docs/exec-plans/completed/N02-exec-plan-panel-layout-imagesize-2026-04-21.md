---
id: exec-plan-panel-layout-imagesize-2026-04-21
created: 2026-04-21
status: in-progress
---

# Exec Plan: 패널 레이아웃 조정 + 생성 이미지 아트보드 사이즈 동기화

## 목표
1. RightSidePanel 섹션 순서 변경: PROMPT → BUILDING TYPE → GRID MODULE → PARAMETER REPORT
2. 'Room Analysis' → 'PARAMETER REPORT' 레이블 변경, 캔버스 텍스트 아이템 제거
3. PARAMETER REPORT 박스: 내부 스크롤만 허용, 스크롤바 hidden
4. 생성된 sketch_generated 이미지 규격 = 소스 아트보드 규격으로 동기화

## 변경 파일
- `sketch-to-plan/src/components/panels/SketchToPlanPanel.tsx` — A, B, C
- `sketch-to-plan/src/app/page.tsx` — D, E, F, G

## 작업 항목
- [ ] A: 섹션 순서 재배치 (PROMPT → BUILDING TYPE → GRID MODULE → PARAMETER REPORT)
- [ ] B: 레이블 'Room Analysis' → 'PARAMETER REPORT'
- [ ] C: PARAMETER REPORT 박스 max-height 고정 + overflow-y: auto + scrollbar hidden
- [ ] D: `sourceArtboardSize` 상태 추가 (page.tsx)
- [ ] E: handleGenerate에서 item 크기 → sourceArtboardSize 저장
- [ ] F: 이미지 배치 useEffect: 640×640 → sourceArtboardSize 기준
- [ ] G: 캔버스 analysisItem 텍스트 아이템 제거
