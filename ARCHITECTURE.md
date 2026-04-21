# ARCHITECTURE.md — CAI 하네스 시스템 설계도

> Agent는 이 파일로 CAI/Project-10 시스템의 전체 기술 구조를 파악합니다.
> 워크플로우·ROOM 원칙·레이어 경계·데이터 흐름·핵심 타입을 모두 이 파일에서 관할합니다.

---

## 1. AGENT 발동 조건 및 워크플로우

### 1.1 AGENT 종류 및 역할

| 에이전트 | 명칭 | 책임 | 발동 파일 |
|----------|------|------|-----------|
| **AGENT A** | 실행 에이전트 | Protocol 작성·Node App(API Route, buildSystemPrompt) 구현·결함 수정 | `docs/references/loop-b-execution-agent.txt` |
| **AGENT B** | 검증 에이전트 | Protocol + Node App 독립 검증·PASS/FAIL 판정·결함 보고서 생성 | `docs/references/loop-b-verification-agent.txt` |

**에이전트 간 경계 원칙:**
- AGENT A만 Protocol 파일을 작성·수정한다
- AGENT B만 PASS/FAIL 판정을 발급한다
- 어떤 에이전트도 자신의 영역 밖 파일을 임의로 수정하지 않는다

---

### 1.2 AGENT A — 실행 에이전트

**발동 조건:**
- 노드 개발 세션이 시작되고 product-spec이 존재하는 경우
- Protocol 작성 또는 수정이 필요한 경우

**발동 파일:** `docs/references/loop-b-execution-agent.txt`

**워크플로우:**

```
[세션 시작]
  → loop-b-execution-agent.txt 로드
  → product-specs/[node].md 파악
         ↓
┌─── 실행 루프 ──────────────────────────┐
│  1. product-spec 확인                  │
│  2. Protocol 작성 / 수정               │
│  3. buildSystemPrompt() 구현           │
│  4. Node App 완성                      │
└────────────────────────────────────────┘
         ↓ 구현 완료 선언
[AGENT B 핸드오프 → loop-b-handoff-[node].md 생성]
```

---

### 1.3 AGENT B — 검증 에이전트

**발동 조건:**
- AGENT A가 "구현 완료"를 선언한 경우
- Loop B 검증 단계 진입 시

**발동 파일:** `docs/references/loop-b-verification-agent.txt`

**워크플로우:**

```
[AGENT A 구현 완료 선언]
  → loop-b-verification-agent.txt 로드
  → loop-b-handoff-[node].md 파악
         ↓
┌─── Loop A — Protocol 정합성 검증 ──────┐
│  /ralph-loop 자동 발동 (최대 3회)      │
│  → 구조 완결성 / 간결성 / 내부 일관성  │
│  → 오염 저항성 체크                    │
│  → <promise>VERIFIED</promise> 시 종료 │
└────────────────────────────────────────┘
         ↓ Loop A Pass
┌─── Loop B — 코드 정합성 검증 ──────────┐
│  /code-reviewer 자동 발동              │
│  → QUALITY_SCORE.md 체크리스트 실행    │
│  → Stage B 동적 테스트 실행            │
│  → 실패 케이스 목록 + 원인 분석        │
│  → 수정 우선순위 보고서 생성           │
└────────────────────────────────────────┘
         ↓ 실패 항목 존재
[AGENT A에 보고서 전달 → 수정 후 재검증]
         ↓ 전체 Pass
[배포 승인 → 버전 태그 → exec-plan Progress 업데이트]
```

**금지:** 직접 수정 불가 — 보고만 한다

---

## 2. AI ROOM 원칙

ROOM은 Protocol 파일 내 AI 전용 작업 공간을 구조화한 **명시적 블록**이다.
개발자는 Protocol에 반드시 두 개의 ROOM을 정의해야 한다.
ROOM이 없는 Protocol은 이 하네스에서 **무효**다.

---

### 2.1 [ANALYSIS ROOM]

**목적**: 업로드된 입력(이미지·텍스트)을 AI가 구조적으로 분석·추론하는 공간

**AI 엔진**: `gemini-3.1-pro-preview`

**Protocol 파일 내 위치**: `[ANALYSIS ROOM]` 헤더 블록

**개발자가 이 블록에 반드시 정의해야 하는 것:**

