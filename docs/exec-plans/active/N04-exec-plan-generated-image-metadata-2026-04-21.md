# N04 — Generated Image Metadata & Sidebar Context

**Date:** 2026-04-21  
**Status:** Active

---

## 목적

생성된 이미지(sketch_generated)에 생성 당시의 파라미터를 저장하고,
이미지 클릭 시 우측 사이드바에서 해당 파라미터를 복원한다.

---

## 요구사항

1. **생성 이미지에 메타데이터 저장**
   - `planItem.parameters`에 `parameterReport`, `floorType`, `gridModule` 저장
   - 저장 시점: `generatedPlanImage` useEffect (기존 planItem 생성 코드 내)

2. **sketch_generated 아이템 클릭 시**
   - `item.parameters`에서 값 읽어 `setFloorType`, `setGridModule`, `setParameterReport` 호출
   - 사이드바가 해당 이미지의 생성 파라미터를 표시

3. **빈 캔버스 클릭 시 (selectedItemIds = [])**
   - `parameterReport` → null
   - `floorType` → ''
   - `gridModule` → 4000 (기본값)

4. **artboard / upload 클릭 시**
   - 사이드바 상태 유지 (사용자의 현재 입력 보존)

---

## 변경 파일

- `sketch-to-plan/src/app/page.tsx` — 메타데이터 저장 + selectedItemIds effect

---

## 구현 세부사항

### 1. planItem.parameters에 저장 (page.tsx line ~273)

```ts
const planItem: CanvasItem = {
  ...
  parameters: {
    parameterReport: roomAnalysis ?? null,
    floorType,
    gridModule,
  },
};
```

### 2. selectedItemIds useEffect (page.tsx — 기존 state 선언 아래)

```ts
useEffect(() => {
  if (selectedItemIds.length === 0) {
    setParameterReport(null);
    setFloorType('');
    setGridModule(4000);
    return;
  }
  const item = canvasItems.find(i => i.id === selectedItemIds[0]);
  if (item?.type === 'sketch_generated' && item.parameters) {
    setParameterReport((item.parameters.parameterReport as string) ?? null);
    if (item.parameters.floorType) setFloorType(item.parameters.floorType as string);
    if (item.parameters.gridModule) setGridModule(item.parameters.gridModule as number);
  }
}, [selectedItemIds]);
```

---

## 완료 기준

- [ ] 이미지 생성 후 해당 CanvasItem.parameters에 3개 값 포함
- [ ] sketch_generated 클릭 → 사이드바에 저장된 BuildingType, GridModule, ParameterReport 표시
- [ ] 빈 캔버스 클릭 → 사이드바 3개 값 초기화
