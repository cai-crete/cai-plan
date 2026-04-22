'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  type PointerEvent,
} from 'react';
import { Download, Lock, Plus, Trash2, Unlock, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { InfiniteGrid } from '@/components/InfiniteGrid';
import LeftToolbar from '@/components/LeftToolbar';
import AppHeader from '@/components/AppHeader';
import RightSidebar from '@/components/RightSidebar';
import { usePlanGeneration } from '@/hooks/usePlanGeneration';
import type { CanvasItem, CanvasMode, Point } from '@/types/canvas';
import { saveImageToDB, loadImageFromDB, deleteImageFromDB } from '@/lib/imageDB';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ZOOM_STEPS = [10, 25, 50, 75, 100, 125, 150, 175, 200] as const;
const ZOOM_MIN = 10;
const ZOOM_MAX = 200;
const ZOOM_WHEEL_FACTOR = 0.1;
const ZOOM_PINCH_FACTOR = 0.5;
const DEFAULT_PEN_STROKE_WIDTH = 2;
const DEFAULT_ERASER_STROKE_WIDTH = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getTouchDistance(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches: React.TouchList): Point {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

// artboard-local 좌표 → contentOffset/contentScale 적용 후 실제 canvas 드로잉 좌표
function getDrawCoords(pt: { x: number; y: number }, artboard: { contentScale?: number; contentOffset?: { x: number; y: number } }): { x: number; y: number } {
  const s = (artboard.contentScale ?? 100) / 100;
  const ox = artboard.contentOffset?.x ?? 0;
  const oy = artboard.contentOffset?.y ?? 0;
  return { x: (pt.x - ox) / s, y: (pt.y - oy) / s };
}

// ─────────────────────────────────────────────
// localStorage persistence
// ─────────────────────────────────────────────

const LS_ITEMS = 'cai-canvas-items';
const LS_VIEW = 'cai-canvas-view';

function lsLoadItems(): CanvasItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

function lsLoadView(): { zoom: number; offset: Point } {
  if (typeof window === 'undefined') return { zoom: 100, offset: { x: 0, y: 0 } };
  try {
    const v = JSON.parse(localStorage.getItem(LS_VIEW) || '{}');
    return {
      zoom: typeof v.zoom === 'number' ? v.zoom : 100,
      offset: (v.offset && typeof v.offset.x === 'number') ? v.offset : { x: 0, y: 0 },
    };
  } catch { return { zoom: 100, offset: { x: 0, y: 0 } }; }
}

// Base64 src와 parameterReport는 IndexedDB에 저장 — localStorage에는 구조 데이터만 기록
function lsSaveItems(items: CanvasItem[]) {
  const stripped = items.map(i => {
    const params = i.parameters ? { ...i.parameters, parameterReport: undefined } : undefined;
    return { ...i, src: i.src?.startsWith('data:') ? '' : i.src, parameters: params };
  });
  try { localStorage.setItem(LS_ITEMS, JSON.stringify(stripped)); } catch { /* quota exceeded */ }
}

function lsSaveView(zoom: number, offset: Point) {
  try { localStorage.setItem(LS_VIEW, JSON.stringify({ zoom, offset })); } catch { /* quota exceeded */ }
}

// ─────────────────────────────────────────────
// Main App Component
// ─────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Canvas transform state — SSR-safe initial values (localStorage loaded in mount effect)
  const [canvasZoom, setCanvasZoom] = useState<number>(100);
  const [canvasOffset, setCanvasOffset] = useState<Point>({ x: 0, y: 0 });
  const canvasZoomRef = useRef(100);
  const canvasOffsetRef = useRef<Point>({ x: 0, y: 0 });

  // mount 복원 완료 전까지 persist effect가 기본값을 덮어쓰는 것을 막는 guard
  const isRestoredRef = useRef(false);

  // Persist view (zoom + offset) whenever they change
  useEffect(() => {
    if (!isRestoredRef.current) return;
    lsSaveView(canvasZoom, canvasOffset);
  }, [canvasZoom, canvasOffset]);

  const updateZoom = useCallback((z: number) => {
    const clamped = clamp(z, ZOOM_MIN, ZOOM_MAX);
    canvasZoomRef.current = clamped;
    setCanvasZoom(clamped);
  }, []);

  const updateOffset = useCallback((o: Point) => {
    canvasOffsetRef.current = o;
    setCanvasOffset(o);
  }, []);

  // Canvas mode & items — SSR-safe initial values (localStorage loaded in mount effect)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select');
  const canvasModeRef = useRef<CanvasMode>('select');
  useEffect(() => { canvasModeRef.current = canvasMode; }, [canvasMode]);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const canvasItemsRef = useRef<CanvasItem[]>([]);
  useEffect(() => { canvasItemsRef.current = canvasItems; }, [canvasItems]);

  // Persist: src(Base64) → IndexedDB, 구조 → localStorage
  useEffect(() => {
    if (!isRestoredRef.current) return;
    canvasItems.forEach(item => {
      if (item.src?.startsWith('data:')) saveImageToDB(item.id, item.src);
    });
    lsSaveItems(canvasItems);
  }, [canvasItems]);

  // 마운트 시 1회: localStorage + IndexedDB에서 전체 상태 복원
  useEffect(() => {
    const view = lsLoadView();
    setCanvasZoom(view.zoom);
    setCanvasOffset(view.offset);
    canvasZoomRef.current = view.zoom;
    canvasOffsetRef.current = view.offset;

    const items = lsLoadItems();
    setCanvasItems(items);
    isRestoredRef.current = true;

    (async () => {
      const updates: { id: string; src?: string; parameterReport?: string }[] = [];
      for (const item of items) {
        const update: { id: string; src?: string; parameterReport?: string } = { id: item.id };
        if (!item.src) {
          const data = await loadImageFromDB(item.id);
          if (data) update.src = data;
        }
        if (item.type === 'sketch_generated') {
          const report = await loadImageFromDB(`report_${item.id}`);
          if (report) update.parameterReport = report;
        }
        if (update.src || update.parameterReport) updates.push(update);
      }
      if (updates.length > 0) {
        setCanvasItems(prev =>
          prev.map(i => {
            const u = updates.find(u => u.id === i.id);
            if (!u) return i;
            const merged = u.src ? { ...i, src: u.src } : { ...i };
            if (u.parameterReport) {
              merged.parameters = { ...merged.parameters, parameterReport: u.parameterReport };
            }
            return merged;
          })
        );
        // 복원 완료 시점에 선택된 아이템이 parameterReport를 받았다면 사이드바 재동기화
        // (selectedItemIds sync effect는 selectedItemIds 변경 시에만 재실행되므로 여기서 직접 반영)
        const selId = selectedItemIdsRef.current[0];
        if (selId) {
          const u = updates.find(u => u.id === selId && u.parameterReport);
          if (u?.parameterReport) setParameterReport(u.parameterReport);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const selectedItemIdsRef = useRef<string[]>([]);
  useEffect(() => { selectedItemIdsRef.current = selectedItemIds; }, [selectedItemIds]);

  // (픽셀 캔버스 복원은 canvas ref 콜백에서 IndexedDB 비동기 로드로 처리)

  // Toolbar state
  const [penStrokeWidth, setPenStrokeWidth] = useState(DEFAULT_PEN_STROKE_WIDTH);
  const [eraserStrokeWidth, setEraserStrokeWidth] = useState(DEFAULT_ERASER_STROKE_WIDTH);
  const [showStrokePanel, setShowStrokePanel] = useState<'pen' | 'eraser' | null>(null);

  // History state
  const [historyStates, setHistoryStates] = useState<CanvasItem[][]>([]);
  const [redoStates, setRedoStates] = useState<CanvasItem[][]>([]);

  // Focus mode toggle
  const [focusMode, setFocusMode] = useState<'all' | 'target'>('all');

  // Drag select (rubber band)
  const [dragSelectRect, setDragSelectRect] = useState<{
    startX: number; startY: number; endX: number; endY: number;
  } | null>(null);
  const dragSelectStartRef = useRef<{ ptX: number; ptY: number } | null>(null);
  const isDragSelectingRef = useRef(false);

  // Artboard upload (new artboard)
  const artboardFileInputRef = useRef<HTMLInputElement>(null);

  // Artboard image replace (control bar)
  const replaceArtboardFileInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceArtboardId = useRef<string | null>(null);

  // Sketch-to-Plan panel state
  const [planPrompt, setPlanPrompt] = useState('');
  const [floorType, setFloorType] = useState('');
  const [gridModule, setGridModule] = useState(4000);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [sourceArtboardSize, setSourceArtboardSize] = useState<{ width: number; height: number } | null>(null);
  const [parameterReport, setParameterReport] = useState<string | null>(null);

  // Sync sidebar state with selected item
  useEffect(() => {
    if (selectedItemIds.length === 0) {
      setParameterReport(null);
      setFloorType('');
      setGridModule(4000);
      return;
    }
    const item = canvasItemsRef.current.find(i => i.id === selectedItemIds[0]);
    if (item?.type === 'sketch_generated' && item.parameters) {
      setParameterReport((item.parameters.parameterReport as string) || null);
      if (item.parameters.floorType) setFloorType(item.parameters.floorType as string);
      if (item.parameters.gridModule) setGridModule(item.parameters.gridModule as number);
    } else {
      setParameterReport(null);
      setFloorType('');
      setGridModule(4000);
    }
  }, [selectedItemIds]);

  // Plan generation hook
  const { isLoading: isGenerating, generatedPlanImage, roomAnalysis, generate, reset: resetGeneration } = usePlanGeneration();
  const roomAnalysisRef = useRef<string | null>(null);
  useEffect(() => { roomAnalysisRef.current = roomAnalysis; }, [roomAnalysis]);

  const [generateWarning, setGenerateWarning] = useState<string | null>(null);

  // SVG cursor tracking for pen/eraser indicator
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });

  // Canvas refs
  const canvasElRef = useRef<HTMLDivElement>(null);
  const isDraggingPan = useRef(false);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const offsetAtDragStart = useRef<Point>({ x: 0, y: 0 });
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef<Point>({ x: 0, y: 0 });
  const activeTouchCount = useRef(0);

  // Pixel drawing refs
  const artboardCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const activeArtboardId = useRef<string | null>(null);
  const lastDrawPoint = useRef<Point | null>(null);
  // 아이템당 IndexedDB 픽셀 복원을 1회만 수행하기 위한 guard
  const pixelRestoredRef = useRef<Set<string>>(new Set());
  // DPR scale 초기화 완료 추적 — canvas resize 후 1회만 scale() 적용
  const canvasDprInitRef = useRef<Set<string>>(new Set());

  // Pixel undo/redo stacks (ImageData — synchronous restore)
  type PixelEntry = { id: string; data: ImageData };
  const pixelUndoStack = useRef<PixelEntry[]>([]);
  const pixelRedoStack = useRef<PixelEntry[]>([]);

  // Middle mouse button panning
  const isMiddleButtonPanning = useRef(false);

  // Content panning (locked artboard + pan mode)
  const isContentPanning = useRef(false);
  const contentPanArtboardId = useRef<string | null>(null);
  const contentPanStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Image transform editing state
  const [imageEditingId, setImageEditingId] = useState<string | null>(null);
  const imageEditingIdRef = useRef<string | null>(null);
  useEffect(() => { imageEditingIdRef.current = imageEditingId; }, [imageEditingId]);
  // snapshot of contentTransform when entering edit mode (for cancel rollback)
  const imageEditSnapshot = useRef<CanvasItem['contentTransform'] | null>(null);

  // Image transform (move/resize/rotate within artboard)
  type ImageTransformOp = 'move' | 'resize' | 'rotate';
  const isTransformingImage = useRef(false);
  const imageTransformOp = useRef<ImageTransformOp>('move');
  const imageTransformItemId = useRef<string | null>(null);
  // resize: axis flags
  const imageResizeAxis = useRef({ dx: 0, dy: 0 }); // -1|0|1
  // shared start snapshot
  const imageTransformStart = useRef({
    ptX: 0, ptY: 0,
    tx: 0, ty: 0, tw: 0, th: 0, tr: 0, // contentTransform at drag start
  });

  // Resize refs
  const isResizingItem = useRef(false);
  const resizeCorner = useRef({ dx: 1, dy: 1 });
  const resizeStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0, width: 0, height: 0 });

  // Move refs
  const isMovingItem = useRef(false);
  const moveItemId = useRef<string | null>(null);
  const moveStart = useRef({ ptX: 0, ptY: 0, itemX: 0, itemY: 0 });

  // ─── Place generated plan image onto canvas ───
  useEffect(() => {
    if (!generatedPlanImage) return;

    const rawSrc = `data:image/png;base64,${generatedPlanImage}`;
    const ts = Date.now();
    const targetW = sourceArtboardSize?.width ?? 640;
    const targetH = sourceArtboardSize?.height ?? 640;

    const placeItem = (finalSrc: string) => {
      const planItemId = `plan-${ts}`;
      const planItem: CanvasItem = {
        id: planItemId,
        type: 'sketch_generated',
        x: 60,
        y: -targetH / 2,
        width: targetW,
        height: targetH,
        src: finalSrc,
        zIndex: canvasItemsRef.current.length,
        layerType: 'sketch',
        parameters: {
          parameterReport: roomAnalysisRef.current || null,
          floorType,
          gridModule,
        },
      };
      if (roomAnalysisRef.current) saveImageToDB(`report_${planItemId}`, roomAnalysisRef.current);
      setHistoryStates(h => [...h, canvasItemsRef.current]);
      setCanvasItems(prev => [...prev, planItem]);
      if (roomAnalysisRef.current) setParameterReport(roomAnalysisRef.current);
      resetGeneration();
      setPlanPrompt('');
    };

    const img = new Image();
    img.onload = () => {
      // Fit generated image into source artboard dimensions (letterbox, white bg)
      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const ctx = offscreen.getContext('2d');
      if (!ctx) { placeItem(rawSrc); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      const s = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
      const drawW = img.naturalWidth * s;
      const drawH = img.naturalHeight * s;
      ctx.drawImage(img, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);
      placeItem(offscreen.toDataURL('image/png'));
    };
    img.onerror = () => placeItem(rawSrc);
    img.src = rawSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedPlanImage]);

  // ─── Coordinate transform ───
  const getCanvasCoords = useCallback((clientX: number, clientY: number): Point => {
    const el = canvasElRef.current;
    const rect = el?.getBoundingClientRect()
      ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const scale = canvasZoomRef.current / 100;
    return {
      x: (clientX - rect.left - rect.width / 2 - canvasOffsetRef.current.x) / scale,
      y: (clientY - rect.top - rect.height / 2 - canvasOffsetRef.current.y) / scale,
    };
  }, []);

  // ─── Find artboard under cursor ───
  const findArtboardAt = useCallback((clientX: number, clientY: number): CanvasItem | null => {
    const pt = getCanvasCoords(clientX, clientY);
    return canvasItemsRef.current.find(item =>
      (item.type === 'artboard' || item.type === 'upload') &&
      pt.x >= item.x && pt.x <= item.x + item.width &&
      pt.y >= item.y && pt.y <= item.y + item.height
    ) ?? null;
  }, [getCanvasCoords]);

  // ─── Artboard-local pixel coordinates ───
  const getArtboardLocal = useCallback((clientX: number, clientY: number, artboard: CanvasItem): Point => {
    const pt = getCanvasCoords(clientX, clientY);
    return { x: pt.x - artboard.x, y: pt.y - artboard.y };
  }, [getCanvasCoords]);

  // ─── Prevent browser middle-click auto-scroll cursor ───
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    const onMouseDown = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ─── Wheel zoom (passive:false) ───
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const prevZoom = canvasZoomRef.current;
      const newZoom = clamp(prevZoom - e.deltaY * ZOOM_WHEEL_FACTOR, ZOOM_MIN, ZOOM_MAX);

      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      const s = newZoom / prevZoom;
      updateZoom(newZoom);
      updateOffset({
        x: mouseX + (canvasOffsetRef.current.x - mouseX) * s,
        y: mouseY + (canvasOffsetRef.current.y - mouseY) * s,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [updateZoom, updateOffset]);

  // ─── Zoom step control ───
  const handleZoomStep = useCallback((delta: number) => {
    if (delta > 0) {
      const next = ZOOM_STEPS.find(s => s > canvasZoomRef.current);
      if (next) updateZoom(next);
    } else {
      const prev = [...ZOOM_STEPS].reverse().find(s => s < canvasZoomRef.current);
      if (prev) updateZoom(prev);
    }
  }, [updateZoom]);

  // ─── Fit to view (2-mode toggle) ───
  const handleFocus = useCallback(() => {
    const el = canvasElRef.current;
    if (!el || canvasItems.length === 0) {
      updateZoom(100);
      updateOffset({ x: 0, y: 0 });
      return;
    }

    if (focusMode === 'all') {
      const padding = 100;
      const minX = Math.min(...canvasItems.map(i => i.x));
      const minY = Math.min(...canvasItems.map(i => i.y));
      const maxX = Math.max(...canvasItems.map(i => i.x + i.width));
      const maxY = Math.max(...canvasItems.map(i => i.y + i.height));
      const rect = el.getBoundingClientRect();
      const newZoom = clamp(
        Math.min(
          (rect.width - padding * 2) / (maxX - minX),
          (rect.height - padding * 2) / (maxY - minY),
          1
        ) * 100,
        ZOOM_MIN,
        ZOOM_MAX
      );
      updateZoom(newZoom);
      updateOffset({
        x: -((minX + maxX) / 2) * (newZoom / 100),
        y: -((minY + maxY) / 2) * (newZoom / 100),
      });
      setFocusMode('target');
    } else {
      const target = selectedItemIds[0]
        ? canvasItems.find(i => i.id === selectedItemIds[0])
        : canvasItems[canvasItems.length - 1];
      if (target) {
        const cx = target.x + target.width / 2;
        const cy = target.y + target.height / 2;
        updateZoom(100);
        updateOffset({ x: -cx, y: -cy });
      }
      setFocusMode('all');
    }
  }, [focusMode, canvasItems, selectedItemIds, updateZoom, updateOffset]);

  // ─── Artboard creation / upload ───
  const handleAddArtboard = useCallback(() => {
    let newX = -842 / 2;
    let newY = -595 / 2;

    if (canvasItems.length > 0) {
      const leftMost = canvasItems.reduce((p, c) => p.x < c.x ? p : c);
      const bottomMost = canvasItems.reduce((p, c) =>
        p.y + p.height > c.y + c.height ? p : c
      );
      newX = leftMost.x;
      newY = bottomMost.y + bottomMost.height + 40;
    }

    setHistoryStates(hs => [...hs, canvasItems]);
    setRedoStates([]);
    setCanvasItems(prev => [...prev, {
      id: `artboard-${Date.now()}`,
      type: 'artboard' as const,
      src: undefined,
      x: newX,
      y: newY,
      width: 842,
      height: 595,
      zIndex: canvasItems.length,
    }]);
  }, [canvasItems]);

  const handleArtboardImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const ratio = img.height / img.width;
        const w = Math.min(img.width, maxW);
        const h = w * ratio;
        const newItem: CanvasItem = {
          id: `artboard-${Date.now()}`,
          type: 'artboard',
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          src,
          zIndex: canvasItems.length,
        };
        setHistoryStates(hs => [...hs, canvasItems]);
        setCanvasItems(prev => [...prev, newItem]);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [canvasItems]);

  // ─── Item actions (control bar) ───
  const handleDeleteItem = useCallback((id: string) => {
    setHistoryStates(h => [...h, canvasItemsRef.current]);
    setRedoStates([]);
    setCanvasItems(prev => prev.filter(i => i.id !== id));
    setSelectedItemIds(prev => prev.filter(s => s !== id));
    pixelRestoredRef.current.delete(id);
    canvasDprInitRef.current.delete(id);
    deleteImageFromDB(`report_${id}`);
  }, []);

  // ─── Image transform confirm / cancel ───
  const handleImageTransformConfirm = useCallback(() => {
    setHistoryStates(h => [...h, canvasItemsRef.current]);
    setRedoStates([]);
    imageEditSnapshot.current = null;
    setImageEditingId(null);
  }, []);

  const handleImageTransformCancel = useCallback(() => {
    const id = imageEditingIdRef.current;
    // snapshot이 null이면 contentTransform을 변경하지 않고 편집 모드만 종료
    if (id && imageEditSnapshot.current !== null && imageEditSnapshot.current !== undefined) {
      setCanvasItems(prev => prev.map(i =>
        i.id === id ? { ...i, contentTransform: imageEditSnapshot.current! } : i
      ));
    }
    imageEditSnapshot.current = null;
    setImageEditingId(null);
  }, []);

  const handleDownloadItem = useCallback(async (item: CanvasItem) => {
    let downloadHref = item.src || '';

    if (item.type === 'artboard' || item.type === 'upload') {
      const sketchCanvas = artboardCanvasRefs.current.get(item.id);
      if (sketchCanvas) {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = item.width;
        exportCanvas.height = item.height;
        const ctx = exportCanvas.getContext('2d')!;

        // Fill background for artboard
        if (item.type === 'artboard') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, item.width, item.height);
        }

        // Draw background image if it has one
        if (item.src) {
          await new Promise<void>(resolve => {
            const bg = new Image();
            bg.onload = () => { ctx.drawImage(bg, 0, 0, item.width, item.height); resolve(); };
            bg.onerror = () => resolve();
            bg.src = item.src!;
          });
        }

        // Draw user sketches on top
        ctx.drawImage(sketchCanvas, 0, 0);
        downloadHref = exportCanvas.toDataURL('image/png');
      }
    }

    if (!downloadHref) return;

    const a = document.createElement('a');
    a.href = downloadHref;
    a.download = `${item.type}_${item.id}.png`;
    a.click();
  }, []);

  const handleReplaceArtboardImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingReplaceArtboardId.current;
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const imgEl = new Image();
      imgEl.onload = () => {
        setHistoryStates(h => [...h, canvasItemsRef.current]);
        setCanvasItems(prev => prev.map(item => {
          if (item.id !== id) return item;
          // fit-contain within artboard, centered
          const s = Math.min(item.width / imgEl.naturalWidth, item.height / imgEl.naturalHeight);
          const fitW = imgEl.naturalWidth * s;
          const fitH = imgEl.naturalHeight * s;
          return {
            ...item,
            src,
            contentTransform: {
              x: (item.width - fitW) / 2,
              y: (item.height - fitH) / 2,
              width: fitW,
              height: fitH,
              rotation: 0,
            },
          };
        }));
      };
      imgEl.src = src;
    };
    reader.readAsDataURL(file);
    pendingReplaceArtboardId.current = null;
    e.target.value = '';
  }, []);

  // ─── Pixel draw helpers ───
  const applyDrawSettings = (
    ctx: CanvasRenderingContext2D,
    mode: 'pen' | 'eraser',
    strokeWidth: number,
    color: string,
  ) => {
    ctx.globalCompositeOperation = mode === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = mode === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.fillStyle = mode === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // ─── Pointer events ───
  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Middle mouse button → pan (all modes)
    if (e.button === 1 && e.pointerType !== 'touch') {
      e.preventDefault();
      isMiddleButtonPanning.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetAtDragStart.current = { ...canvasOffsetRef.current };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (canvasElRef.current) canvasElRef.current.style.cursor = 'grabbing';
      return;
    }

    // Image transform handle detection (rotate / resize within artboard)
    if (canvasMode === 'select' && target.classList.contains('img-rotate-handle')) {
      e.stopPropagation();
      const id = imageEditingIdRef.current;
      const item = id ? canvasItemsRef.current.find(i => i.id === id) : null;
      if (item?.contentTransform) {
        const ct = item.contentTransform;
        const pt = getCanvasCoords(e.clientX, e.clientY);
        const cx = item.x + ct.x + ct.width / 2;
        const cy = item.y + ct.y + ct.height / 2;
        isTransformingImage.current = true;
        imageTransformOp.current = 'rotate';
        imageTransformItemId.current = id;
        imageTransformStart.current = {
          ptX: pt.x, ptY: pt.y,
          tx: ct.x, ty: ct.y, tw: ct.width, th: ct.height, tr: ct.rotation,
        };
        // store center for rotate calc
        (canvasElRef.current as HTMLElement & { _rotCx?: number; _rotCy?: number })._rotCx = cx;
        (canvasElRef.current as HTMLElement & { _rotCy?: number })._rotCy = cy;
        canvasElRef.current?.setPointerCapture(e.pointerId);
        // rotate 커서 활성화
        if (canvasElRef.current) {
          const rotateCursorUrl = "url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z\' fill=\'%23f97316\' stroke=\'white\' stroke-width=\'0.5\'/%3E%3C/svg%3E') 12 12, grabbing";
          canvasElRef.current.style.cursor = rotateCursorUrl;
        }
      }
      return;
    }

    if (canvasMode === 'select' && target.classList.contains('img-resize-handle')) {
      e.stopPropagation();
      const id = imageEditingIdRef.current;
      const item = id ? canvasItemsRef.current.find(i => i.id === id) : null;
      if (item?.contentTransform) {
        const ct = item.contentTransform;
        const dx = parseInt(target.dataset.dx ?? '0');
        const dy = parseInt(target.dataset.dy ?? '0');
        const pt = getCanvasCoords(e.clientX, e.clientY);
        isTransformingImage.current = true;
        imageTransformOp.current = 'resize';
        imageTransformItemId.current = id;
        imageResizeAxis.current = { dx, dy };
        imageTransformStart.current = {
          ptX: pt.x, ptY: pt.y,
          tx: ct.x, ty: ct.y, tw: ct.width, th: ct.height, tr: ct.rotation,
        };
        canvasElRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (canvasMode === 'select' && target.classList.contains('img-move-area')) {
      e.stopPropagation();
      const id = imageEditingIdRef.current;
      const item = id ? canvasItemsRef.current.find(i => i.id === id) : null;
      if (item?.contentTransform) {
        const ct = item.contentTransform;
        const pt = getCanvasCoords(e.clientX, e.clientY);
        isTransformingImage.current = true;
        imageTransformOp.current = 'move';
        imageTransformItemId.current = id;
        imageTransformStart.current = {
          ptX: pt.x, ptY: pt.y,
          tx: ct.x, ty: ct.y, tw: ct.width, th: ct.height, tr: ct.rotation,
        };
        canvasElRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Resize handle detection
    if (canvasMode === 'select' && target.classList.contains('resize-handle')) {
      const dx = parseInt(target.dataset.dx ?? '1');
      const dy = parseInt(target.dataset.dy ?? '1');
      const item = canvasItemsRef.current.find(i => i.id === selectedItemIdsRef.current[0]);
      if (item) {
        setHistoryStates(h => [...h, canvasItemsRef.current]);
        setRedoStates([]);
        isResizingItem.current = true;
        resizeCorner.current = { dx, dy };
        const pt = getCanvasCoords(e.clientX, e.clientY);
        resizeStart.current = {
          x: pt.x, y: pt.y,
          itemX: item.x, itemY: item.y,
          width: item.width, height: item.height,
        };
        canvasElRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }

    // Item move (select mode — not on resize handle)
    if (canvasMode === 'select') {
      let el: HTMLElement | null = target;
      let itemId: string | null = null;
      while (el && el !== canvasElRef.current) {
        if (el.dataset.itemId) { itemId = el.dataset.itemId; break; }
        el = el.parentElement;
      }
      if (itemId) {
        const item = canvasItemsRef.current.find(i => i.id === itemId);
        if (item) {
          e.preventDefault();

          // 이미 선택된 artboard with src → 이미지 편집 모드 진입
          if (
            item.type === 'artboard' &&
            item.src &&
            selectedItemIdsRef.current.includes(itemId) &&
            imageEditingIdRef.current !== itemId
          ) {
            // contentTransform 초기값을 로컬 변수로 먼저 계산 (snapshot 동기 캡처)
            let ct = item.contentTransform;
            if (!ct) {
              ct = { x: 0, y: 0, width: item.width, height: item.height, rotation: 0 };
              setCanvasItems(prev => prev.map(i =>
                i.id !== itemId ? i : { ...i, contentTransform: ct! }
              ));
            }
            imageEditSnapshot.current = ct; // 항상 올바른 값 캡처
            setImageEditingId(itemId);
            canvasElRef.current?.setPointerCapture(e.pointerId);
            return;
          }

          // 편집 모드 중 다른 아이템 클릭 → 편집 모드 확정 후 선택 변경
          if (imageEditingIdRef.current && imageEditingIdRef.current !== itemId) {
            handleImageTransformConfirm();
          }

          setSelectedItemIds([itemId]);
          if (item.locked) return;
          setHistoryStates(h => [...h, canvasItemsRef.current]);
          setRedoStates([]);
          isMovingItem.current = true;
          moveItemId.current = itemId;
          const pt = getCanvasCoords(e.clientX, e.clientY);
          moveStart.current = { ptX: pt.x, ptY: pt.y, itemX: item.x, itemY: item.y };
          canvasElRef.current?.setPointerCapture(e.pointerId);
        }
      } else {
        // 빈 캔버스 → 편집 모드 종료(확정) 후 드래그 선택 시작
        if (imageEditingIdRef.current) handleImageTransformConfirm();
        setSelectedItemIds([]);
        const pt = getCanvasCoords(e.clientX, e.clientY);
        dragSelectStartRef.current = { ptX: pt.x, ptY: pt.y };
        isDragSelectingRef.current = false;
        canvasElRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (canvasMode === 'pan') {
      if (e.pointerType === 'touch') {
        activeTouchCount.current += 1;
        // 두 번째 손가락 감지 → 핀치 줌 우선, 패닝 취소
        if (activeTouchCount.current >= 2) {
          isDraggingPan.current = false;
          if (canvasElRef.current) canvasElRef.current.style.cursor = 'grab';
          return;
        }
      }
      // locked artboard 위에서 pan → 아트보드 내부 컨텐츠 패닝
      const hoveredArtboard = findArtboardAt(e.clientX, e.clientY);
      if (hoveredArtboard?.locked) {
        isContentPanning.current = true;
        contentPanArtboardId.current = hoveredArtboard.id;
        contentPanStartOffset.current = hoveredArtboard.contentOffset ?? { x: 0, y: 0 };
        dragStart.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        if (canvasElRef.current) canvasElRef.current.style.cursor = 'grabbing';
        return;
      }
      isDraggingPan.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetAtDragStart.current = { ...canvasOffsetRef.current };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (canvasElRef.current) canvasElRef.current.style.cursor = 'grabbing';
      return;
    }

    if (canvasMode === 'pen' || canvasMode === 'eraser') {
      // 터치(손가락/손바닥)는 드로잉 불가 → 1손가락 패닝, 2손가락 핀치로 전환
      if (e.pointerType === 'touch') {
        activeTouchCount.current += 1;
        if (activeTouchCount.current === 1) {
          isDraggingPan.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY };
          offsetAtDragStart.current = { ...canvasOffsetRef.current };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (canvasElRef.current) canvasElRef.current.style.cursor = 'grabbing';
        } else {
          isDraggingPan.current = false;
        }
        return;
      }
      const artboard = findArtboardAt(e.clientX, e.clientY);
      if (!artboard) return;

      const canvas = artboardCanvasRefs.current.get(artboard.id);
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      pixelUndoStack.current.push({ id: artboard.id, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
      pixelRedoStack.current = [];

      setHistoryStates(h => [...h, canvasItemsRef.current]);
      setRedoStates([]);

      activeArtboardId.current = artboard.id;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const rawPt = getArtboardLocal(e.clientX, e.clientY, artboard);
      const pt = getDrawCoords(rawPt, artboard);
      applyDrawSettings(ctx, canvasMode, canvasMode === 'pen' ? penStrokeWidth : eraserStrokeWidth, '#111111');
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (canvasMode === 'pen' ? penStrokeWidth : eraserStrokeWidth) / 2, 0, Math.PI * 2);
      ctx.fill();
      lastDrawPoint.current = pt;
    }
  }, [canvasMode, findArtboardAt, getArtboardLocal, getCanvasCoords, penStrokeWidth, eraserStrokeWidth]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    // Middle button pan
    if (isMiddleButtonPanning.current) {
      updateOffset({
        x: offsetAtDragStart.current.x + e.clientX - dragStart.current.x,
        y: offsetAtDragStart.current.y + e.clientY - dragStart.current.y,
      });
      return;
    }

    // Update SVG cursor position
    if (canvasMode === 'pen' || canvasMode === 'eraser') {
      setLastMousePos(getCanvasCoords(e.clientX, e.clientY));
    }

    // Drag select rect update
    if (dragSelectStartRef.current) {
      const pt = getCanvasCoords(e.clientX, e.clientY);
      isDragSelectingRef.current = true;
      setDragSelectRect({
        startX: dragSelectStartRef.current.ptX,
        startY: dragSelectStartRef.current.ptY,
        endX: pt.x,
        endY: pt.y,
      });
      return;
    }

    // Image transform drag (move / resize / rotate within artboard)
    if (isTransformingImage.current && imageTransformItemId.current) {
      const pt = getCanvasCoords(e.clientX, e.clientY);
      const s = imageTransformStart.current;
      const id = imageTransformItemId.current;
      const op = imageTransformOp.current;

      if (op === 'move') {
        const dx = pt.x - s.ptX;
        const dy = pt.y - s.ptY;
        setCanvasItems(prev => prev.map(i =>
          i.id === id
            ? { ...i, contentTransform: { ...i.contentTransform!, x: s.tx + dx, y: s.ty + dy } }
            : i
        ));
      } else if (op === 'resize') {
        const { dx, dy } = imageResizeAxis.current;
        const deltaX = dx !== 0 ? (pt.x - s.ptX) * dx : 0;
        const deltaY = dy !== 0 ? (pt.y - s.ptY) * dy : 0;
        const aspect = s.tw / s.th;

        let newW = dx !== 0 ? Math.max(s.tw + deltaX, 20) : s.tw;
        let newH = dy !== 0 ? Math.max(s.th + deltaY, 20) : s.th;

        // Corner handles: always lock aspect ratio; Shift = override to free resize
        if (dx !== 0 && dy !== 0) {
          if (!e.shiftKey) {
            newH = newW / aspect;
          }
          // Shift held on corner → recalculate newH freely
          if (e.shiftKey) {
            newH = Math.max(s.th + deltaY, 20);
          }
        }

        const newX = dx === -1 ? s.tx + (s.tw - newW) : s.tx;
        const newY = dy === -1 ? s.ty + (s.th - newH) : s.ty;

        setCanvasItems(prev => prev.map(i =>
          i.id === id
            ? { ...i, contentTransform: { ...i.contentTransform!, x: newX, y: newY, width: newW, height: newH } }
            : i
        ));
      } else if (op === 'rotate') {
        const el = canvasElRef.current as HTMLElement & { _rotCx?: number; _rotCy?: number };
        const cx = el._rotCx ?? 0;
        const cy = el._rotCy ?? 0;
        let angle = Math.atan2(pt.y - cy, pt.x - cx) * (180 / Math.PI) + 90;
        if (e.shiftKey) angle = Math.round(angle / 15) * 15;
        setCanvasItems(prev => prev.map(i =>
          i.id === id
            ? { ...i, contentTransform: { ...i.contentTransform!, rotation: angle } }
            : i
        ));
      }
      return;
    }

    // Item move drag
    if (isMovingItem.current && moveItemId.current) {
      const pt = getCanvasCoords(e.clientX, e.clientY);
      const dx = pt.x - moveStart.current.ptX;
      const dy = pt.y - moveStart.current.ptY;
      setCanvasItems(prev => prev.map(i =>
        i.id === moveItemId.current
          ? { ...i, x: moveStart.current.itemX + dx, y: moveStart.current.itemY + dy }
          : i
      ));
      return;
    }

    // Resize drag
    if (isResizingItem.current && selectedItemIdsRef.current.length === 1) {
      const pt = getCanvasCoords(e.clientX, e.clientY);
      const { x: startX, itemX, itemY, width: startW, height: startH } = resizeStart.current;
      const { dx, dy } = resizeCorner.current;
      const aspect = startW / startH;
      const deltaX = (pt.x - startX) * dx;
      const newWidth = Math.max(startW + deltaX, 50);
      const newHeight = newWidth / aspect;
      const newX = dx === -1 ? itemX + (startW - newWidth) : itemX;
      const newY = dy === -1 ? itemY + (startH - newHeight) : itemY;
      setCanvasItems(prev => prev.map(i =>
        i.id === selectedItemIdsRef.current[0]
          ? { ...i, x: newX, y: newY, width: newWidth, height: newHeight }
          : i
      ));
      return;
    }

    if (isContentPanning.current && contentPanArtboardId.current) {
      const artboard = canvasItemsRef.current.find(i => i.id === contentPanArtboardId.current);
      if (artboard) {
        const s = (artboard.contentScale ?? 100) / 100;
        const maxPanX = -(artboard.width * (s - 1));
        const maxPanY = -(artboard.height * (s - 1));
        const rawX = contentPanStartOffset.current.x + (e.clientX - dragStart.current.x);
        const rawY = contentPanStartOffset.current.y + (e.clientY - dragStart.current.y);
        setCanvasItems(prev => prev.map(i =>
          i.id === contentPanArtboardId.current
            ? { ...i, contentOffset: { x: clamp(rawX, maxPanX, 0), y: clamp(rawY, maxPanY, 0) } }
            : i
        ));
      }
      return;
    }

    if (isDraggingPan.current) {
      updateOffset({
        x: offsetAtDragStart.current.x + e.clientX - dragStart.current.x,
        y: offsetAtDragStart.current.y + e.clientY - dragStart.current.y,
      });
      return;
    }

    if ((canvasMode === 'pen' || canvasMode === 'eraser') && activeArtboardId.current) {
      if (e.pointerType === 'touch') return;
      const artboard = canvasItemsRef.current.find(i => i.id === activeArtboardId.current);
      if (!artboard || !lastDrawPoint.current) return;
      const canvas = artboardCanvasRefs.current.get(artboard.id);
      if (!canvas) return;

      const rawPt = getArtboardLocal(e.clientX, e.clientY, artboard);
      const pt = getDrawCoords(rawPt, artboard);
      const ctx = canvas.getContext('2d')!;
      const sw = canvasMode === 'pen' ? penStrokeWidth : eraserStrokeWidth;
      applyDrawSettings(ctx, canvasMode, sw, '#111111');
      ctx.beginPath();
      ctx.moveTo(lastDrawPoint.current.x, lastDrawPoint.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastDrawPoint.current = pt;
    }
  }, [canvasMode, getCanvasCoords, getArtboardLocal, penStrokeWidth, eraserStrokeWidth, updateOffset]);

  const handlePointerUp = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    // Middle button pan end
    if (isMiddleButtonPanning.current) {
      isMiddleButtonPanning.current = false;
      if (canvasElRef.current) {
        const mode = canvasModeRef.current;
        canvasElRef.current.style.cursor =
          mode === 'pan' ? 'grab' : (mode === 'pen' || mode === 'eraser') ? 'none' : 'default';
      }
      return;
    }

    // 터치 포인터 수 감소
    if (e?.pointerType === 'touch') {
      activeTouchCount.current = Math.max(0, activeTouchCount.current - 1);
    }

    if (isContentPanning.current) {
      isContentPanning.current = false;
      contentPanArtboardId.current = null;
      if (canvasElRef.current) canvasElRef.current.style.cursor = 'grab';
      return;
    }
    // Drag select finalize
    if (dragSelectStartRef.current) {
      if (isDragSelectingRef.current) {
        setDragSelectRect(prev => {
          if (!prev) return null;
          const minX = Math.min(prev.startX, prev.endX);
          const maxX = Math.max(prev.startX, prev.endX);
          const minY = Math.min(prev.startY, prev.endY);
          const maxY = Math.max(prev.startY, prev.endY);
          const selected = canvasItemsRef.current
            .filter(item =>
              item.x < maxX && item.x + item.width > minX &&
              item.y < maxY && item.y + item.height > minY
            )
            .map(i => i.id);
          setSelectedItemIds(selected);
          return null;
        });
      }
      dragSelectStartRef.current = null;
      isDragSelectingRef.current = false;
      return;
    }

    if (isTransformingImage.current) {
      // rotate 커서 복원
      if (imageTransformOp.current === 'rotate' && canvasElRef.current) {
        canvasElRef.current.style.cursor = 'default';
      }
      isTransformingImage.current = false;
      imageTransformItemId.current = null;
      return;
    }

    if (isMovingItem.current) {
      isMovingItem.current = false;
      moveItemId.current = null;
      return;
    }
    if (isResizingItem.current) {
      isResizingItem.current = false;
      const resizedId = selectedItemIdsRef.current[0];
      if (resizedId) {
        const canvas = artboardCanvasRefs.current.get(resizedId);
        if (canvas) saveImageToDB(`pixel_${resizedId}`, canvas.toDataURL('image/png'));
        pixelRestoredRef.current.delete(resizedId);
        canvasDprInitRef.current.delete(resizedId);
      }
      return;
    }
    if (isDraggingPan.current) {
      isDraggingPan.current = false;
      if (canvasElRef.current) {
        const mode = canvasModeRef.current;
        canvasElRef.current.style.cursor =
          mode === 'pan' ? 'grab' : (mode === 'pen' || mode === 'eraser') ? 'none' : 'default';
      }
      return;
    }
    // Save pixel canvas to localStorage after each stroke
    if (activeArtboardId.current) {
      const canvas = artboardCanvasRefs.current.get(activeArtboardId.current);
      if (canvas) saveImageToDB(`pixel_${activeArtboardId.current}`, canvas.toDataURL('image/png'));
    }
    activeArtboardId.current = null;
    lastDrawPoint.current = null;
  }, []);

  // ─── Touch events (pinch zoom + two-finger pan) ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const el = canvasElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dist = getTouchDistance(e.touches);
    const center = getTouchCenter(e.touches);
    const prevZoom = canvasZoomRef.current;
    const newZoom = clamp(prevZoom + (dist - lastTouchDist.current) * ZOOM_PINCH_FACTOR, ZOOM_MIN, ZOOM_MAX);
    const s = newZoom / prevZoom;
    const cx = center.x - rect.left - rect.width / 2;
    const cy = center.y - rect.top - rect.height / 2;
    updateZoom(newZoom);
    updateOffset({
      x: cx + (canvasOffsetRef.current.x - cx) * s + (center.x - lastTouchCenter.current.x),
      y: cy + (canvasOffsetRef.current.y - cy) * s + (center.y - lastTouchCenter.current.y),
    });
    lastTouchDist.current = dist;
    lastTouchCenter.current = center;
  }, [updateZoom, updateOffset]);

  // ─── handleGenerate — selected item only ───
  const handleGenerate = useCallback(async () => {
    const selectedId = selectedItemIdsRef.current[0];
    const item = selectedId ? canvasItemsRef.current.find(i => i.id === selectedId) : null;

    if (!item || (item.type !== 'artboard' && item.type !== 'upload' && item.type !== 'sketch_generated')) {
      setGenerateWarning('스케치를 선택하세요');
      setTimeout(() => setGenerateWarning(null), 1500);
      return;
    }

    let sketchBase64: string;

    if (item.type === 'sketch_generated') {
      const match = item.src?.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return;
      sketchBase64 = match[2];
    } else {
      const sketchCanvas = artboardCanvasRefs.current.get(item.id);
      if (!sketchCanvas) return;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = item.width;
      exportCanvas.height = item.height;
      const ctx = exportCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, item.width, item.height);

      if (item.src) {
        await new Promise<void>(resolve => {
          const bg = new Image();
          bg.onload = () => { ctx.drawImage(bg, 0, 0, item.width, item.height); resolve(); };
          bg.onerror = () => resolve();
          bg.src = item.src!;
        });
      }

      ctx.drawImage(sketchCanvas, 0, 0);
      sketchBase64 = exportCanvas.toDataURL('image/png').split(',')[1];
    }

    setSourceArtboardSize({ width: item.width, height: item.height });

    await generate(
      { current: null },
      `data:image/png;base64,${sketchBase64}`,
      {
        userPrompt: planPrompt,
        floorType,
        gridModule,
        artboardWidth: item.width,
        artboardHeight: item.height,
      }
    );
  }, [planPrompt, floorType, gridModule, generate]);

  // ─── Undo / Redo ───
  const handleUndo = useCallback(() => {
    if (pixelUndoStack.current.length > 0) {
      const entry = pixelUndoStack.current.pop()!;
      const canvas = artboardCanvasRefs.current.get(entry.id);
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixelRedoStack.current.push({ id: entry.id, data: current });
        ctx.putImageData(entry.data, 0, 0);
        saveImageToDB(`pixel_${entry.id}`, canvas.toDataURL('image/png'));
      }
      setHistoryStates(h => h.slice(0, -1));
      setRedoStates(r => [...r, canvasItemsRef.current]);
      return;
    }
    if (historyStates.length === 0) return;
    const prev = historyStates[historyStates.length - 1];
    setRedoStates(r => [...r, canvasItems]);
    setCanvasItems(prev);
    setHistoryStates(h => h.slice(0, -1));
  }, [historyStates, canvasItems]);

  const handleRedo = useCallback(() => {
    if (pixelRedoStack.current.length > 0) {
      const entry = pixelRedoStack.current.pop()!;
      const canvas = artboardCanvasRefs.current.get(entry.id);
      if (canvas) {
        const ctx = canvas.getContext('2d')!;
        const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        pixelUndoStack.current.push({ id: entry.id, data: current });
        ctx.putImageData(entry.data, 0, 0);
        saveImageToDB(`pixel_${entry.id}`, canvas.toDataURL('image/png'));
      }
      setRedoStates(r => r.slice(0, -1));
      setHistoryStates(h => [...h, canvasItemsRef.current]);
      return;
    }
    if (redoStates.length === 0) return;
    const next = redoStates[redoStates.length - 1];
    setHistoryStates(h => [...h, canvasItems]);
    setCanvasItems(next);
    setRedoStates(r => r.slice(0, -1));
  }, [redoStates, canvasItems]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') setCanvasMode('select');
      if (e.key === 'h' || e.key === 'H') setCanvasMode('pan');
      if (e.key === 'p' || e.key === 'P') setCanvasMode('pen');
      if (e.key === 'e' || e.key === 'E') setCanvasMode('eraser');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
      if (e.key === '0') handleFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, handleFocus]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const scale = canvasZoom / 100;
  const bg = theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#f0f0f0]';

  // Shared transform style — reused across all canvas-space overlays
  const canvasTransformStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
    transformOrigin: '0 0',
  };

  // Icon size (screen pixels), zoom-compensated for canvas space
  // barScale clamped to 50%–150% so the bar doesn't grow/shrink beyond readable range
  const barScale = clamp(scale, 0.5, 1.5);
  const ctrlIconSize = 16 / barScale;
  const ctrlBtnSize = 32 / barScale;
  const ctrlBarH = 44 / barScale;
  const ctrlGap = 6 / barScale;
  const ctrlPadX = 8 / barScale;

  return (
    <div className={`w-screen h-dvh flex flex-col overflow-hidden font-sans select-none ${bg}`}>

      <AppHeader theme={theme} onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />

      {/* Main area */}
      <div className="flex-1 flex relative overflow-hidden">

        {/* Left toolbar */}
        <LeftToolbar
          canvasMode={canvasMode}
          setCanvasMode={setCanvasMode}
          theme={theme}
          penStrokeWidth={penStrokeWidth}
          setPenStrokeWidth={setPenStrokeWidth}
          eraserStrokeWidth={eraserStrokeWidth}
          setEraserStrokeWidth={setEraserStrokeWidth}
          showStrokePanel={showStrokePanel}
          setShowStrokePanel={setShowStrokePanel}
          historyStates={historyStates}
          redoStates={redoStates}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canvasZoom={canvasZoom}
          onZoomStep={handleZoomStep}
          onFocus={handleFocus}
          canvasItems={canvasItems}
          onAddArtboard={handleAddArtboard}
          artboardFileInputRef={artboardFileInputRef}
          onArtboardImageUpload={handleArtboardImageUpload}
        />

        {/* Canvas area */}
        <div
          ref={canvasElRef}
          className="flex-1 relative overflow-hidden"
          style={{
            cursor: canvasMode === 'pan' ? 'grab'
              : (canvasMode === 'pen' || canvasMode === 'eraser') ? 'none'
                : 'default',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            WebkitTouchCallout: 'none' as any,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          <InfiniteGrid zoom={canvasZoom} offset={canvasOffset} theme={theme} />

          {/* Deselect backdrop — first child = lowest z-order, items sit above it */}
          <div className="absolute inset-0" onClick={() => setSelectedItemIds([])} />

          {/* ── Items layer ── */}
          <div className="absolute inset-0 pointer-events-none">
            <div style={canvasTransformStyle}>
              {canvasItems.map(item => (
                <div
                  key={item.id}
                  className="absolute"
                  data-item-id={item.id}
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    zIndex: item.zIndex,
                    background: item.type === 'artboard' ? '#ffffff' : 'transparent',
                    border: '1px solid #dddddd',
                    overflow: (item.type === 'artboard' || item.type === 'upload')
                      ? (imageEditingId === item.id ? 'visible' : 'hidden')
                      : undefined,
                    pointerEvents: (isGenerating || canvasMode !== 'select') ? 'none' : 'all',
                    cursor: canvasMode === 'select' ? 'default' : 'inherit',
                  }}
                  onClick={e => { e.stopPropagation(); setSelectedItemIds([item.id]); }}
                >
                  {(item.type === 'artboard' || item.type === 'upload') ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        transform: `translate(${item.contentOffset?.x ?? 0}px, ${item.contentOffset?.y ?? 0}px) scale(${(item.contentScale ?? 100) / 100})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {item.src && (() => {
                        const ct = item.contentTransform;
                        if (ct) {
                          return (
                            <img
                              src={item.src}
                              alt=""
                              className={imageEditingId === item.id ? 'img-move-area' : ''}
                              draggable={false}
                              style={{
                                position: 'absolute',
                                left: ct.x,
                                top: ct.y,
                                width: ct.width,
                                height: ct.height,
                                transform: `rotate(${ct.rotation}deg)`,
                                transformOrigin: 'center center',
                                cursor: imageEditingId === item.id ? 'move' : 'default',
                                pointerEvents: imageEditingId === item.id ? 'all' : 'none',
                                userSelect: 'none',
                              }}
                            />
                          );
                        }
                        return <img src={item.src} alt="" className="w-full h-full object-contain" draggable={false} />;
                      })()}

                      {/* Image transform handles overlay */}
                      {imageEditingId === item.id && item.contentTransform && (() => {
                        const ct = item.contentTransform;
                        const hSize = 10 / scale;
                        const rotHandleOffset = 28 / scale;

                        // 이미지 중심 기준 회전 변환 헬퍼
                        const cx = ct.x + ct.width / 2;
                        const cy = ct.y + ct.height / 2;
                        const rad = (ct.rotation ?? 0) * Math.PI / 180;
                        const cosR = Math.cos(rad);
                        const sinR = Math.sin(rad);
                        const rotatePoint = (px: number, py: number) => ({
                          x: cx + (px - cx) * cosR - (py - cy) * sinR,
                          y: cy + (px - cx) * sinR + (py - cy) * cosR,
                        });

                        const handles = [
                          { dx: -1, dy: -1, cursor: 'nwse-resize', ...rotatePoint(ct.x,              ct.y) },
                          { dx:  1, dy: -1, cursor: 'nesw-resize', ...rotatePoint(ct.x + ct.width,    ct.y) },
                          { dx: -1, dy:  1, cursor: 'nesw-resize', ...rotatePoint(ct.x,              ct.y + ct.height) },
                          { dx:  1, dy:  1, cursor: 'nwse-resize', ...rotatePoint(ct.x + ct.width,    ct.y + ct.height) },
                          { dx:  0, dy: -1, cursor: 'ns-resize',   ...rotatePoint(ct.x + ct.width / 2, ct.y) },
                          { dx:  0, dy:  1, cursor: 'ns-resize',   ...rotatePoint(ct.x + ct.width / 2, ct.y + ct.height) },
                          { dx: -1, dy:  0, cursor: 'ew-resize',   ...rotatePoint(ct.x,              ct.y + ct.height / 2) },
                          { dx:  1, dy:  0, cursor: 'ew-resize',   ...rotatePoint(ct.x + ct.width,    ct.y + ct.height / 2) },
                        ];

                        const rotHandlePos = rotatePoint(ct.x + ct.width / 2, ct.y - rotHandleOffset);

                        return (
                          <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: 10 }}>
                            {/* Dashed border around image */}
                            <div
                              className="absolute pointer-events-none"
                              style={{
                                left: ct.x, top: ct.y, width: ct.width, height: ct.height,
                                transform: `rotate(${ct.rotation}deg)`,
                                transformOrigin: 'center center',
                                border: `${1.5 / scale}px dashed #f97316`,
                              }}
                            />
                            {/* Resize handles — rotated with image */}
                            {handles.map((h, i) => (
                              <div
                                key={`ih-${i}`}
                                className="img-resize-handle"
                                data-dx={h.dx}
                                data-dy={h.dy}
                                style={{
                                  position: 'absolute',
                                  left: h.x - hSize / 2,
                                  top: h.y - hSize / 2,
                                  width: hSize,
                                  height: hSize,
                                  background: 'white',
                                  border: `${1.5 / scale}px solid #f97316`,
                                  borderRadius: '999px',
                                  pointerEvents: 'all',
                                  cursor: h.cursor,
                                  zIndex: 11,
                                }}
                              />
                            ))}
                            {/* Rotate handle — rotated with image */}
                            <div
                              className="img-rotate-handle cursor-rotate"
                              style={{
                                position: 'absolute',
                                left: rotHandlePos.x - hSize / 2,
                                top: rotHandlePos.y - hSize / 2,
                                width: hSize,
                                height: hSize,
                                background: '#f97316',
                                border: `${1.5 / scale}px solid white`,
                                borderRadius: '999px',
                                pointerEvents: 'all',
                                zIndex: 11,
                              }}
                            />
                          </div>
                        );
                      })()}

                      {/* Artboard internal grid */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: [
                            'linear-gradient(to right,  rgba(0,0,0,0.2) 1px, transparent 1px)',
                            'linear-gradient(to bottom, rgba(0,0,0,0.2) 1px, transparent 1px)',
                            'linear-gradient(to right,  rgba(0,0,0,0.1) 1px, transparent 1px)',
                            'linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)',
                          ].join(', '),
                          backgroundSize: '60px 60px, 60px 60px, 12px 12px, 12px 12px',
                          backgroundPosition: 'center center, center center, center center, center center',
                        }}
                      />

                      {/* Pixel sketch canvas overlay */}
                      <canvas
                        ref={el => {
                          if (el) {
                            artboardCanvasRefs.current.set(item.id, el);
                            const dpr = window.devicePixelRatio || 1;
                            const physW = Math.round(item.width * dpr);
                            const physH = Math.round(item.height * dpr);
                            const needsResize = el.width !== physW || el.height !== physH;
                            if (needsResize) {
                              // canvas 크기 변경 시 context transform 자동 리셋 → DPR scale 재적용 필요
                              el.width = physW;
                              el.height = physH;
                              canvasDprInitRef.current.delete(item.id);
                            }
                            if (!canvasDprInitRef.current.has(item.id)) {
                              canvasDprInitRef.current.add(item.id);
                              const ctx = el.getContext('2d');
                              if (ctx) ctx.scale(dpr, dpr);
                            }
                            // 세션 중 1회만 IndexedDB에서 픽셀 복원
                            if (!pixelRestoredRef.current.has(item.id)) {
                              pixelRestoredRef.current.add(item.id);
                              loadImageFromDB(`pixel_${item.id}`).then(dataUrl => {
                                if (dataUrl && el) {
                                  const img = new Image();
                                  img.onload = () => {
                                    const ctx = el.getContext('2d');
                                    if (ctx) {
                                      ctx.globalCompositeOperation = 'source-over';
                                      // CSS 좌표계로 그려야 DPR scale된 context가 올바른 물리 픽셀로 매핑
                                      ctx.drawImage(img, 0, 0, item.width, item.height);
                                    }
                                  };
                                  img.src = dataUrl;
                                }
                              });
                            }
                          } else {
                            artboardCanvasRefs.current.delete(item.id);
                            // pixelRestoredRef / canvasDprInitRef는 handleDeleteItem에서만 삭제
                          }
                        }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      {item.src && (
                        <img src={item.src} alt="" className="w-full h-full object-fill" draggable={false} />
                      )}
                      {item.text && (
                        <div className="p-1 text-sm">{item.text}</div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* Pen / Eraser SVG cursor indicator */}
              {(canvasMode === 'pen' || canvasMode === 'eraser') && (
                <svg
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    overflow: 'visible',
                    pointerEvents: 'none',
                    zIndex: 9999,
                  }}
                >
                  <circle
                    cx={lastMousePos.x}
                    cy={lastMousePos.y}
                    r={canvasMode === 'pen' ? penStrokeWidth / 2 : eraserStrokeWidth / 2}
                    fill={canvasMode === 'pen' ? (theme === 'dark' ? '#ffffff' : '#111111') : 'none'}
                    stroke={theme === 'dark' ? '#ffffff' : '#111111'}
                    strokeWidth={canvasMode === 'eraser' ? 1 / scale : 0}
                    opacity={0.6}
                  />
                </svg>
              )}
            </div>
          </div>

          {/* ── Drag select rect overlay — z-[103] ── */}
          {dragSelectRect && (() => {
            const left = Math.min(dragSelectRect.startX, dragSelectRect.endX);
            const top = Math.min(dragSelectRect.startY, dragSelectRect.endY);
            const width = Math.abs(dragSelectRect.endX - dragSelectRect.startX);
            const height = Math.abs(dragSelectRect.endY - dragSelectRect.startY);
            return (
              <div className="absolute inset-0 pointer-events-none z-[103]">
                <div style={canvasTransformStyle}>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left, top, width, height,
                      border: '1.5px dashed #4f9cf9',
                      background: 'rgba(79,156,249,0.08)',
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* ── Selection border + floating control bar — z-[105] ── */}
          {selectedItemIds.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-[105]">
              <div style={canvasTransformStyle}>
                {selectedItemIds.map(id => {
                  const item = canvasItems.find(i => i.id === id);
                  if (!item) return null;
                  return (
                    <div
                      key={`sel-${id}`}
                      style={{
                        position: 'absolute',
                        left: item.x - 1,
                        top: item.y - 1,
                        width: item.width + 2,
                        height: item.height + 2,
                        borderWidth: `${1.6 / scale}px`,
                        borderStyle: 'solid',
                        borderColor: '#1d4ed8',
                      }}
                    >
                      {/* Artboard top-left control bar (zoom + lock) — hidden in image edit mode */}
                      {(item.type === 'artboard' || item.type === 'upload') && imageEditingId !== id && (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${-56 / barScale}px`,
                            left: 0,
                            height: `${ctrlBarH}px`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: `${ctrlGap}px`,
                            padding: `0 ${ctrlPadX}px`,
                            background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: `${999 / barScale}px`,
                            border: `${1 / barScale}px solid rgba(0,0,0,0.08)`,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            pointerEvents: 'auto',
                            whiteSpace: 'nowrap',
                          }}
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            title="확대 (+10%)"
                            disabled={(item.contentScale ?? 100) >= 200}
                            style={{
                              width: `${ctrlBtnSize}px`, height: `${ctrlBtnSize}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                              opacity: (item.contentScale ?? 100) >= 200 ? 0.3 : 1,
                            }}
                            onClick={() => setCanvasItems(prev => prev.map(i =>
                              i.id === id ? { ...i, contentScale: Math.min(200, (i.contentScale ?? 100) + 10) } : i
                            ))}
                          >
                            <ZoomIn style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                          </button>
                          <button
                            title="축소 (-10%)"
                            disabled={(item.contentScale ?? 100) <= 100}
                            style={{
                              width: `${ctrlBtnSize}px`, height: `${ctrlBtnSize}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                              opacity: (item.contentScale ?? 100) <= 100 ? 0.3 : 1,
                            }}
                            onClick={() => setCanvasItems(prev => prev.map(i =>
                              i.id === id ? { ...i, contentScale: Math.max(100, (i.contentScale ?? 100) - 10) } : i
                            ))}
                          >
                            <ZoomOut style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                          </button>
                          <button
                            title={item.locked ? '잠금 해제' : '이동 잠금'}
                            style={{
                              width: `${ctrlBtnSize}px`, height: `${ctrlBtnSize}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                              color: item.locked
                                ? (theme === 'dark' ? '#60a5fa' : '#2563eb')
                                : (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                            }}
                            onClick={() => setCanvasItems(prev => prev.map(i =>
                              i.id === id ? { ...i, locked: !i.locked } : i
                            ))}
                          >
                            {item.locked
                              ? <Lock style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                              : <Unlock style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                            }
                          </button>
                        </div>
                      )}

                      {/* Image edit mode: bottom confirm / cancel bar */}
                      {imageEditingId === id && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: `${-56 / barScale}px`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            height: `${ctrlBarH}px`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: `${ctrlGap}px`,
                            padding: `0 ${ctrlPadX}px`,
                            background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: `${999 / barScale}px`,
                            border: `${1 / barScale}px solid rgba(0,0,0,0.08)`,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            pointerEvents: 'auto',
                            whiteSpace: 'nowrap',
                          }}
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Rotation label */}
                          {(item.contentTransform?.rotation ?? 0) !== 0 && (
                            <span style={{
                              fontSize: `${11 / barScale}px`,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                              minWidth: `${32 / barScale}px`,
                              textAlign: 'center',
                            }}>
                              {Math.round(item.contentTransform!.rotation)}°
                            </span>
                          )}
                          {/* Confirm */}
                          <button
                            title="변환 확정"
                            style={{
                              width: `${ctrlBtnSize}px`, height: `${ctrlBtnSize}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                              color: '#16a34a',
                            }}
                            onClick={handleImageTransformConfirm}
                          >
                            <svg width={ctrlIconSize} height={ctrlIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          {/* Cancel */}
                          <button
                            title="변환 취소"
                            style={{
                              width: `${ctrlBtnSize}px`, height: `${ctrlBtnSize}px`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                            }}
                            onClick={handleImageTransformCancel}
                          >
                            <svg width={ctrlIconSize} height={ctrlIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Floating control bar — hidden in image edit mode */}
                      {imageEditingId !== id && <div
                        style={{
                          position: 'absolute',
                          top: `${-56 / barScale}px`,
                          right: 0,
                          height: `${ctrlBarH}px`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: `${ctrlGap}px`,
                          padding: `0 ${ctrlPadX}px`,
                          background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)',
                          backdropFilter: 'blur(8px)',
                          borderRadius: `${999 / barScale}px`,
                          border: `${1 / barScale}px solid rgba(0,0,0,0.08)`,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          pointerEvents: 'auto',
                          whiteSpace: 'nowrap',
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                      >
                        {/* sketch_generated: Edit (+) → promote to upload */}
                        {item.type === 'sketch_generated' && (
                          <button
                            title="편집 (스케치 가능 상태로 승격)"
                            style={{
                              width: `${ctrlBtnSize}px`,
                              height: `${ctrlBtnSize}px`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                            }}
                            onClick={() => {
                              setHistoryStates(h => [...h, canvasItemsRef.current]);
                              setRedoStates([]);
                              setCanvasItems(prev => prev.map(i =>
                                i.id === id ? { ...i, type: 'upload' as const } : i
                              ));
                              setCanvasMode('pen');
                            }}
                          >
                            <Plus style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                          </button>
                        )}

                        {/* Download (For any item with src, or any artboard/upload with sketches) */}
                        {(item.src || item.type === 'artboard' || item.type === 'upload') && (
                          <button
                            title="Download"
                            style={{
                              width: `${ctrlBtnSize}px`,
                              height: `${ctrlBtnSize}px`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                            }}
                            onClick={() => handleDownloadItem(item)}
                          >
                            <Download style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                          </button>
                        )}

                        {/* artboard: Replace image */}
                        {item.type === 'artboard' && (
                          <button
                            title="Upload image"
                            style={{
                              width: `${ctrlBtnSize}px`,
                              height: `${ctrlBtnSize}px`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: `${999 / barScale}px`,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                            }}
                            onClick={() => {
                              pendingReplaceArtboardId.current = id;
                              replaceArtboardFileInputRef.current?.click();
                            }}
                          >
                            <Upload style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          title="Delete"
                          style={{
                            width: `${ctrlBtnSize}px`,
                            height: `${ctrlBtnSize}px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: `${999 / barScale}px`,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: '#ef4444',
                          }}
                          onClick={() => handleDeleteItem(id)}
                        >
                          <Trash2 style={{ width: `${ctrlIconSize}px`, height: `${ctrlIconSize}px` }} />
                        </button>
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Resize handles — z-[115], sketch_generated only ── */}
          {selectedItemIds.length === 1 && (() => {
            const item = canvasItems.find(i => i.id === selectedItemIds[0]);
            if (!item || item.type === 'artboard') return null;
            const hSize = 12 / scale;
            const hBorder = 1.6 / scale;
            return (
              <div className="absolute inset-0 pointer-events-none z-[115]">
                <div style={canvasTransformStyle}>
                  {[
                    { dx: -1, dy: -1, cursor: 'nwse-resize', x: item.x - hSize / 2, y: item.y - hSize / 2 },
                    { dx: 1, dy: -1, cursor: 'nesw-resize', x: item.x + item.width - hSize / 2, y: item.y - hSize / 2 },
                    { dx: -1, dy: 1, cursor: 'nesw-resize', x: item.x - hSize / 2, y: item.y + item.height - hSize / 2 },
                    { dx: 1, dy: 1, cursor: 'nwse-resize', x: item.x + item.width - hSize / 2, y: item.y + item.height - hSize / 2 },
                  ].map((pos, idx) => (
                    <div
                      key={`rh-${idx}`}
                      className="resize-handle"
                      data-dx={pos.dx}
                      data-dy={pos.dy}
                      style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y,
                        width: hSize,
                        height: hSize,
                        borderWidth: hBorder,
                        borderStyle: 'solid',
                        backgroundColor: 'white',
                        borderColor: '#808080',
                        borderRadius: '999px',
                        pointerEvents: 'auto',
                        cursor: pos.cursor,
                      }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        setHistoryStates(h => [...h, canvasItemsRef.current]);
                        setRedoStates([]);
                        isResizingItem.current = true;
                        resizeCorner.current = { dx: pos.dx, dy: pos.dy };
                        const pt = getCanvasCoords(e.clientX, e.clientY);
                        resizeStart.current = {
                          x: pt.x, y: pt.y,
                          itemX: item.x, itemY: item.y,
                          width: item.width, height: item.height,
                        };
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Hidden file input for artboard image replacement */}
          <input
            type="file"
            ref={replaceArtboardFileInputRef}
            onChange={handleReplaceArtboardImage}
            accept="image/*"
            className="hidden"
          />
        </div>

        <RightSidebar
          isRightPanelOpen={isRightPanelOpen}
          setIsRightPanelOpen={setIsRightPanelOpen}
          isGenerating={isGenerating}
          generateWarning={generateWarning}
          hasSelectedArtboard={(() => {
            const item = canvasItems.find(i => i.id === selectedItemIds[0]);
            return !!item && (item.type === 'artboard' || item.type === 'upload' || item.type === 'sketch_generated');
          })()}
          planPrompt={planPrompt}
          setPlanPrompt={setPlanPrompt}
          floorType={floorType}
          setFloorType={setFloorType}
          gridModule={gridModule}
          setGridModule={setGridModule}
          roomAnalysis={parameterReport}
          handleGenerate={handleGenerate}
        />
      </div>

      {/* Status bar */}
      <div className={`h-7 flex items-center px-4 gap-4 text-[0.6875rem] text-gray-400 shrink-0 border-t border-gray-200 touch:hidden ${theme === 'dark' ? 'bg-[#111]' : 'bg-white'}`}>
        <span>Mode: <b className="text-gray-600">{canvasMode.toUpperCase()}</b></span>
        <span>Zoom: <b className="text-gray-600">{Math.round(canvasZoom)}%</b></span>
        <span>Items: <b className="text-gray-600">{canvasItems.length}</b></span>
        <span>Selected: <b className="text-gray-600">{selectedItemIds.length}</b></span>
        <span className="ml-auto">V: select · H: pan · P: pen · E: eraser · Ctrl+Z: undo · 0: fit</span>
      </div>
    </div>
  );
}
