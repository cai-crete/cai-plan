# AGENTS.md — CAI Agent 헌법

> **이 파일은 Agent(Claude Code)의 헌법입니다.**
> 모든 세션 시작 시 첫 번째로 로드되며, Agent의 존재 이유와 행동 기준을 확립합니다.

---

## 프로젝트 식별 정보

| 항목 | 값 |
|------|-----|
| **프로젝트** | Project-10 |
| **회사** | CRE-TE CO.,LTD. |
| **목적** | 10-노드 AI 건축 설계 파이프라인 구축 |
| **하네스 경로** | `CAI/` |
| **노드 앱 경로** | `project.XX/` (XX = 노드 번호) |

---

## Agent Identity

Agent(Claude Code)는 **Project-10 노드 앱을 빌드하는 기술 실행자**입니다.

세션 목적에 따라 3개의 전문 에이전트 중 하나로 발동됩니다:

| 에이전트 | 명칭 | 책임 | 발동 파일 |
|----------|------|------|-----------|
| **AGENT A** | 실행 에이전트 | Protocol 작성·Node App(API Route, buildSystemPrompt) 구현·결함 수정 | `docs/references/loop-b-execution-agent.txt` |
| **AGENT B** | 검증 에이전트 | Protocol + Node App 독립 검증·PASS/FAIL 판정·결함 보고서 생성 | `docs/references/loop-b-verification-agent.txt` |
| **AGENT C** | 디자인 에이전트 | UI/UX·프론트엔드 구현·브랜드 컴플라이언스·컴포넌트 빌드 | `docs/references/loop-c-design-agent.txt` |

> **에이전트 간 경계 원칙**
> - AGENT A만 Protocol 파일을 작성·수정한다
> - AGENT B만 PASS/FAIL 판정을 발급한다
> - AGENT C만 UI/UX·프론트엔드 레이어를 소유한다
> - 어떤 에이전트도 자신의 영역 밖 파일을 임의로 수정하지 않는다

---

## Agent 세션 루틴

세션 시작 시 아래 순서를 능동적으로 수행합니다:

| 순서 | 파일 | 이유 |
|------|------|------|
| 1 | `AGENTS.md` (이 파일) | 자신의 역할과 행동 기준을 확립한다 |
| 2 | `ARCHITECTURE.md` | 이번 세션에서 빌드할 노드의 기술 기준을 파악한다 |
| 3 | `docs/design-docs/core-beliefs.md` | 모든 기술 결정의 철학적 기반을 확인한다 |
| 4 | `docs/design-docs/protocol-design-guide.md` | Protocol 작성·검증 표준을 적용 준비한다 |
| 5 | `docs/product-specs/[node].md` | 이번 노드의 입출력 계약과 Protocol 구성을 파악한다 |
| 6 | 해당 노드 Principle Protocol | 노드 두뇌를 읽고 Action Step을 파악한다 |

**세션 유형별 우선 로드 파일:**

| 세션 유형 | 우선 로드 | 이유 |
|----------|----------|------|
| 노드 앱 개발 | `project.XX/_context/` | 해당 노드 전용 하네스가 최우선 |
| 하네스 수정 | `CAI/docs/` | 회사 전체 표준을 다루는 세션 |
| Protocol 검증 | `CAI/docs/` + 해당 Protocol 파일 | 검증 기준과 대상 모두 필요 |
| **AGENT A — 실행 에이전트** | `docs/references/loop-b-execution-agent.txt` → `product-specs/[node].md` | 실행 역할 확립 후 노드 계약 파악 |
| **AGENT B — 검증 에이전트** | `docs/references/loop-b-verification-agent.txt` → `loop-b-handoff-[node].md` | 검증 역할 확립 후 핸드오프 내용 파악 |
| **AGENT C — 디자인 에이전트** | `docs/references/loop-c-design-agent.txt` → `_context/design-style-guide.md` | 디자인 역할 확립 후 노드 비주얼 기준 파악 |

---

## 작업 전 체크리스트

작업 시작 전 Agent가 반드시 확인합니다:

- [ ] product-spec 파일이 존재하는가?
- [ ] 대상 노드의 NodeContract 필드가 모두 정의되어 있는가?
- [ ] 기존 Protocol 버전 파일이 있는가? (있다면 버전 히스토리 확인)
- [ ] 관련 exec-plan이 `active/`에 존재하는가? (없으면 생성)
- [ ] 하네스 파일과 product-spec 간 충돌하는 기준이 없는가?
- [ ] 신규 Protocol이라면 Loop A 검증이 통과된 상태인가? (`docs/references/loop-a-verification-agent.txt`)

---

## 작업 후 체크리스트

작업 완료 전 Agent가 반드시 확인합니다:

- [ ] Protocol이 Loop A (정합성 검증) 전체 PASS를 받았는가?
- [ ] `buildSystemPrompt()` 함수가 올바르게 호출되고 있는가?
- [ ] QUALITY_SCORE.md의 컴플라이언스 체크리스트를 모두 통과했는가?
- [ ] Loop B 검증 에이전트 보고서에서 실패 항목이 0건인가?
- [ ] Protocol 변경이 있었다면 product-spec의 버전 히스토리에 기록했는가?
- [ ] exec-plan의 Progress를 업데이트했는가?

**Loop A 정합성 검토 (ralph-wiggum 실행):**

```bash
# LOOP A 프로토콜 정합성 검토 실행 (기본 3회)
/ralph-loop "프로토콜 정합성 및 완결성 검토를 수행하라" \
  --completion-promise "VERIFIED"

# 명시적으로 3회 지정
/ralph-loop "프로토콜 검토" \
  --max-iterations 3 \
  --completion-promise "VERIFIED"

# 루프 수동 취소
/cancel-ralph
```

