'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2, AlertTriangle } from 'lucide-react';

const FLOOR_TYPES = [
  { key: 'RESIDENTIAL',         label: 'Residential / Housing' },
  { key: 'COMMERCIAL',          label: 'Commercial' },
  { key: 'OFFICE',              label: 'Office' },
  { key: 'MIXED_USE',           label: 'Mixed-use' },
  { key: 'CULTURAL_PUBLIC',     label: 'Cultural & Public' },
  { key: 'EDUCATION_RESEARCH',  label: 'Education & Research' },
  { key: 'HEALTHCARE_WELFARE',  label: 'Healthcare & Welfare' },
  { key: 'HOSPITALITY_LEISURE', label: 'Hospitality & Leisure' },
  { key: 'MASTERPLAN_URBANISM', label: 'Masterplan & Urbanism' },
] as const;

const GRID_MODULES = [1000, 2000, 4000, 8000, 16000, 24000] as const;

function formatGridLabel(mm: number): string {
  if (mm < 1000) return `${mm}mm`;
  const m = mm / 1000;
  return Number.isInteger(m) ? `${m},000mm` : `${mm}mm`;
}

export interface SketchToPlanPanelProps {
  isGenerating: boolean;
  generateWarning: string | null;
  hasSelectedArtboard: boolean;

  planPrompt: string;
  setPlanPrompt: (v: string) => void;
  floorType: string;
  setFloorType: (v: string) => void;
  gridModule: number;
  setGridModule: (v: number) => void;

  roomAnalysis: string | null;

  onGenerate: () => void;
}

const SketchToPlanPanel: React.FC<SketchToPlanPanelProps> = ({
  isGenerating, generateWarning, hasSelectedArtboard,
  planPrompt, setPlanPrompt,
  floorType, setFloorType,
  gridModule, setGridModule,
  roomAnalysis,
  onGenerate,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedType = FLOOR_TYPES.find(f => f.key === floorType);
  const gridIndex = GRID_MODULES.indexOf(gridModule as typeof GRID_MODULES[number]);
  const safeGridIndex = gridIndex === -1 ? 2 : gridIndex; // default: 4000mm (index 2)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canGenerate = !!floorType && hasSelectedArtboard && !isGenerating && !generateWarning;

  return (
    <aside className="h-full w-full rounded-[1.25rem] flex flex-col overflow-hidden bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-black/10 dark:border-white/10">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-4 pb-0 pt-4 min-h-0 flex flex-col gap-5 custom-scrollbar">

          {/* PROMPT */}
          <div>
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Prompt</span>
            <textarea
              value={planPrompt}
              onChange={e => setPlanPrompt(e.target.value)}
              placeholder="e.g. 3 bedrooms, open kitchen, south-facing living room"
              className="w-full h-[7.5rem] resize-none rounded-[0.75rem] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 p-3 font-mono text-xs focus:outline-none focus:border-black/30 dark:focus:border-white/30"
            />
          </div>

          {/* BUILDING TYPE — Dropdown */}
          <div ref={dropdownRef} className="relative">
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Building Type</span>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="w-full h-[2.75rem] px-4 rounded-[0.75rem] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 flex items-center justify-between font-mono text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <span className={selectedType ? 'opacity-100' : 'opacity-40'}>
                {selectedType?.label ?? 'Select building type'}
              </span>
              <ChevronDown
                size={14}
                className={`opacity-40 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-[0.75rem] border border-black/10 dark:border-white/10 bg-white dark:bg-black shadow-lg overflow-hidden">
                {FLOOR_TYPES.map(ft => (
                  <button
                    key={ft.key}
                    onClick={() => { setFloorType(ft.key); setDropdownOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left font-mono text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${floorType === ft.key ? 'bg-black/5 dark:bg-white/5 font-medium' : ''}`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GRID MODULE — Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-mono text-xs opacity-70 uppercase tracking-widest">Grid Module</span>
              <span className="font-mono text-xs font-medium tabular-nums">
                {formatGridLabel(GRID_MODULES[safeGridIndex])}
              </span>
            </div>

            {/* Step indicators */}
            <div className="relative px-1 mb-1">
              <input
                type="range"
                min={0}
                max={GRID_MODULES.length - 1}
                step={1}
                value={safeGridIndex}
                onChange={e => setGridModule(GRID_MODULES[Number(e.target.value)])}
                className="w-full h-1 appearance-none rounded-full bg-black/10 dark:bg-white/10 cursor-pointer accent-black dark:accent-white"
              />
            </div>

            {/* Step labels */}
            <div className="flex justify-between px-1">
              {GRID_MODULES.map((v, i) => (
                <button
                  key={v}
                  onClick={() => setGridModule(v)}
                  className={`font-mono text-[0.5625rem] tabular-nums transition-opacity ${safeGridIndex === i ? 'opacity-100 font-medium' : 'opacity-30 hover:opacity-60'}`}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {/* PARAMETER REPORT */}
          <div>
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Parameter Report</span>
            <div className="rounded-[0.75rem] border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-3 max-h-[12rem] overflow-y-auto custom-scrollbar">
              {roomAnalysis ? (
                <pre className="font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-words opacity-80">
                  {roomAnalysis}
                </pre>
              ) : (
                <p className="font-mono text-[0.6875rem] opacity-30 italic">No report generated yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 pt-5 shrink-0">
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="relative w-full h-[2.75rem] rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center overflow-hidden border border-black/10 dark:border-white/10 enabled:bg-black enabled:text-white enabled:dark:bg-white enabled:dark:text-black"
          >
            <span className="font-display tracking-widest font-medium text-[1rem] z-10 flex items-center gap-2">
              {isGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : generateWarning ? (
                <>
                  <AlertTriangle size={18} />
                  <span className="font-sans text-sm">{generateWarning}</span>
                </>
              ) : (
                'GENERATE'
              )}
            </span>
          </button>
        </div>

        <div className="p-3 mt-auto shrink-0 flex flex-col items-center gap-1">
          <p className="font-mono text-[0.625rem] opacity-40 text-center tracking-tighter">© CRETE CO.,LTD. 2026. ALL RIGHTS RESERVED.</p>
        </div>
      </div>
    </aside>
  );
};

export default SketchToPlanPanel;
