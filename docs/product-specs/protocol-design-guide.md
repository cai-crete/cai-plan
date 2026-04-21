# Protocol Design Guide — Protocol의 역할

> **이 파일의 위치:** `docs/product-specs/protocol-design-guide.md`
>
> Protocol은 각 노드 개발 단계에서 제공됩니다.
> 이 가이드는 Protocol을 어떻게 작성하는가가 아니라,
> **Protocol이 Node App에서 어떤 역할을 하는가**를 정의합니다.

---

## 1. Protocol의 역할

Protocol은 노드의 AI 행동을 정의하는 유일한 권위입니다.

```
Protocol = 노드가 입력을 받아 출력을 만드는 방식의 완전한 정의
```

Node App의 코드·UI·API 아키텍처는 모두 Protocol을 서빙하기 위해 존재합니다.
Protocol이 정의하지 않은 행동은 노드의 행동이 아닙니다.

**Protocol이 하는 것:**
- AI가 입력을 어떻게 분석하는지 정의
- AI가 어떤 순서로 무엇을 실행하는지 정의
- AI가 경계 상황에서 어떻게 행동하는지 정의
- 출력물이 올바른지 판단하는 기준 정의
- 각 ROOM(ANALYSIS ROOM / GENERATION ROOM)에서 AI가 사고하는 구조 강제

**Protocol이 하지 않는 것:**
- UI 레이아웃 결정 ← 코드의 역할
- API 호출 방식 결정 ← 코드의 역할
- 도메인 데이터 보유 ← Knowledge Doc의 역할
- Protocol 결함을 코드 레이어에서 보완하는 것 ← 금지

---

## 2. 보편 워크플로우와 Protocol

CAI 하네스를 사용하는 모든 노드 앱은 아래 4단계 흐름을 따릅니다. Protocol은 이 흐름의 두 AI 개입 구간을 제어합니다.

```
[UPLOAD] → [ANALYSIS/REASONING] → [USER INPUT] → [RESULT GENERATION]
              ↑                                        ↑
         ANALYSIS ROOM                          GENERATION ROOM
         (Protocol 제어)                         (Protocol 제어)
```

| 단계 | 행위자 | Protocol의 역할 |
|------|--------|----------------|
| **UPLOAD** | 사용자 | — |
| **ANALYSIS/REASONING** | AI | `[ANALYSIS ROOM]` 블록이 분석 구조를 강제 |
| **USER INPUT** | 사용자 | — |
| **RESULT GENERATION** | AI | `[GENERATION ROOM]` 블록이 생성 구조를 강제 |

**AI 엔진:**
- 분석/추론 및 텍스트 생성: `gemini-3.1-pro-preview`
- 이미지 생성: `gemini-3.1-flash-image-preview`

엔진 교체는 반드시 Protocol 내부에서 정의해야 하며, Protocol 외부(코드)에서 임의 교체는 금지입니다.

**ROOM이 없는 Protocol은 무효입니다.** `[ANALYSIS ROOM]` 또는 `[GENERATION ROOM]` 블록 없이 Protocol을 배포하는 것은 금지입니다.

---

## 3. Process Spec 전달 원칙

> **이 원칙은 헌법입니다.** 모든 노드의 모든 프로세스에 예외 없이 적용됩니다.

각 프로세스가 완료될 때마다 해당 프로세스의 **작업명세서(Process Spec)를 반드시 출력**하고, 그 작업명세서를 다음 프로세스의 입력으로 전달해야 합니다.

```
[ANALYSIS ROOM 완료]
       ↓
[analysis-spec 출력] ← 구조화 필드만 허용, 자유 서술 형식 금지
       ↓
[USER INPUT 단계로 전달]
       ↓
[GENERATION ROOM 입력으로 사용]
       ↓
[generation-spec 출력]
```

**프로세스 간 작업명세서 형식:**

```json
// analysis-spec (ANALYSIS ROOM 완료 후 출력)
{
  "process": "analysis",
  "results": [
    { "axis": "<axis_name>", "finding": "<finding>", "confidence": "HIGH" | "MID" | "LOW" }
  ],
  "failure_modes": [
    { "axis": "<axis_name>", "reason": "<불가 이유>", "result": null }
  ],
  "passed": true | false
}

// generation-spec (GENERATION ROOM 완료 후 출력)
{
  "process": "generation",
  "engine": "<사용 엔진>",
  "type": "text" | "image",
  "input_refs": {
    "analysis_spec": "<참조한 analysis-spec 요약>",
    "input_spec": "<참조한 input-spec 요약>"
  },
  "output": "<생성 결과물 또는 결과물 경로>",
  "quality_gate": "PASS" | "FAIL",
  "regenerated": true | false
}
```

**금지 사항:**
- 작업명세서(Process Spec) 없이 다음 프로세스를 시작하는 것
- 작업명세서를 자유 서술 형식으로 출력하는 것 — 구조화 필드만 허용

