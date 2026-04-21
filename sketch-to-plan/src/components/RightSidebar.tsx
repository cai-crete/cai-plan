import React from 'react';
import { PanelRight } from 'lucide-react';
import SketchToPlanPanel from './panels/SketchToPlanPanel';

export interface RightSidebarProps {
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (v: boolean) => void;
  isGenerating: boolean;
  generateWarning: string | null;

  planPrompt: string;
  setPlanPrompt: (v: string) => void;
  floorType: string;
  setFloorType: (v: string) => void;
  gridModule: number;
  setGridModule: (v: number) => void;

  roomAnalysis: string | null;

  handleGenerate: () => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isRightPanelOpen, setIsRightPanelOpen,
  isGenerating, generateWarning,
  planPrompt, setPlanPrompt,
  floorType, setFloorType,
  gridModule, setGridModule,
  roomAnalysis,
  handleGenerate,
}) => {
  return (
    <div className="absolute top-0 right-0 h-full z-[120] pointer-events-none flex justify-end p-[0.75rem]">
      <div className={`
        relative h-full transition-all duration-500 ease-in-out flex flex-col items-end
        ${isRightPanelOpen ? 'w-[17.75rem]' : 'w-11'}
        ${isGenerating ? 'opacity-50 [&_*]:!pointer-events-none' : ''}
      `}>

        {/* Header row: label + toggle */}
        <div className="w-[17.75rem] shrink-0 h-[2.75rem] flex items-center gap-[0.75rem] mb-[0.75rem]">
          <div className={`
            flex-1 h-full rounded-full bg-white/80 dark:bg-black/80 border border-black/10 dark:border-white/10
            flex items-center px-5 backdrop-blur-sm shadow-sm transition-all duration-500 ease-in-out pointer-events-auto
            ${isRightPanelOpen ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}
          `}>
            <span className="font-display tracking-widest uppercase font-medium text-[0.9375rem]">
              SKETCH TO PLAN
            </span>
          </div>
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="w-11 h-11 shrink-0 rounded-full bg-white/80 dark:bg-black/80 border border-black/10 dark:border-white/10 flex items-center justify-center backdrop-blur-sm shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all pointer-events-auto"
          >
            <PanelRight size={18} />
          </button>
        </div>

        {/* Panel */}
        <div className={`
          absolute inset-0 top-[3.5rem] transition-all duration-500 ease-in-out
          ${isRightPanelOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-10 opacity-0 pointer-events-none'}
        `}>
          <SketchToPlanPanel
            isGenerating={isGenerating}
            generateWarning={generateWarning}
            planPrompt={planPrompt}
            setPlanPrompt={setPlanPrompt}
            floorType={floorType}
            setFloorType={setFloorType}
            gridModule={gridModule}
            setGridModule={setGridModule}
            roomAnalysis={roomAnalysis}
            onGenerate={handleGenerate}
          />
        </div>

      </div>
    </div>
  );
};

export default RightSidebar;
