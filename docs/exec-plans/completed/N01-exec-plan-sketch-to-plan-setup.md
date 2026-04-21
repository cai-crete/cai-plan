# Exec Plan — sketch-to-plan 설정 전환

> 작성일: 2026-04-21
> 상태: COMPLETED

---

## 작업 배경

기존 `sketch-to-image` 노드 앱(sketch-to-plan/ 폴더)의 Protocol 및 RightPanel을 `sketch-to-plan` 용도에 맞게 전환.

- **기존**: 스케치 → 극사실주의 건축 이미지 생성 (gemini-flash-image)
- **변경**: 스케치 버블 다이어그램 → CAD 스타일 2D Top-down 건축 평면도 생성 (Minimalist Solid-Poche, gemini-flash-image)

---

## 작업 항목

### 0. AGENTS.md 준수 확인
- [x] exec-plan 생성됨
- [x] `docs/product-specs/sketch-to-plan.md` 생성 및 사용자 확인 완료

### 1. product-spec 작성
- [x] `docs/product-specs/sketch-to-plan.md` 생성
- [x] NodeContract: nodeId=sketch-to-plan, phase=3, Protocol v3.8
- [x] Input: sketch_image, user_prompt, floor_type (9 types), grid_module (mm)
- [x] Output: generated_plan_image (base64), room_analysis (markdown)

### 2. Protocol 및 지식 문서 (_context/)
- [x] `sketch-to-plan/_context/protocol-sketch-to-plan-v3.8.txt` — 8-Section Topology-to-Structure Engine
- [x] `sketch-to-plan/_context/knowledge-wp-grid-mapping.txt` — WP & 그리드 맵핑
- [x] `sketch-to-plan/_context/knowledge-template-a.txt` — Minimalist Solid-Poche 스타일 가이드
- [x] `sketch-to-plan/_context/knowledge-architectural-standards.txt` — 건축도면작성기준

### 3. RightPanel 변경
- [x] `SketchToPlanPanel.tsx` 신규 생성
  - Building Type: 9종 드롭다운 (RESIDENTIAL 등)
  - Grid Module: 슬라이더 (1000~24000mm, 6단계)
  - Prompt: textarea
  - Room Analysis: 생성 후 pre 블록으로 표시
  - GENERATE 버튼: Building Type 미선택 시 비활성화
- [x] `RightSidebar.tsx` — 헤더 "SKETCH TO PLAN", SketchToPlanPanel 연결

### 4. API Route 변경
- [x] `src/app/api/sketch-to-plan/route.ts` 신규 생성
- [x] 2-Phase: Phase 1 분석(gemini-3.1-pro-preview) → Phase 2 평면도 이미지 생성(gemini-3.1-flash-image-preview)
- [x] buildSystemPrompt에 protocol + 3개 knowledge docs 통합
- [x] Fallback 모델: gemini-2.5-pro-preview / gemini-2.5-flash-image

### 5. Hook 수정
- [x] `usePlanGeneration.ts` 신규 생성
- [x] POST /api/sketch-to-plan, 반환: generatedPlanImage, roomAnalysis

### 6. page.tsx 업데이트
- [x] import usePlanGeneration
- [x] 상태: planPrompt, floorType, gridModule 추가 / sketch 관련 상태 제거
- [x] useEffect: 생성 완료 시 plan 이미지 + room analysis 텍스트 캔버스에 배치
- [x] handleGenerate: 선택 아이템 스케치 캡처 → generate() 호출
- [x] RightSidebar props 새 인터페이스로 교체

### 7. canvas.ts 타입 업데이트
- [x] `LayerType = 'sketch' | 'cadastral' | 'grid'` 추가
- [x] `CanvasItem.layerType?: LayerType` 추가

### 8. Loop B 핸드오프
- [x] `docs/exec-plans/active/loop-b-handoff-sketch-to-plan.md` 작성

---

## 완료 기준 ✓

- product-spec 확정 ✓
- Protocol v3.8 (_context/ 4개 파일) ✓
- API route 2-Phase 동작 (분석 + CAD 이미지 생성) ✓
- RightPanel sketch-to-plan 전용 UI ✓
- page.tsx 전환 완료, TypeScript 오류 없음 ✓
- layerType 필드 추가 ✓

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
