---
id: N03-exec-plan-ui-fixes-2026-04-21
created: 2026-04-21
status: in-progress
node: sketch-to-plan
---

# Exec Plan N03 — PARAMETER REPORT 버그 수정 + 패널 스타일 출력

## 개요

- **작업 유형**: 버그 수정 + 스타일 문서화
- **대상 노드**: sketch-to-plan
- **시작일**: 2026-04-21

## 목표

1. exec-plan 파일명에 N## 접두사를 붙여 리비전 관리 체계 확립
2. PARAMETER REPORT에 분석 결과가 표시되지 않는 버그 수정
3. 현재 우측 패널의 플레이스홀더·버튼 스타일을 다른 앱에서 재사용할 수 있도록 출력

---

## Feature List

```json
{
  "feature_list": [
    { "id": "F01", "feature": "exec-plan 파일명 N## 접두사 규칙 확립 및 N03 문서 생성", "passes": false },
    { "id": "F02", "feature": "PARAMETER REPORT 버그 수정 — resetGeneration() 호출 전 roomAnalysis 보존", "passes": false },
    { "id": "F03", "feature": "우측 패널 플레이스홀더·버튼 스타일을 재사용 가능한 형태로 출력", "passes": false }
  ]
}
```

---

## 버그 분석 — PARAMETER REPORT (F02)

### 근본 원인

`page.tsx` `useEffect` (dep: `generatedPlanImage`) 내에서:

```tsx
setCanvasItems(prev => [...prev, planItem]);
resetGeneration();   // ← 이 시점에 roomAnalysis = null 로 초기화됨
setPlanPrompt('');
```

`resetGeneration()`은 hook 내부에서 `setRoomAnalysis(null)`을 호출한다.
`RightSidebar`에는 hook의 `roomAnalysis`가 직접 전달되므로, 생성 완료 직후 `null`로 덮어씌워진다.

### 수정 방법

`page.tsx`에 별도 상태 `parameterReport`를 추가하여 `resetGeneration()` 호출 전에 capture:

```tsx
const [parameterReport, setParameterReport] = useState<string | null>(null);

// useEffect 내:
if (roomAnalysis) setParameterReport(roomAnalysis);
resetGeneration();
```

`RightSidebar`에는 `parameterReport`를 전달한다.

---

## 스타일 출력 범위 (F03)

대상 파일: `sketch-to-plan/src/components/panels/SketchToPlanPanel.tsx`

출력 항목:
- textarea placeholder 스타일
- Dropdown (Building Type) 버튼 스타일
- GENERATE 버튼 스타일 (enabled / disabled / loading / warning 상태)
- PARAMETER REPORT 박스 스타일

---

## Progress

- [ ] 2026-04-21 — N03 exec-plan 문서 생성
- [ ] 2026-04-21 — page.tsx: parameterReport 상태 추가 + useEffect 수정
- [ ] 2026-04-21 — 패널 스타일 출력 (docs/report/ 저장)

---

## Decision Log

| 날짜 | 결정 | 이유 |
|------|------|------|
| 2026-04-21 | exec-plan 파일명에 N## 접두사 도입 | 리비전 순서를 파일명만으로 파악 가능하게 |
| 2026-04-21 | roomAnalysis를 hook에서 분리하여 page.tsx 로컬 상태로 보존 | hook reset이 UI 상태를 지우는 사이드 이펙트 방지 |

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