---

## 4. API 주입 구조

Protocol은 AI API 호출의 `system` 파라미터에 **항상, 전문(全文)** 삽입됩니다.

```
API 호출 구조:
┌─────────────────────────────────────────┐
│ system:                                 │
│   [Principle Protocol 전문]             │
│   ---                                   │
│   [Knowledge Doc 1 전문] (선택)         │
│   ---                                   │
│   [Knowledge Doc 2 전문] (선택)         │
├─────────────────────────────────────────┤
│ user:                                   │
│   [입력 데이터] + [사용자 요청]         │
└─────────────────────────────────────────┘
```

**계층 충돌 규칙**: 상위 계층이 하위 계층을 항상 override합니다.
```
Principle Protocol  >  Knowledge Docs  >  User Input
     (불변 원칙)           (참조 지식)       (실행 명령)
```

**금지 사항:**
- Protocol을 `user` 메시지에 포함하는 것
- Protocol 일부만 삽입하는 것
- 세션 중간에 Protocol을 교체하는 것

---

## 5. Principle Protocol vs Knowledge Doc

두 문서는 역할이 다릅니다. 혼동하면 시스템 프롬프트가 비대해지거나 행동 정의가 누락됩니다.

| 유형 | 역할 | 담는 내용 |
|------|------|----------|
| **Principle Protocol** | 행동 정의 — "어떻게 작동하는가" | GOAL, CONTEXT, ROLE, ANALYSIS ROOM, GENERATION ROOM, COMPLIANCE CHECK |
| **Knowledge Doc** | 지식 제공 — "무엇을 알고 있는가" | 도메인 데이터, 변환 테이블, 재료 사전, 파라미터 레퍼런스 등 |

Knowledge Doc은 Protocol이 ROOM 내 Step을 실행할 때 참조하는 데이터베이스입니다.
Protocol이 "파라미터를 계산하라"고 지시하면, Knowledge Doc이 계산 기준표를 제공합니다.

---

## 6. Protocol 파일 위치

노드 앱 개발 시 루트에 `n#-project-name/` 폴더를 생성합니다.
Protocol과 Knowledge Doc 파일은 해당 노드 폴더의 `_context/` 디렉토리에 위치합니다.

```
n#-project-name/
├── _context/                              ← 노드 전용 Protocol 및 Knowledge Docs
│   ├── protocol-[node-name]-v[N].txt      ← Principle Protocol
│   ├── [knowledge-doc-1].txt              ← Knowledge Doc (선택)
│   └── [knowledge-doc-2].txt              ← Knowledge Doc (선택)
├── src/                                   ← 앱 소스 코드
└── .env.local                             ← 환경변수
```

**파일명 규칙:**

| 파일 | 규칙 | 예시 |
|------|------|------|
| Principle Protocol | `protocol-[node-name]-v[N].txt` | `protocol-change-viewpoint-v4.txt` |
| Knowledge Doc | `[내용을 설명하는 이름].txt` | `viewpoint-analysis.txt` |

**버전 관리 규칙:**
- 이전 버전 파일은 삭제하지 않습니다 — 롤백 기반 및 비교 기준
- 버전 업 시 새 파일을 생성하고, 변경 내용을 product-spec의 `## Protocol 버전 History`에 기록합니다

**Agent 로드 경로:**
Agent가 노드 개발 세션을 시작할 때 `_context/` 내 Protocol 파일을 우선 로드합니다.
`CAI/docs/`는 회사 전체 기준이며, `_context/`는 해당 노드 전용 기준입니다.

---

## 7. 오염 패턴 카탈로그

Protocol이 역할을 다하지 못했을 때 출력물에 나타나는 증상과 처방입니다.

| 패턴 | 증상 | 원인 | 처방 |
|------|------|------|------|
| **입력 패스스루** | 요청이 있었음에도 AI가 입력을 변환 없이 그대로 출력 | Failure Mode 부재 — 처리 불가 상황에서 원본 반환으로 회피 | Failure Mode에 입력 범위 초과 상황 IF-THEN 분기 추가. 원본 반환 절대 금지 명시 |
| **기하 변형** | 건물 비율·구조 변경 | Immutable Constants 미작동 | CONTEXT에 불변 상수 강조 반복 + Pre-flight 체크 추가 |
| **단계 건너뜀** | Action Step 미실행 | Step 간 의존성 불명확 | 각 Step에 "Step N 결과를 사용하여" 연결 명시 |
| **추상 명령 미변환** | 추상적 지시가 노드의 처리 단위로 변환되지 않고 출력에 반영됨 | 추상→구체 변환 Step 누락 | Step 1에 추상 명령 → 구체 파라미터 변환 강제 |
| **할루시네이션** | 원본에 없는 요소 추가 | Physical Reality 미정의 | CONTEXT Ontological Status 강화 |
| **Protocol 무시** | 출력이 Protocol 구조를 전혀 따르지 않음 | System prompt 미적용 | API 호출 코드 `system` 파라미터 확인 |
| **ROOM 우회** | AI가 ROOM 블록 밖에서 추론하거나 ROOM 구조를 따르지 않음 | ROOM 블록 미작성 또는 블록 형식 오류 | ROOM 블록 존재 여부·형식 확인 후 재배포. `/ralph-loop` 재실행 |
| **Process Spec 누락** | 다음 프로세스가 이전 프로세스 출력을 받지 못하고 독립 실행됨 | ROOM SPEC_OUTPUT 필드 미정의 또는 자유 서술 형식 사용 | ROOM SPEC_OUTPUT을 구조화 필드로 명시. Process Spec 전달 체인 점검 |

