import React, { RefObject } from 'react';
import {
  Hand, MousePointer2, Lasso, Pencil, Eraser, Type,
  Undo, Redo,
} from 'lucide-react';
import { CanvasItem } from '../types/canvas';

export type CanvasMode = 'select' | 'pan' | 'lasso' | 'pen' | 'eraser' | 'text';

export interface LeftToolbarProps {
  canvasMode: CanvasMode;
  setCanvasMode: (mode: CanvasMode) => void;
  theme: 'light' | 'dark';

  // Stroke width
  penStrokeWidth: number;
  setPenStrokeWidth: (w: number) => void;
  eraserStrokeWidth: number;
  setEraserStrokeWidth: (w: number) => void;
  showStrokePanel: 'pen' | 'eraser' | null;
  setShowStrokePanel: React.Dispatch<React.SetStateAction<'pen' | 'eraser' | null>>;

  // History
  historyStates: CanvasItem[][];
  redoStates: CanvasItem[][];
  onUndo: () => void;
  onRedo: () => void;

  // Zoom & focus
  canvasZoom: number;
  onZoomStep: (delta: number) => void;
  onFocus: () => void;

  // Artboard upload
  canvasItems: CanvasItem[];
  onAddArtboard: () => void;
  artboardFileInputRef: RefObject<HTMLInputElement | null>;
  onArtboardImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const LeftToolbar: React.FC<LeftToolbarProps> = ({
  canvasMode, setCanvasMode,
  theme,
  penStrokeWidth, setPenStrokeWidth,
  eraserStrokeWidth, setEraserStrokeWidth,
  showStrokePanel, setShowStrokePanel,
  historyStates, redoStates,
  onUndo, onRedo,
  canvasZoom, onZoomStep, onFocus,
  onAddArtboard, artboardFileInputRef, onArtboardImageUpload,
}) => {
  const pillCls = 'flex flex-col items-center gap-2 bg-white/80 dark:bg-black/80 border border-black/10 dark:border-white/10 pointer-events-auto transition-all duration-300 rounded-full py-2 w-11 backdrop-blur-sm';
  const pillShadow = { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' };
  const btnActive = 'bg-black text-white dark:bg-white dark:text-black';
  const btnBase = 'w-8 h-8 flex items-center justify-center rounded-full transition-all hover:cursor-pointer';
  const btnInactive = 'hover:bg-black/5 dark:hover:bg-white/5';

  const strokePopupCls = 'absolute left-[calc(100%+0.75rem)] top-1/2 -translate-y-1/2 flex items-center h-8 px-0.5 gap-0.5 bg-white/90 dark:bg-black/90 border border-black/10 dark:border-white/10 rounded-full backdrop-blur-sm pointer-events-auto';

  const renderStrokeDot = (size: number, selected: boolean) =>
    selected ? (
      <div className="rounded-full flex items-center justify-center" style={{ width: 24, height: 24, backgroundColor: theme === 'dark' ? 'white' : 'black' }}>
        <div className="rounded-full" style={{ width: size, height: size, backgroundColor: theme === 'dark' ? 'black' : 'white' }} />
      </div>
    ) : (
      <div className="rounded-full" style={{ width: size, height: size, backgroundColor: theme === 'dark' ? 'white' : 'black' }} />
    );

  return (
    <div className="absolute left-[0.75rem] top-1/2 -translate-y-1/2 z-[120] flex flex-col items-center gap-3 pointer-events-none">

      {/* Upload Artboard */}
      <div className="flex flex-col items-center">
        <button
          onClick={onAddArtboard}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-colors shadow-lg pointer-events-auto hover:cursor-pointer"
          title="Upload Artboard"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
            <line x1="16" y1="5" x2="22" y2="5" />
            <line x1="19" y1="2" x2="19" y2="8" />
            <path d="M7 16l3-3 2 2 4-4 3 3" />
          </svg>
        </button>
        <input type="file" ref={artboardFileInputRef} onChange={onArtboardImageUpload} accept="image/*" className="hidden" />
      </div>

      {/* Pill 1: Tool buttons */}
      <div className={pillCls} style={pillShadow}>
        {/* Cursor */}
        <button
          onClick={() => setCanvasMode('select')}
          className={`${btnBase} ${canvasMode === 'select' ? btnActive : btnInactive}`}
          title="Cursor Mode"
        >
          <MousePointer2 size={18} />
        </button>

        {/* Pan */}
        <button
          onClick={() => setCanvasMode('pan')}
          className={`${btnBase} ${canvasMode === 'pan' ? btnActive : btnInactive}`}
          title="Pan Mode"
        >
          <Hand size={18} />
        </button>

        {/* Lasso */}
        <button
          onClick={() => setCanvasMode('lasso')}
          className={`${btnBase} ${canvasMode === 'lasso' ? btnActive : btnInactive}`}
          title="Lasso Select"
        >
          <Lasso size={18} />
        </button>

        <div className="w-6 h-[1px] bg-black/10 dark:bg-white/10 my-1" />

        {/* Pen */}
        <div className="relative">
          <button
            onClick={() => {
              if (canvasMode === 'pen') setShowStrokePanel(prev => prev === 'pen' ? null : 'pen');
              else { setCanvasMode('pen'); setShowStrokePanel(null); }
            }}
            className={`${btnBase} ${canvasMode === 'pen' ? btnActive : btnInactive}`}
            title="Pen Tool"
          >
            <Pencil size={18} />
          </button>
          {showStrokePanel === 'pen' && (
            <div className={strokePopupCls} style={pillShadow}>
              {([0.5, 1, 2, 4, 6] as const).map(size => (
                <button key={size} onClick={() => setPenStrokeWidth(size)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                  {renderStrokeDot(size, penStrokeWidth === size)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Eraser */}
        <div className="relative">
          <button
            onClick={() => {
              if (canvasMode === 'eraser') setShowStrokePanel(prev => prev === 'eraser' ? null : 'eraser');
              else { setCanvasMode('eraser'); setShowStrokePanel(null); }
            }}
            className={`${btnBase} ${canvasMode === 'eraser' ? btnActive : btnInactive}`}
            title="Eraser Tool"
          >
            <Eraser size={18} />
          </button>
          {showStrokePanel === 'eraser' && (
            <div className={strokePopupCls} style={pillShadow}>
              {([10, 15, 20, 25, 30] as const).map(size => (
                <button key={size} onClick={() => setEraserStrokeWidth(size)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                  {renderStrokeDot(size, eraserStrokeWidth === size)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text */}
        <button
          onClick={() => setCanvasMode('text')}
          className={`${btnBase} ${canvasMode === 'text' ? btnActive : btnInactive}`}
          title="Text Tool"
        >
          <Type size={18} />
        </button>

        <div className="w-6 h-[1px] bg-black/10 dark:bg-white/10 my-1" />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={historyStates.length === 0}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${historyStates.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5 hover:cursor-pointer'}`}
          title="Undo"
        >
          <Undo size={18} />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={redoStates.length === 0}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${redoStates.length === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5 hover:cursor-pointer'}`}
          title="Redo"
        >
          <Redo size={18} />
        </button>
      </div>

      {/* Pill 2: Zoom controls */}
      <div className={pillCls} style={pillShadow}>
        <button
          onClick={onFocus}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors hover:cursor-pointer"
          title="Fit to Screen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
          </svg>
        </button>
        <div className="w-6 h-[1px] bg-black/10 dark:bg-white/10 my-1" />
        <button onClick={() => onZoomStep(1)} className="w-8 h-8 flex items-center justify-center rounded-full font-mono text-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors hover:cursor-pointer">+</button>
        <div className="font-mono text-[0.625rem] font-bold text-neutral-600 dark:text-neutral-400 select-none">{Math.round(canvasZoom)}%</div>
        <button onClick={() => onZoomStep(-1)} className="w-8 h-8 flex items-center justify-center rounded-full font-mono text-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors hover:cursor-pointer">−</button>
      </div>
    </div>
  );
};

export default LeftToolbar;