| 항목 | 설명 | 예시 |
|------|------|------|
| 분석 축(Axis) | AI가 수행할 분석의 차원 목록 | 공간 구성 / 동선 / 채광 |
| 출력 형식 | 각 축에 대한 AI 출력 포맷 | `{ axis: string, finding: string, confidence: "HIGH"\|"MID"\|"LOW" }` |
| Failure Mode | 입력이 불충분할 때 AI가 취할 행동 | "분석 불가 축은 `null`로 반환하고 이유를 명시" |

**작업명세서 출력 의무 (`analysis-spec`):**

ANALYSIS ROOM이 완료되면 아래 형식의 `analysis-spec`을 반드시 출력하고 USER INPUT 단계로 전달해야 한다.
`analysis-spec` 없이 USER INPUT 단계를 시작할 수 없다.

```json
{
  "process": "analysis",
  "results": [
    { "axis": "<axis_name>", "finding": "<structured_finding>", "confidence": "HIGH" | "MID" | "LOW" }
  ],
  "failure_modes": [
    { "axis": "<axis_name>", "reason": "<불가 이유>", "result": null }
  ],
  "passed": true | false
}
```

**금지:**
- 자유 형식 서술 지시 — 모든 분석 출력은 구조화된 필드여야 한다
- Axis 없는 ANALYSIS ROOM — 분석 방향이 없으면 ROOM이 아니다
- `analysis-spec` 미출력 상태로 USER INPUT 단계 진입

**Protocol 예시:**

```
[ANALYSIS ROOM]
ENGINE: gemini-3.1-pro-preview
AXES:
  - spatial_composition: 공간 분할 방식과 비율 분석
  - circulation: 동선 흐름과 병목 지점 탐지
  - lighting: 채광 방향과 그림자 영향 예측

OUTPUT_FORMAT:
  {
    "axis": "<axis_name>",
    "finding": "<structured_finding>",
    "confidence": "HIGH" | "MID" | "LOW"
  }

FAILURE_MODE:
  분석 불가 항목: null 반환 + 불가 이유 1문장 명시
  입력 이미지 품질 부족: ANALYSIS ROOM 전체 중단, 사용자에게 재업로드 요청

SPEC_OUTPUT: analysis-spec
  완료 후 위 OUTPUT_FORMAT 결과 전체를 analysis-spec으로 패키징하여 출력
```

---

### 2.2 [GENERATION ROOM]

**목적**: 분석 결과와 사용자 입력을 결합하여 최종 결과물을 생성하는 공간

**Protocol 파일 내 위치**: `[GENERATION ROOM]` 헤더 블록

**결과물 유형별 AI 엔진 및 정의 요구사항:**

| 결과물 유형 | AI 엔진 | 개발자가 반드시 정의해야 하는 것 |
|------------|---------|-------------------------------|
| 텍스트 | `gemini-3.1-pro-preview` | 출력 구조, 길이 제약, 금지 표현, 언어 톤 |
| 이미지 | `gemini-3.1-flash-image-preview` | 이미지 프롬프트 생성 규칙, 스타일 파라미터, 품질 기준, 네거티브 프롬프트 |

**작업명세서 출력 의무 (`generation-spec`):**

GENERATION ROOM이 완료되면 아래 형식의 `generation-spec`을 반드시 출력해야 한다.
`generation-spec`은 결과물 납품 기록이자 품질 검증 증적이다.

```json
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

**금지:**
- 엔진 미명시 — GENERATION ROOM은 반드시 사용할 엔진을 선언해야 한다
- 프롬프트 생성 규칙 없는 이미지 ROOM — 자유 생성은 ROOM이 아니다
- `generation-spec` 미출력 상태로 작업 완료 선언

**Protocol 예시 (이미지 생성):**

```
[GENERATION ROOM]
ENGINE: gemini-3.1-flash-image-preview
TYPE: image

PROMPT_RULES:
  - ANALYSIS ROOM의 spatial_composition 결과를 공간 비율 지시어로 변환
  - 사용자 입력 스타일 파라미터를 카메라 앵글·조명 지시어로 변환
  - 건축 사진 리얼리즘: photorealistic, architectural photography, 8K

STYLE_PARAMS:
  rendering_style: photorealistic
  camera: eye-level perspective
  lighting: natural daylight

NEGATIVE_PROMPT:
  cartoon, illustration, sketch, watermark, blur, distortion

