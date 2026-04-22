export type ItemType =
  | 'image'
  | 'artboard'
  | 'upload'
  | 'path'
  | 'text'
  | 'sketch_generated'
  | 'generated';

export type CanvasMode = 'select' | 'pan' | 'lasso' | 'pen' | 'eraser' | 'text';

export interface Point {
  x: number;
  y: number;
}

// Layer hierarchy (top → bottom): sketch → cadastral → grid
export type LayerType = 'sketch' | 'cadastral' | 'grid';

export interface CanvasItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  src?: string;
  motherId?: string;
  label?: string;
  parameters?: Record<string, unknown>;
  points?: Point[];
  text?: string;
  strokeColor?: string;
  strokeWidth?: number;
  zIndex: number;
  layerType?: LayerType;
  sketchMode?: '' | 'CONCEPT' | 'DETAIL';
  sketchStyle?: string;
  sketchAspectRatio?: string;
  sketchResolution?: string;
  contentScale?: number;
  contentOffset?: { x: number; y: number };
  contentTransform?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };
  locked?: boolean;
}
