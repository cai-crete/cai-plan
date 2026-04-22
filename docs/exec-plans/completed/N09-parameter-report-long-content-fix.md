# N09: Parameter Report Long Content Fix

## 문제
생성된 이미지의 parameterReport 내용이 길면 우측 사이드바에 출력되지 않음

## 근본 원인 분석

### Cause 1 — Stale closure in generatedPlanImage effect
- `generatedPlanImage` effect는 `[generatedPlanImage]`만 dependency
- `roomAnalysis`는 dependency에 없어 effect 내부 closure가 stale 가능
- `img.onload` 콜백은 async 실행 — 콜백이 실행될 시점에 다른 render가 발생했을 경우
  closure의 `roomAnalysis`가 이전 render 값으로 고정됨
- 긴 content일수록 Gemini가 더 많은 텍스트를 생성 → render 타이밍 차이 발생 확률 증가

### Cause 2 — Page reload race condition
1. localStorage에서 items 복원 (parameterReport 없음)
2. 사용자가 sketch_generated 아이템 클릭
3. sync effect 실행 → `item.parameters.parameterReport = undefined` → null 표시
4. IndexedDB 비동기 복원 완료 → canvasItems 업데이트
5. `selectedItemIds` 변경 없음 → sync effect 재실행 없음 → parameterReport null 유지

## 수정 계획

### Fix 1: roomAnalysisRef 추가
```typescript
const roomAnalysisRef = useRef<string | null>(null);
useEffect(() => { roomAnalysisRef.current = roomAnalysis; }, [roomAnalysis]);
```
- `generatedPlanImage` effect의 placeItem 내부에서 `roomAnalysis` → `roomAnalysisRef.current` 교체
- ref는 항상 최신 값을 참조하므로 stale closure 방지

### Fix 2: 복원 완료 후 parameterReport 재동기화
- mount 비동기 루프의 setCanvasItems 호출 직후
- `selectedItemIdsRef.current[0]`가 updates에 포함된 경우 `setParameterReport` 호출

## 영향 범위
- `sketch-to-plan/src/app/page.tsx` 수정