QUALITY_GATE:
  생성된 이미지가 ANALYSIS ROOM의 spatial_composition과 불일치 시 재생성 1회

SPEC_OUTPUT: generation-spec
  완료 후 생성 결과·품질 검증 결과·재생성 여부를 generation-spec으로 패키징하여 출력
```

---

### 2.3 ROOM이 없는 Protocol은 무효

아래 조건 중 하나라도 해당하면 해당 Protocol은 **배포 불가** 상태다:

- `[ANALYSIS ROOM]` 헤더 블록이 없다
- `[GENERATION ROOM]` 헤더 블록이 없다
- ANALYSIS ROOM에 분석 축(Axis)이 정의되지 않았다
- GENERATION ROOM에 엔진이 선언되지 않았다
- ANALYSIS ROOM에 `SPEC_OUTPUT: analysis-spec` 지시가 없다
- GENERATION ROOM에 `SPEC_OUTPUT: generation-spec` 지시가 없다

배포 불가 상태의 Protocol을 기반으로 코드를 구현하지 않는다.
Loop A 검증(`/ralph-loop`)은 위 조건을 필수 체크 항목으로 포함한다.

---

## 3. 레이어 구조 및 경계

| 레이어 | 표준 | 책임 |
|--------|------|------|
| **UI** | Next.js (App Router) + Tailwind CSS | 사용자 입력 수집, 결과 렌더링 |
| **API Route** | Next.js API Routes | 입력 검증, Gemini API 호출, 응답 반환 |
| **AI Core — 분석/추론** | Gemini API (`gemini-3.1-pro-preview`) | ANALYSIS ROOM 실행, 텍스트 결과물 생성 |
| **AI Core — 이미지 생성** | Gemini API (`gemini-3.1-flash-image-preview`) | GENERATION ROOM 실행, 이미지 결과물 생성 |
| **이미지 처리** | 노드별 별도 정의 | 입력 이미지 전처리(base64), 출력 이미지 후처리 |
| **배포** | Vercel | 정적 자산 + 서버리스 함수 호스팅 |
| **패키지 매니저** | npm | 의존성 관리 |

**레이어 경계 규칙:**
- UI 레이어는 Gemini API를 직접 호출하지 않는다 — 반드시 API Route를 경유한다
- API Route는 `buildSystemPrompt()`를 통해서만 시스템 프롬프트를 구성한다
- Protocol 내용은 코드에 하드코딩하지 않는다 — `protocol` 파일에서 로드한다

**노드 앱 내부 모듈 구조** (모든 노드 공통):

```
n#-project-name/
├── src/               ← 노드 앱 소스 (UI, API Route, lib 등)
├── protocol/          ← 노드 전용 하네스 (Protocol, Knowledge Docs)
└── .env.local         ← API 키 등 환경변수
```

---

## 4. 아키텍처 불변식

반드시 유지해야 하는 제약 — 어떤 이유로도 위반하지 않는다:

1. **Protocol 우선**: AI 동작은 항상 Protocol로 제어한다. 코드로 Protocol 결함을 우회하지 않는다
2. **주입 경로 단일화**: 시스템 프롬프트는 반드시 `buildSystemPrompt()`를 통해서만 구성된다
3. **노드 독립성**: 각 노드 앱은 다른 노드 앱에 의존하지 않는다
4. **버전 불삭제**: 이전 Protocol 버전 파일을 삭제하지 않는다
5. **스펙 선행**: product-spec 없이 노드 앱을 구현하지 않는다

**만들어서는 안 되는 의존성:**
- 노드 앱 → 다른 노드 앱 (직접 호출 금지)
- UI → Gemini API (API Route 경유 필수)
- API Route → Gemini API (buildSystemPrompt 없이 직접 호출 금지)
- 코드 → Protocol 내용 하드코딩 (`protocol/` 파일 로드 의무)

---

## 5. 데이터 흐름

**노드 내 입력 → 출력 단계:**

```
1. 사용자 입력 (UI)
   └─ 이미지, 텍스트, 파라미터

2. API Route 수신
   └─ 입력 검증 + 형식 변환 (이미지 → base64)

3. 시스템 프롬프트 조합 (buildSystemPrompt)
   ┌─ Principle Protocol (필수)
   ├─ Knowledge Doc 1 (선택)
   └─ Knowledge Doc 2 (선택)
   → [Protocol]\n\n---\n\n[Knowledge Doc 1]\n\n---\n\n...

