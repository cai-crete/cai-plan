import React from 'react';
import { Loader2, Copy, X, AlertTriangle } from 'lucide-react';

const STYLE_DESCRIPTIONS: Record<string, {
  title: { ko: string; en: string };
  keywords: { ko: string; en: string }[];
}> = {
  'A': { title: { ko: '장중한 메스의 규칙', en: 'Vitruvian Tectonics' }, keywords: [{ en: 'Fragment', ko: '분절' }, { en: 'Stagger', ko: '엇갈림' }, { en: 'Deep Set Recess', ko: '창호의 깊이감' }, { en: 'Contextual Material Derivation', ko: '맥락적 재료 파생' }, { en: 'Diffuse Timelessness', ko: '확산된 시간성' }] },
  'B': { title: { ko: '순수한 기하학적형태', en: 'Geometric Purity' }, keywords: [{ en: 'Orthogonal Grid', ko: '직교 그리드' }, { en: 'Layered Transparency', ko: '레이어 투명성' }, { en: 'Elevated Massing', ko: '띄워진 매스' }, { en: 'Absolute Whiteness', ko: '절대 백색' }, { en: 'Hard Sunlight Chiaroscuro', ko: '강렬한 명암법' }] },
  'C': { title: { ko: '가구식 구조', en: 'Particlization' }, keywords: [{ en: 'Divide', ko: '분할' }, { en: 'Kigumi Joinery', ko: '결구 접합' }, { en: 'Deep Eaves', ko: '깊은 처마' }, { en: 'Blurred Edge', ko: '흐릿한 경계' }, { en: 'Komorebi Lighting', ko: '목과 빛' }] },
  'D': { title: { ko: '고지식한 조형성', en: 'Incised Geometry' }, keywords: [{ en: 'Platonic Extrusion', ko: '플라톤적 돌출' }, { en: 'Strategic Incision', ko: '전략적 절개' }, { en: 'Horizontal Striping', ko: '수평 줄무늬' }, { en: 'Brick Pattern Variation', ko: '벽돌 패턴 변주' }, { en: 'Grounded Solidity', ko: '접지된 견고함' }] },
  'E': { title: { ko: '조형적인 유선형', en: 'Sculptural Fluidity' }, keywords: [{ en: 'Collide & Explode', ko: '충돌과 폭발' }, { en: 'Curve & Crumple', ko: '곡면과 구김' }, { en: 'Metallic Skin', ko: '금속 피부' }, { en: 'Asymmetric Fragmentation', ko: '비대칭 파편화' }, { en: 'Oblique Sunlight Drama', ko: '비스듬한 햇빛 드라마' }] },
  'F': { title: { ko: '다이어그램의 구조화', en: 'Diagrammatic Formalism' }, keywords: [{ en: 'Dual Grid Superimposition', ko: '이중 그리드 중첩' }, { en: 'Transformation Sequence', ko: '변형 연산 시퀀스' }, { en: 'Indexical Trace', ko: '지표적 흔적' }, { en: 'Anti-Compositional Logic', ko: '반구성 논리' }, { en: 'White Neutrality', ko: '백색 중립성' }] },
  'G': { title: { ko: '노출된 하이테크', en: 'Tectonic Transparency' }, keywords: [{ en: 'Kit of Parts', ko: '부품 조립' }, { en: 'Multi-Layered Facade', ko: '다층 입면' }, { en: 'Floating Roof', ko: '떠 있는 지붕' }, { en: 'Exposed Services', ko: '노출 설비' }, { en: 'Adaptive Permeability', ko: '적응적 투과성' }] },
};

export interface SketchToImagePanelProps {
  isGenerating: boolean;
  generateWarning: string | null;
  canGenerateDisabled: boolean;

  sketchPrompt: string;
  setSketchPrompt: (v: string) => void;
  sketchMode: string;
  setSketchMode: React.Dispatch<React.SetStateAction<string>>;
  sketchStyle: string | null;
  setSketchStyle: React.Dispatch<React.SetStateAction<string | null>>;
  activeDetailStyle: string | null;
  setActiveDetailStyle: (v: string | null) => void;
  aspectRatio: string | null;
  setAspectRatio: React.Dispatch<React.SetStateAction<string | null>>;
  resolution: string;
  setResolution: React.Dispatch<React.SetStateAction<string>>;

  onGenerate: () => void;
}