---

## 8. Protocol 검증 파이프라인

Protocol 초안 완성 후 배포 전까지 반드시 아래 파이프라인을 통과해야 합니다.
검증은 **AGENT B(검증 에이전트)**가 전담하며, AGENT A는 검증 판정에 관여하지 않습니다.

```
[AGENT A: Protocol 초안 작성 완료]
        ↓
[AGENT B 핸드오프 — loop-b-handoff-[node].md 생성]
        ↓
┌─── Loop A — Protocol 정합성 검증 (/ralph-loop) ─────────────────┐
│  최대 3회 자동 발동                                              │
│                                                                  │
│  체크 항목:                                                       │
│  ① 구조 완결성: [ANALYSIS ROOM] / [GENERATION ROOM] 블록 존재   │
│     SPEC_OUTPUT: analysis-spec / generation-spec 선언 여부       │
│  ② 간결성: 중복 지시·모호한 명령 없음                            │
│  ③ 내부 일관성: 섹션 간 지시 충돌 없음                           │
│  ④ 오염 저항성: §7 오염 패턴 각 항목에 대한 방어 여부            │
│                                                                  │
│  <promise>VERIFIED</promise> 수신 시 Loop A 종료                 │
│  3회 내 VERIFIED 미수신 → Protocol 재작성 후 재시작              │
└──────────────────────────────────────────────────────────────────┘
        ↓ Loop A Pass
┌─── Loop B — 코드 정합성 검증 (/code-reviewer) ──────────────────┐
│  ① QUALITY_SCORE.md 체크리스트 실행                             │
│  ② Stage B 동적 테스트: 실제 API 호출                           │
│     → analysis-spec / generation-spec 실제 출력 여부 확인        │
│  ③ 실패 케이스 목록 + 원인 분석                                  │
│  ④ 수정 우선순위 보고서 생성 → AGENT A에 전달                    │
│                                                                  │
│  Fail → AGENT A 수정 → 실패 케이스만 재실행                     │
└──────────────────────────────────────────────────────────────────┘
        ↓ 전체 Pass
[배포 승인 → 버전 태그 → exec-plan Progress 업데이트]
```

**필수 체크: 배포 불가 조건** (Loop A가 반드시 차단)

| 조건 | 판정 |
|------|------|
| `[ANALYSIS ROOM]` 헤더 블록 없음 | 배포 불가 |
| `[GENERATION ROOM]` 헤더 블록 없음 | 배포 불가 |
| ANALYSIS ROOM에 분석 축(Axis) 미정의 | 배포 불가 |
| GENERATION ROOM에 엔진 미선언 | 배포 불가 |
| `SPEC_OUTPUT: analysis-spec` 지시 없음 | 배포 불가 |
| `SPEC_OUTPUT: generation-spec` 지시 없음 | 배포 불가 |

---

## 9. 오염 감지 후 대응 절차

오염이 감지되면 아래 순서로 처리합니다:

```
1. 오염 패턴 분류
   → §7 "알려진 오염 패턴 카탈로그" 참조

2. 원인 레이어 특정
   A. API 호출 레이어 문제 (system 파라미터에 Protocol이 실제로 들어가는가?)
   B. Protocol 구조 문제 (ROOM 블록이 존재하는가? Failure Mode가 있는가?)
   C. Protocol 언어 문제 (지시가 모호해서 AI가 다르게 해석했는가?)
   D. Process Spec 문제 (SPEC_OUTPUT 필드가 구조화 형식으로 정의되어 있는가?)

3. 수정 범위 결정
   - A → 코드 수정 (buildSystemPrompt 함수 확인)
   - B → Protocol 구조 수정 → Loop A 재실행
   - C → Protocol 언어 수정 → Loop A 재실행 (구조 체크는 생략 가능)
   - D → ROOM SPEC_OUTPUT 필드 수정 → Loop A 재실행

4. 수정 후 Loop B 실패 케이스만 재실행

5. 통과 시 버전 업 (v4 → v5)
```

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