4. Gemini API 호출
   └─ ANALYSIS ROOM: gemini-3.1-pro-preview
      config.systemInstruction: buildSystemPrompt(...)
      contents: [{ role: "user", parts: [{ text: userInput }] }]

5. analysis-spec 수신 → USER INPUT 단계로 전달

6. GENERATION ROOM: gemini-3.1-pro-preview 또는 gemini-3.1-flash-image-preview
   └─ analysis-spec + input-spec 기반으로 결과물 생성

7. generation-spec 수신 + 후처리
   └─ 텍스트, 이미지, 구조화 데이터

8. UI 렌더링
   └─ 사용자에게 산출물 표시
```

**계층 충돌 규칙**: 상위 계층이 하위 계층을 항상 override한다.

```
Principle Protocol  >  Knowledge Docs  >  User Input
     (불변 원칙)           (참조 지식)       (실행 명령)
```

**핵심 함수 구현 (TypeScript)**:

```typescript
function buildSystemPrompt(
  principleProtocol: string,
  knowledgeDocs: string[] = []
): string {
  return [principleProtocol, ...knowledgeDocs].join("\n\n---\n\n");
}

// ANALYSIS ROOM — 분석/추론 및 텍스트 결과물 생성
const analysisResponse = await gemini.models.generateContent({
  model: "gemini-3.1-pro-preview",
  config: { systemInstruction: buildSystemPrompt(principleProtocol, knowledgeDocs) },
  contents: [{ role: "user", parts: [{ text: userInput }] }],
});

// GENERATION ROOM — 이미지 결과물 생성
const imageResponse = await gemini.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  config: {
    systemInstruction: buildSystemPrompt(imageGenProtocol),
    responseModalities: ["TEXT", "IMAGE"],
  },
  contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
});
```

---

## 6. 핵심 타입 / 데이터 구조

Agent는 아래 NodeContract의 모든 필드가 product-spec에 정의되어 있을 때만 배포를 승인한다.
미완성 필드가 있으면 배포를 차단하고 product-spec 작성을 먼저 요청한다.

```typescript
interface NodeContract {
  nodeId: string;              // 예: "N09"
  nodeName: string;            // 예: "change viewpoint"
  phase: 1 | 2 | 3 | 4;
  input: {
    type: string;              // 예: "image + text"
    schema: object;
  };
  output: {
    type: string;              // 예: "image + analysis report"
    schema: object;
  };
  protocolVersion: string;     // 예: "v4"
  knowledgeDocs: string[];     // 함께 주입되는 지식문서 목록
  complianceChecks: string[];  // QUALITY_SCORE.md의 체크리스트 항목
}

// 프로세스 간 작업명세서 타입

interface AnalysisSpec {
  process: "analysis";
  results: Array<{
    axis: string;
    finding: string;
    confidence: "HIGH" | "MID" | "LOW";
  }>;
  failure_modes: Array<{
    axis: string;
    reason: string;
    result: null;
  }>;
  passed: boolean;
}

interface InputSpec {
  process: "user_input";
  selections: Record<string, string | number | boolean>;
  parameters: Record<string, unknown>;
  generation_direction: string;
}

interface GenerationSpec {
  process: "generation";
  engine: string;
  type: "text" | "image";
  input_refs: {
    analysis_spec: string;
    input_spec: string;
  };
  output: string;
  quality_gate: "PASS" | "FAIL";
  regenerated: boolean;
}
```

---

## 횡단 관심사

모든 노드 앱에 공통으로 적용되는 비기능 요구사항:

**에러 처리**
- Gemini API 호출 실패 시 사용자에게 명확한 오류 메시지를 반환한다
- Protocol 로드 실패는 앱 실행을 중단시키는 치명적 오류로 처리한다

**로깅**
- API Route에서 요청/응답 로그를 기록한다 (입력 타입, 토큰 수, 처리 시간)
- Protocol 버전을 로그에 함께 기록한다 (어떤 Protocol이 응답을 생성했는지 추적 가능)

**보안**
- Gemini API 키는 환경변수로만 관리한다 (`GEMINI_API_KEY`)
- 사용자 업로드 이미지는 서버에 저장하지 않는다 (메모리 처리 또는 즉시 삭제)
- 상세 기준: `docs/SECURITY.md` 참조

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