const SketchToImagePanel: React.FC<SketchToImagePanelProps> = ({
  isGenerating, generateWarning, canGenerateDisabled,
  sketchPrompt, setSketchPrompt,
  sketchMode, setSketchMode,
  sketchStyle, setSketchStyle,
  activeDetailStyle, setActiveDetailStyle,
  aspectRatio, setAspectRatio,
  resolution, setResolution,
  onGenerate,
}) => {
  const toggleBtn = (active: boolean, extra = '') =>
    `flex-1 h-[2.75rem] rounded-full font-display tracking-widest uppercase font-medium text-[0.875rem] transition-all border border-black/10 dark:border-white/10 ${active ? 'bg-black/5 dark:bg-white/5 text-black dark:text-white' : 'bg-transparent text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5'} ${extra}`;

  return (
    <aside className="h-full w-full rounded-[1.25rem] flex flex-col overflow-hidden bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-black/10 dark:border-white/10">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden px-4 pb-0 pt-4 min-h-0 flex flex-col gap-5">

          {/* PROMPT */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-mono text-xs opacity-70 uppercase tracking-widest">Prompt</span>
              <button onClick={() => navigator.clipboard.writeText(sketchPrompt)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors">
                <Copy size={14} className="opacity-40" />
              </button>
            </div>
            <textarea
              value={sketchPrompt}
              onChange={e => setSketchPrompt(e.target.value)}
              placeholder="Describe materials, lighting..."
              className="w-full h-[9.375rem] resize-none rounded-[0.75rem] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-black/50 p-3 font-mono text-xs focus:outline-none focus:border-black/30 dark:focus:border-white/30"
            />
          </div>

          {/* MODE */}
          <div>
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Mode</span>
            <div className="flex gap-3">
              {['CONCEPT', 'DETAIL'].map(mode => (
                <button key={mode} onClick={() => setSketchMode(prev => prev === mode ? '' : mode)} className={toggleBtn(sketchMode === mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* STYLE */}
          <div className="flex flex-col gap-5 shrink-0">
            <div className="shrink-0">
              <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">CRE-TE STYLE</span>
              <div className="grid grid-cols-4 gap-1.5">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'NONE'].map(style => (
                  <button
                    key={style}
                    onClick={() => {
                      const next = sketchStyle === style ? 'NONE' : style;
                      setSketchStyle(next);
                      setActiveDetailStyle(next !== 'NONE' ? next : null);
                    }}
                    className={`h-[2.75rem] rounded-full font-display tracking-widest uppercase font-medium text-[0.875rem] border border-black/10 dark:border-white/10 transition-all ${sketchStyle === style ? 'bg-black/5 dark:bg-white/5' : 'bg-white/80 dark:bg-black/80 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {activeDetailStyle && STYLE_DESCRIPTIONS[activeDetailStyle] && (
              <div className="h-[12.5rem] overflow-hidden">
                <div className="h-full bg-black/5 dark:bg-white/5 rounded-[1.25rem] p-4 relative border border-black/5 dark:border-white/5 flex flex-col">
                  <div className="shrink-0 mb-3 pr-8">
                    <h4 className="font-bold text-[0.8125rem] leading-tight">
                      {STYLE_DESCRIPTIONS[activeDetailStyle].title.ko}<br />
                      _{STYLE_DESCRIPTIONS[activeDetailStyle].title.en}
                    </h4>
                    <button onClick={() => setActiveDetailStyle(null)} className="absolute top-3 right-3 p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors group z-20">
                      <X size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    <ul className="space-y-3 pb-2">
                      {STYLE_DESCRIPTIONS[activeDetailStyle].keywords.map((kw, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2 mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-40" />
                          <div className="flex flex-col">
                            <span className="text-[0.6875rem] font-medium leading-tight">{kw.en}</span>
                            <span className="text-[0.6875rem] opacity-50 leading-tight">({kw.ko})</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ASPECT RATIO */}
          <div className="shrink-0">
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Aspect Ratio</span>
            <div className="flex gap-2">
              {['1:1', '4:3', '16:9'].map(ratio => (
                <button key={ratio} onClick={() => setAspectRatio(prev => prev === ratio ? null : ratio)}
                  className={`flex-1 h-[2.25rem] rounded-full font-display tracking-widest uppercase font-medium text-[0.75rem] transition-all border border-black/10 dark:border-white/10 ${aspectRatio === ratio ? 'bg-black/5 dark:bg-white/5' : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* RESOLUTION */}
          <div className="shrink-0">
            <span className="font-mono text-xs opacity-70 uppercase tracking-widest block mb-1.5">Resolution</span>
            <div className="flex gap-2">
              {['FAST', 'NORMAL', 'HIGH'].map(res => (
                <button key={res} onClick={() => setResolution(prev => prev.startsWith(res) ? '' : res + ' QUALITY')}
                  className={`flex-1 h-[2.25rem] rounded-full font-display tracking-widest uppercase font-medium text-[0.75rem] transition-all border border-black/10 dark:border-white/10 ${resolution.startsWith(res) ? 'bg-black/5 dark:bg-white/5' : 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 pt-5 shrink-0">
          <button
            onClick={onGenerate}
            disabled={canGenerateDisabled || !!generateWarning}
            className="relative w-full h-[2.75rem] rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center overflow-hidden border border-black/10 dark:border-white/10 enabled:bg-black enabled:text-white enabled:dark:bg-white enabled:dark:text-black"
          >
            <span className="font-display tracking-widest font-medium text-[1rem] z-10 flex items-center gap-2">
              {isGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : generateWarning ? (
                <>
                  <AlertTriangle size={18} />
                  <span className="font-sans">{generateWarning}</span>
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

export default SketchToImagePanel;
