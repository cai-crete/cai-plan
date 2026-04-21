# Right Panel Style Guide — SketchToPlanPanel

> 출처: `sketch-to-plan/src/components/panels/SketchToPlanPanel.tsx`
> 생성일: 2026-04-21
> 목적: 다른 CAI 노드 앱에서 동일한 패널 스타일을 재사용하기 위한 참조 문서

---

## 패널 컨테이너

```tsx
<aside className="h-full w-full rounded-[1.25rem] flex flex-col overflow-hidden
  bg-white/80 dark:bg-black/80
  backdrop-blur-sm
  border border-black/10 dark:border-white/10">
```

| 속성 | 값 |
|------|----|
| border-radius | `1.25rem` |
| background | `white/80` (light) / `black/80` (dark) |
| backdrop-blur | `sm` |
| border | `black/10` (light) / `white/10` (dark) |

---

## 섹션 레이블 (공통)

```tsx
<span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">
  SECTION TITLE
</span>
```

---

## Textarea (Prompt 입력)

```tsx
<textarea
  placeholder="e.g. 3 bedrooms, open kitchen, south-facing living room"
  className="w-full h-[7.5rem] resize-none
    rounded-[0.75rem]
    border border-black/10 dark:border-white/10
    bg-white/50 dark:bg-black/50
    p-3
    font-mono text-xs
    focus:outline-none
    focus:border-black/30 dark:focus:border-white/30"
/>
```

| 속성 | 값 |
|------|----|
| height | `7.5rem` |
| border-radius | `0.75rem` |
| font | `font-mono text-xs` |
| padding | `p-3` |
| focus border | `black/30` (light) / `white/30` (dark) |

---

## Dropdown 버튼 (Building Type)

```tsx
<button className="w-full h-[2.75rem] px-4
  rounded-[0.75rem]
  border border-black/10 dark:border-white/10
  bg-white/50 dark:bg-black/50
  flex items-center justify-between
  font-mono text-xs
  hover:bg-black/5 dark:hover:bg-white/5
  transition-colors">
  <span className={selectedValue ? 'opacity-100' : 'opacity-40'}>
    {selectedValue?.label ?? 'Select...'}
  </span>
  <ChevronDown size={14} className="opacity-40 transition-transform duration-200" />
</button>
```

**드롭다운 리스트 패널:**
```tsx
<div className="absolute top-full left-0 right-0 mt-1 z-50
  rounded-[0.75rem]
  border border-black/10 dark:border-white/10
  bg-white dark:bg-black
  shadow-lg overflow-hidden">
  {/* 각 옵션 */}
  <button className="w-full px-4 py-2.5 text-left font-mono text-xs
    transition-colors
    hover:bg-black/5 dark:hover:bg-white/5
    /* 선택된 항목 */ bg-black/5 dark:bg-white/5 font-medium">
```

---

## Range Slider (Grid Module)

```tsx
<input type="range"
  className="w-full h-1 appearance-none rounded-full
    bg-black/10 dark:bg-white/10
    cursor-pointer
    accent-black dark:accent-white"
/>
```

**눈금 레이블:**
```tsx
<button className="font-mono text-[0.5625rem] tabular-nums transition-opacity
  /* 선택 */ opacity-100 font-medium
  /* 비선택 */ opacity-30 hover:opacity-60">
```

---

## Report/Output 박스 (Parameter Report)

```tsx
<div className="rounded-[0.75rem]
  border border-black/10 dark:border-white/10
  bg-black/5 dark:bg-white/5
  p-3
  max-h-[12rem] overflow-y-auto
  [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

  {/* 내용 있을 때 */}
  <pre className="font-mono text-[0.6875rem] leading-relaxed
    whitespace-pre-wrap break-words opacity-80">
    {content}
  </pre>

  {/* 내용 없을 때 */}
  <p className="font-mono text-[0.6875rem] opacity-30 italic">
    No report generated yet.
  </p>
</div>
```

---

## GENERATE 버튼 — 4가지 상태

```tsx
<button
  disabled={!canGenerate}
  className="relative w-full h-[2.75rem] rounded-full
    transition-all
    disabled:opacity-30 disabled:cursor-not-allowed
    flex items-center justify-center overflow-hidden
    border border-black/10 dark:border-white/10
    enabled:bg-black enabled:text-white
    enabled:dark:bg-white enabled:dark:text-black"
>
  {/* 1. 로딩 중 */}
  <Loader2 size={20} className="animate-spin" />

  {/* 2. 경고 (스케치 미선택 등) */}
  <>
    <AlertTriangle size={18} />
    <span className="font-sans text-sm">{warningMessage}</span>
  </>

  {/* 3. Ready */}
  <span className="font-display tracking-widest font-medium text-[1rem]">
    GENERATE
  </span>
</button>
```

| 상태 | 조건 | 시각 처리 |
|------|------|-----------|
| Ready | `floorType` 선택 + 미생성 중 + 경고 없음 | `bg-black text-white` |
| Disabled | `floorType` 미선택 | `opacity-30`, 투명 배경 |
| Loading | `isGenerating = true` | spinner + `opacity-30` |
| Warning | `generateWarning != null` | AlertTriangle + 메시지 텍스트 |

**`canGenerate` 조건:**
```tsx
const canGenerate = !!floorType && !isGenerating && !generateWarning;
```

---

## 하단 Copyright 영역

```tsx
<div className="p-3 mt-auto shrink-0 flex flex-col items-center gap-1">
  <p className="font-mono text-[0.625rem] opacity-40 text-center tracking-tighter">
    © CRETE CO.,LTD. 2026. ALL RIGHTS RESERVED.
  </p>
</div>
```

---

## 전체 패널 레이아웃 구조

```
aside (h-full, flex-col)
├── div.flex-1.overflow-y-auto  (스크롤 영역)
│   ├── PROMPT          (textarea)
│   ├── BUILDING TYPE   (dropdown)
│   ├── GRID MODULE     (range slider)
│   └── PARAMETER REPORT (pre/placeholder box)
├── div.px-4.pb-2.pt-5  (GENERATE 버튼, shrink-0)
└── div.p-3.mt-auto     (copyright, shrink-0)
```

---

`COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.`
