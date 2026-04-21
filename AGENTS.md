# AGENTS.md — CAI 하네스 헌법

> **이 파일은 CAI 하네스의 헌법입니다.**
> 모든 세션 시작 시 첫 번째로 로드됩니다.
> 이 파일을 읽고 나면 "지금 내가 무엇을 해야 하는가"가 즉시 결정됩니다.

---

## 제1조 — 하네스의 존재 이유

CAI 하네스는 아래 워크플로우를 구현하는 **모든 앱**을 위한 **범용 AI 실행 환경**이다.

```
업로드 → 분석/추론 → 사용자 입력 → 결과물 생성
```

하네스의 단일 임무:
**AI가 각 단계에서 명료하게 사고할 수 있는 구조화된 공간(ROOM)을 Protocol 안에 강제한다.**

ROOM이 없으면 AI는 자유 형식으로 추론하며, 출력은 예측 불가능해진다.
ROOM이 있으면 AI는 정해진 구조 안에서 추론하며, 출력은 검증 가능해진다.

워크플로우와 ROOM의 상세 정의는 `ARCHITECTURE.md`에서 관할한다.

### 1.1 프로세스 간 작업명세서 전달 원칙

**이 원칙은 헌법이다.** 모든 노드의 모든 프로세스에 예외 없이 적용된다.

모든 노드의 작업은 여러 프로세스를 거쳐 결과물을 생성한다.
**각 프로세스가 완료될 때마다 해당 프로세스의 작업명세서(Process Spec)를 반드시 출력하고, 그 작업명세서를 다음 프로세스의 입력으로 전달해야 한다.**

---

## 보편 워크플로우

CAI 하네스를 사용하는 모든 앱은 아래 4단계 흐름을 따른다. 이 흐름은 변경할 수 없다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [UPLOAD]      →   [ANALYSIS/REASONING]   →   [USER INPUT]             │
│  이미지 or 텍스트      AI 개입 구간                  사용자 판단 구간          │
│                        ANALYSIS ROOM                                    │
│                        gemini-3.1-pro-preview                           │
│                                                    ↓                    │
│                                            [RESULT GENERATION]          │
│                                             AI 개입 구간                  │
│                                             GENERATION ROOM             │
│                                         ┌── 텍스트: gemini-3.1-pro-preview│
│                                         └── 이미지: gemini-3.1-flash-   │
│                                                     image-preview       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 각 단계 정의

| 단계 | 행위자 | 역할 |
|------|--------|------|
| **UPLOAD** | 사용자 | 이미지 또는 텍스트를 앱에 제출한다 |
| **ANALYSIS/REASONING** | AI (`gemini-3.1-pro-preview`) | 입력을 구조적으로 분석·추론한다. Protocol의 `[ANALYSIS ROOM]`이 이 단계를 제어한다 |
| **USER INPUT** | 사용자 | 분석 결과를 바탕으로 생성 방향을 결정하고 파라미터를 입력한다 |
| **RESULT GENERATION** | AI | 사용자 입력과 분석 결과를 결합하여 최종 결과물을 생성한다. Protocol의 `[GENERATION ROOM]`이 이 단계를 제어한다 |

### AI 개입 원칙

- AI는 **ANALYSIS/REASONING** 과 **RESULT GENERATION**, 두 구간에서만 개입한다.
- 두 구간 모두 Protocol 파일에 명시된 ROOM 블록의 지시를 따른다.
- ROOM 블록 밖의 AI 동작은 정의되지 않은 것으로 간주한다.

---

## 제2조 — 금지 행동

Agent는 아래 행동을 어떤 이유로도 수행하지 않는다.

### 2.1 Protocol 관련

- Protocol 결함을 코드 레이어에서 보완하는 것
- `[ANALYSIS ROOM]` 또는 `[GENERATION ROOM]` 블록 없이 Protocol 배포
- Loop A 정합성 검증(`/ralph-loop`) 없이 새 Protocol 배포
- 이전 Protocol 버전 파일 삭제
- 작업명세서(Process Spec) 없이 다음 프로세스를 시작하는 것 (ARCHITECTURE.md 1.1 위반)
- 작업명세서를 자유 서술 형식으로 출력하는 것 — 구조화 필드만 허용

### 2.2 ROOM 관련

- ROOM 블록 내 지시를 코드 하드코딩으로 대체하는 것
- ANALYSIS ROOM의 Axis를 임의로 추가하거나 생략하는 것 (product-spec 승인 없이)
- GENERATION ROOM의 엔진을 Protocol 외부에서 교체하는 것

### 2.3 개발 프로세스 관련

- product-spec 없이 노드 앱 개발 시작
- NodeContract 미완성 필드를 임의로 추측하여 채우는 것
- exec-plan 없이 노드 단위 작업 시작
- `docs/generated/` 파일을 수동으로 작성하는 것
- 완료된 exec-plan 삭제 (`completed/`로 이동할 것)

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
