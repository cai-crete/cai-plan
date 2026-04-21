# Node Spec — sketch-to-plan

> 파일명: `sketch-to-plan.md`
> Protocol 버전 업 시 하단 `## Protocol 버전 History` 섹션에 변경 내용을 기록합니다.

---

## 노드 개요

| 항목 | 내용 |
|------|------|
| 이름 | sketch-to-plan |
| Phase | 3 |
| Protocol 버전 | v3.8 |

---

## 단독 역할

사용자가 그린 버블 다이어그램 스케치를 건축적으로 타당한 CAD 스타일 2D 평면도로 변환하는 디자인 툴.
스케치의 공간 위상(Topology)·연결성·동선을 분석하여, 직교 정류된 Minimalist Solid-Poche 스타일 건축 평면도를 생성한다.

## 플랫폼 역할

CAI 파이프라인의 Phase 3 노드로, 스케치 업로드 → AI 공간 분석 → 사용자 파라미터 입력 → CAD 평면도 생성의 전체 흐름을 단독 실행한다.

---

## 입력 계약 (Input Contract)

| 항목 | 타입 | 필수 여부 | 설명 |
|------|------|----------|------|
| `sketch_image` | base64 image | 필수 | 캔버스에 그린 버블 다이어그램 스케치 (또는 업로드 이미지) |
| `user_prompt` | string | 선택 | 공간 조건 보충 텍스트 (예: "3 bedrooms, open kitchen") |
| `floor_type` | enum (아래 목록 참조) | 필수 | 건물 용도 |
| `grid_module` | number (mm): `1000` \| `2000` \| `4000` \| `8000` \| `16000` \| `24000` | 필수 | 구조 그리드 모듈 단위 (mm) |

**floor_type 허용 값:**

| 키 | 레이블 |
|----|--------|
| `RESIDENTIAL` | Residential |
| `COMMERCIAL` | Commercial |
| `OFFICE` | Office |
| `MIXED_USE` | Mixed-use |
| `CULTURAL_PUBLIC` | Cultural & Public |
| `EDUCATION_RESEARCH` | Education & Research |
| `HEALTHCARE_WELFARE` | Healthcare & Welfare |
| `HOSPITALITY_LEISURE` | Hospitality & Leisure |
| `MASTERPLAN_URBANISM` | Masterplan & Urbanism |

**입력 예시:**
```
sketch_image: <캔버스 드로잉 base64>
user_prompt: "3 bedrooms, open kitchen, south-facing living room"
floor_type: RESIDENTIAL
grid_module: 4000
```

---

## 출력 계약 (Output Contract)

| 항목 | 타입 | 설명 |
|------|------|------|
| `generated_plan_image` | base64 image | CAD 스타일 2D Top-down 건축 평면도 (Minimalist Solid-Poche) |
| `room_analysis` | string (Markdown) | 공간 파라미터 분석 결과 — 실별 치수, 면적, 출입구, 창 위치, 인접 관계 포함 |

> **구조 비고:** Protocol v3.8은 8-Section 구조(Topology-to-Structure Engine)를 사용합니다.
> Section 2–4가 ANALYSIS 역할, Section 5–7이 GENERATION 역할, Section 8이 데이터 추출 역할을 수행합니다.

**출력 예시:**
```markdown
▪ 거실 (Living Room)
- 치수: 5400mm x 4200mm
- 면적: 22.68㎡ (6.86평)
- 출입구: 현관홀 방향 1개, 주방 방향 개구부 1개
- 창 위치: 남측 외벽 (폭 2400mm)
- 주변 실과의 관계: 현관홀(직접 연결), 주방(개구부), 침실1(복도 경유)
```

---

## Protocol 구성

| 파일 | 유형 |
|------|------|
| `protocol-sketch-to-plan-v3.8.txt` | Principle Protocol (사용자 제공, 배포본) |

## 지식 문서 구성

| 파일 | 역할 |
|------|------|
| `knowledge-wp-grid-mapping.txt` | WP & 그리드 맵핑 기준 |
| `knowledge-template-a.txt` | Minimalist Solid-Poche 시각 스타일 가이드 (`{template-a}`) |
| `knowledge-architectural-standards.txt` | 건축도면작성기준 (AIA Layer 기반) |

---

## 컴플라이언스 체크리스트

```
[ ] Pre-Step: sketch_image가 유효한 이미지인지 확인
[ ] Phase 1 (ANALYSIS): AMP Engine — 스케치 위상 분석 완료
[ ] Phase 1 (ANALYSIS): Deep Spatial Vision 5-Step 분석 완료
[ ] Phase 1 (ANALYSIS): Project Manager + Structural Engineer Micro-Handoff 완료
[ ] Phase 1 (ANALYSIS): analysis-spec JSON 출력 완료
[ ] Phase 2 (GENERATION): Architectural Drafter + Interior Designer 실행
[ ] Phase 2 (GENERATION): Solid Poche 벽체 렌더링, 문/창 심볼 배치
[ ] Phase 2 (GENERATION): CAD 스타일 2D Top-down 평면도 이미지 생성
[ ] Phase 2 (GENERATION): Self-Correction Protocol (Section 6) 실행
[ ] Phase 2 (GENERATION): 공간 파라미터 분석 (Section 8) 텍스트 출력
[ ] Immutable Constants: 스케치의 위상(방 배치 순서) 변형 금지
[ ] Boundary Resolution: 연결 불가 공간은 failure_modes에 기록
```

---

## 알려진 실패 패턴

| 패턴 | 재현 조건 | 처방 |
|------|----------|------|
| 버블 형태 잔존 | 둥근 버블을 직교 벽체로 변환 실패 | Orthogonal Rectification 강제 (Section 2.3) |
| 위상 뒤바뀜 | 좌우/상하 방 배치가 뒤집혀 생성 | Topological Anchor(이미지 = 고정값) 원칙 재확인 |
| Dead Space 생성 | 인접 버블 간 문/통로 누락 | Opening Logic + Connectivity Verification 강제 |

---

## 알려진 제약 (Known Constraints)

| 항목 | 기준값 | 이 노드의 실제값 | 근거 |
|------|--------|----------------|------|
| API 응답 타임아웃 | RELIABILITY.md 30s | Phase 1: 90s / Phase 2: 90s | Gemini 2-Phase AI 생성 (분석 + CAD 이미지)은 최소 60–120s 소요. 30s 제한 적용 시 루틴 실패. 의도적 노드별 예외로 승인. |

> 이 노드는 RELIABILITY.md §API 안정성의 "30초 이내" 기준에서 **노드별 예외**를 적용합니다.
> 예외 사유: 2-Phase AI 이미지 생성(분석 텍스트 + CAD 평면도 이미지)의 구조적 처리 시간.

---

## Protocol 버전 History

| 버전 | 날짜 | 변경 이유 | Stage B 결과 |
|------|------|----------|-------------|
| v3.8 | 2026-04-21 | 사용자 제공 Protocol (8-Section, Topology-to-Structure Engine) | Loop B Iter 1: FAIL→PASS (타임아웃 예외 명문화 후) |

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
