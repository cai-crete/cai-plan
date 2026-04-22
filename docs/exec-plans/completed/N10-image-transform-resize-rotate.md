# N10 — 아트보드 내 이미지 리사이즈 & 로테이트

**상태**: PLANNING  
**날짜**: 2026-04-22  
**대상**: 아트보드(`artboard` 타입)에 업로드된 배경 이미지(`item.src`)

---

## 목표

아트보드 안에 업로드된 이미지를 "이미지 변환 모드"에서 자유롭게 리사이즈(가로/세로 독립)하고 회전할 수 있게 한다.  
아트보드 프레임(흰 캔버스)은 고정이며, 내부 이미지만 변환된다.

---

## 전체 프로세스 & 단계별 활성 UI

```
[1. UPLOAD] → [2. IMAGE TRANSFORM MODE 진입] → [3. RESIZE / ROTATE] → [4. CONFIRM / CANCEL]
```

---

### Process 1 — UPLOAD (이미지 업로드)

**트리거**: 아트보드 선택 후 아이템 상단 컨트롤바 Upload 버튼 클릭

**활성 UI**:
| 위치 | 컴포넌트 | 상태 |
|------|----------|------|
| 아트보드 아이템 상단 컨트롤바 | Upload 아이콘 버튼 | 클릭 → `replaceArtboardFileInputRef` 파일 다이얼로그 오픈 |

**동작**:
- `handleReplaceArtboardImage`: 선택한 파일을 읽어 해당 아트보드의 `item.src` 교체
- 교체 완료 후 `contentTransform` 초기값 자동 계산 (이미지를 아트보드에 fit-contain으로 배치)

---

### Process 2 — IMAGE TRANSFORM MODE 진입

**트리거**: select 모드에서 아트보드를 선택한 뒤, 아트보드 내부 이미지 위를 클릭

**진입 조건**:
- 현재 `canvasMode === 'select'`
- 클릭 대상이 `item.src`가 있는 `artboard` 타입
- 아트보드가 이미 선택된 상태(= `selectedItemIds`에 포함)에서 이미지 재클릭

**상태 변화 (`page.tsx`)**:
```ts
// 추가할 상태
const [imageEditingId, setImageEditingId] = useState<string | null>(null);
```

**활성 UI**:
| 위치 | 컴포넌트 | 변화 |
|------|----------|------|
| 아트보드 테두리 | 선택 테두리 색상 | 파란색(`#1d4ed8`) → 주황색(`#f97316`) |
| 아트보드 내부 이미지 | 변환 핸들 레이어 | 8개 리사이즈 핸들 + 1개 회전 핸들 표시 시작 |
| 아트보드 아이템 상단 컨트롤바 | 기존 버튼 영역 | 숨김 (편집 중에는 하단 확정/취소 바로 제어) |

---

### Process 3 — RESIZE / ROTATE (이미지 변환)

**발동 조건**: `imageEditingId === item.id` 인 아트보드 내부

이미지의 `contentTransform` 초기값 (없으면 자동 생성):
```ts
contentTransform: {
  x: 0,              // 아트보드 좌상단 기준 이미지 위치 X (px)
  y: 0,              // 아트보드 좌상단 기준 이미지 위치 Y (px)
  width: item.width, // 이미지 표시 너비
  height: item.height,
  rotation: 0,       // 회전 각도 (degree)
}
```

#### 3-A. 이미지 이동 (Move)

| 동작 | UI |
|------|-----|
| 이미지 위에서 드래그 | 커서 `move`, `contentTransform.x` / `.y` 실시간 업데이트 |

#### 3-B. 리사이즈 (Resize) — 8개 핸들

아트보드의 `overflow: hidden` 임시 해제 → 핸들이 아트보드 경계 밖에 표시됨

| 핸들 위치 | 커서 | 조절 축 |
|-----------|------|---------|
| 좌상 모서리 | `nwse-resize` | 가로 + 세로 |
| 우상 모서리 | `nesw-resize` | 가로 + 세로 |
| 좌하 모서리 | `nesw-resize` | 가로 + 세로 |
| 우하 모서리 | `nwse-resize` | 가로 + 세로 |
| 상단 중앙 엣지 | `ns-resize` | 세로(height)만 |
| 하단 중앙 엣지 | `ns-resize` | 세로(height)만 |
| 좌 중앙 엣지 | `ew-resize` | 가로(width)만 |
| 우 중앙 엣지 | `ew-resize` | 가로(width)만 |

**Shift + 모서리 드래그**: aspect ratio 고정 리사이즈

#### 3-C. 회전 (Rotate) — 1개 핸들

| 위치 | 디자인 | 동작 |
|------|--------|------|
| 이미지 상단 중앙, 28px 위 | 파란 원 + 회전 화살표 아이콘 | 드래그 → 이미지 중심 기준 각도 계산 |

```
angle = atan2(cursorY - 이미지중심Y, cursorX - 이미지중심X) × (180/π) + 90
```
**Shift + 드래그**: 15° 단위 스냅