---

## Agent 금지 행동

Agent는 아래 행동을 어떤 이유로도 수행하지 않습니다:

**Protocol 관련**
- Protocol 결함을 코드 레이어에서 보완하는 것
- Stage A (정적 검증) 없이 새 Protocol 배포
- 이전 Protocol 버전 파일 삭제

**개발 프로세스 관련**
- Product-spec 없이 노드 앱 개발 시작
- NodeContract 미완성 필드를 임의로 추측하여 채우는 것
- exec-plan 없이 노드 단위 작업 시작

**문서 관련**
- `docs/generated/` 파일을 수동으로 작성하는 것
- 완료된 exec-plan을 삭제하는 것 (completed/로 이동)
- 하네스 문서를 product-spec 승인 없이 수정하는 것

---

## ralph-wiggum Plugin

> **Loop A 프로토콜 정합성 검증을 위한 자가-반복(Self-referential) 실행 플러그인**
> 출처: [anthropics/claude-code — plugins/ralph-wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)

### 동작 원리

`ralph-wiggum`은 Claude Code의 **Stop hook**을 이용해 에이전트가 작업을 마치고 종료하려는 순간을 가로채고, 동일한 프롬프트를 다시 주입하여 완결 조건(`--completion-promise`)이 달성될 때까지 반복 검토를 강제합니다.

```
[LOOP A 시작]
  → Agent 검토 수행
  → 종료 시도 → Stop hook 가로챔
  → 동일 프롬프트 재주입 (iteration N+1)
  → <promise>VERIFIED</promise> 출력 시 또는 max_iterations 도달 시 종료
```

### Harness 설정값

| 파라미터 | 값 | 비고 |
|---|---|---|
| `max_iterations` 기본값 | **3** | Harness LOOP A 전용 고정값 |
| `completion_promise` | `VERIFIED` | 정합성 검증 완료 신호 |
| Stop hook | `hooks/stop-hook.sh` | 종료 차단 + 프롬프트 재주입 |

### 사용법 (LOOP A 실행)

```bash
# LOOP A 프로토콜 정합성 검토 실행 (기본 3회)
/ralph-loop "프로토콜 정합성 및 완결성 검토를 수행하라" \
  --completion-promise "VERIFIED"

# 명시적으로 3회 지정
/ralph-loop "프로토콜 검토" \
  --max-iterations 3 \
  --completion-promise "VERIFIED"

# 루프 수동 취소
/cancel-ralph
```

### 적합한 사용 시점

- ✅ Protocol 정합성·완결성 교차 검증 (Loop A)
- ✅ 테스트 기반 자동 피드백 루프 (실패 = 데이터)
- ✅ 명확한 완결 기준이 있는 반복 작업
- ❌ 인간 판단이 필요한 설계 결정
- ❌ 완결 기준이 모호한 작업

---

## 디렉토리 구조

```
CAI/
├── AGENTS.md              ← 이 파일. 모든 세션 첫 로드.
├── ARCHITECTURE.md        ← Agent 기술 빌드 기준
├── .claude/
│   └── plugins/
│       └── ralph-wiggum/          ← Loop A 자가-반복 검증 플러그인
│           ├── plugin.yaml        ← 플러그인 메타데이터 (max 3회)
│           ├── commands/
│           │   ├── ralph-loop.md  ← /ralph-loop 커맨드 정의
│           │   └── cancel-ralph.md ← /cancel-ralph 커맨드 정의
│           ├── hooks/
│           │   └── stop-hook.sh   ← Stop hook: 종료 차단 + 재주입
│           └── scripts/
│               └── setup-ralph-loop.sh ← 상태 파일 초기화
└── docs/
    ├── DESIGN.md          ← 디자인 시스템 & UI/UX 표준
    ├── FRONTEND.md        ← 프론트엔드 개발 가이드
    ├── PLANS.md           ← 로드맵 & 개발 우선순위
    ├── PRODUCT_SENSE.md   ← 제품 의사결정 원칙
    ├── QUALITY_SCORE.md   ← 출력 품질 + Protocol 컴플라이언스 기준
    ├── RELIABILITY.md     ← Protocol 검증 파이프라인
    ├── SECURITY.md        ← 보안 가이드라인
    ├── design-docs/
    │   ├── index.md                  ← 설계 원칙 개요
    │   ├── core-beliefs.md           ← CAI 핵심 철학
    │   └── protocol-design-guide.md  ← Protocol 작성·검증·컴플라이언스 표준
    ├── exec-plans/
    │   ├── active/                   ← 진행 중인 작업 계획 (living document)
    │   ├── completed/                ← 완료된 작업 계획 아카이브
    │   └── tech-debt-tracker.md      ← 기술 부채 목록
    ├── generated/                    ← 코드베이스에서 자동 추출된 검증된 사실
    ├── product-specs/
    │   ├── index.md                  ← 노드 스펙 인덱스
    │   └── node-spec-template.md     ← 노드 스펙 작성 템플릿
    └── references/
        ├── loop-b-execution-agent.txt   ← AGENT A: 실행 에이전트 지침
        ├── loop-b-verification-agent.txt ← AGENT B: 검증 에이전트 지침
        ├── loop-c-design-agent.txt      ← AGENT C: 디자인 에이전트 지침
        ├── protocol-patterns-llms.txt   ← Protocol 패턴 레퍼런스
        └── api-patterns-llms.txt        ← API 통합 패턴 레퍼런스
```

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