**실시간 피드백**:
| 위치 | 컴포넌트 | 내용 |
|------|----------|------|
| 아트보드 내 이미지 | CSS transform | `translate(x, y) rotate(Rdeg)` 실시간 반영 |
| 아트보드 하단 확정/취소 바 | 각도 레이블 | `rotation !== 0` 이면 `"45°"` 표시 |

---

### Process 4 — CONFIRM / CANCEL (확정 / 취소)

**트리거 A (확정)**: 아트보드 하단 컨트롤바 ✓ 버튼 클릭  
**트리거 B (취소)**: 아트보드 하단 컨트롤바 ✕ 버튼 클릭 또는 아트보드 외부 클릭

**확정/취소 바 위치**: 아트보드 하단, 아이템 상단 컨트롤바와 동일한 스타일(pill, backdrop-blur)

**활성 UI**:
| 위치 | 컴포넌트 | 상태 |
|------|----------|------|
| 아트보드 하단 컨트롤바 | ✓ 확정 버튼 (초록색) | 클릭 → 변환 확정, `imageEditingId = null` |
| 아트보드 하단 컨트롤바 | ✕ 취소 버튼 (회색) | 클릭 → 변환 롤백, `imageEditingId = null` |
| 아트보드 테두리 | 주황 편집 테두리 | 파란 선택 테두리로 복귀 |
| 핸들 오버레이 | 8 + 1 핸들 | 사라짐 |

**확정 동작 (✓)**:
1. `imageEditingId = null`
2. 현재 `contentTransform`을 `CanvasItem`에 저장 (히스토리 push)

**취소 동작 (✕)**:
1. `imageEditingId = null`
2. `contentTransform`을 편집 진입 시점 값으로 롤백

---

## 데이터 모델 변경

### `sketch-to-plan/src/types/canvas.ts`

```ts
export interface CanvasItem {
  // ... 기존 필드 ...
  contentTransform?: {
    x: number;        // 아트보드 내 이미지 위치 X
    y: number;        // 아트보드 내 이미지 위치 Y
    width: number;    // 표시 너비
    height: number;   // 표시 높이
    rotation: number; // 회전 각도 (degree)
  };
}
```

기존 `contentScale`, `contentOffset`은 유지 (ZoomIn/Out/Lock과 독립).  
`contentTransform`이 있을 때는 이 값으로 이미지 렌더링 우선 적용.

---

## 렌더링 구조 (변경 후)

```
<ArtboardItem>
  <div overflow={imageEditingId === id ? 'visible' : 'hidden'}>
    {item.src && (
      <img
        style={{
          position: 'absolute',
          left: ct?.x ?? 0,
          top: ct?.y ?? 0,
          width: ct?.width ?? '100%',
          height: ct?.height ?? '100%',
          transform: `rotate(${ct?.rotation ?? 0}deg)`,
          transformOrigin: 'center center',
        }}
      />
    )}
    <GridOverlay />
    <PixelCanvas />

    {imageEditingId === id && (
      <ImageTransformHandles  ← 신규 컴포넌트 (page.tsx 인라인 또는 별도 파일)
        transform={item.contentTransform}
        artboardWidth={item.width}
        artboardHeight={item.height}
        onMoveStart={...}
        onResizeStart={...}
        onRotateStart={...}
      />
    )}
  </div>

  {/* 하단 확정/취소 바 — imageEditingId === id 일 때만 */}
  {imageEditingId === id && (
    <ConfirmBar
      rotation={item.contentTransform?.rotation ?? 0}
      onConfirm={handleImageTransformConfirm}
      onCancel={handleImageTransformCancel}
      barScale={barScale}
      theme={theme}
    />
  )}
</ArtboardItem>
```

---

## 구현 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `types/canvas.ts` | `contentTransform` 필드 추가 |
| `app/page.tsx` | `imageEditingId` 상태, 편집 진입 클릭 감지, 이미지 변환 PointerEvent 처리, 렌더링 핸들 오버레이, 하단 확정/취소 바 |

---

## 검증 기준

1. 아트보드 선택 → 컨트롤바 Upload → 이미지 업로드
2. select 모드에서 이미지 재클릭 → 주황 테두리 + 8+1 핸들 표시
3. 모서리 드래그 → 가로/세로 독립 리사이즈
4. Shift + 모서리 드래그 → aspect ratio 고정
5. 엣지 드래그 → 해당 축만 리사이즈
6. 이미지 위 드래그 → 이미지 이동
7. 회전 핸들 드래그 → 이미지 중심 기준 회전
8. Shift + 회전 드래그 → 15° 스냅, 하단 바 각도 표시
9. ✓ 확정 → 변환 저장, 파란 테두리 복귀
10. ✕ 취소 → 편집 진입 시점 상태로 롤백
11. Ctrl+Z → 확정 직전 상태로 되돌리기
12. 새로고침 후 `contentTransform` 유지 (localStorage 직렬화)
13. ZoomIn/ZoomOut/Lock 기존 동작 영향 없음
