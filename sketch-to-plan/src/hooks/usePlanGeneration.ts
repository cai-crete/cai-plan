'use client';

import { useState, useCallback, RefObject } from 'react';

export interface PlanGenerationParams {
  userPrompt?: string;
  floorType?: string;
  gridModule?: number;
}

export interface PlanGenerationResult {
  generatedPlanImage: string | null;
  roomAnalysis: string | null;
}

export interface UsePlanGenerationReturn extends PlanGenerationResult {
  isLoading: boolean;
  error: string | null;
  generate: (
    canvasRef: RefObject<HTMLCanvasElement | null>,
    originalImage: string | null,
    params?: PlanGenerationParams
  ) => Promise<void>;
  reset: () => void;
}

export function usePlanGeneration(): UsePlanGenerationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPlanImage, setGeneratedPlanImage] = useState<string | null>(null);
  const [roomAnalysis, setRoomAnalysis] = useState<string | null>(null);

  const generate = useCallback(
    async (
      canvasRef: RefObject<HTMLCanvasElement | null>,
      originalImage: string | null,
      params: PlanGenerationParams = {}
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        let sketchBase64: string;
        let mimeType = 'image/png';

        if (canvasRef.current) {
          sketchBase64 = canvasRef.current.toDataURL('image/png').split(',')[1];
        } else if (originalImage) {
          const match = originalImage.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            sketchBase64 = match[2];
          } else {
            sketchBase64 = originalImage;
          }
        } else {
          throw new Error('스케치 이미지가 없습니다. 캔버스에 그리거나 이미지를 업로드하세요.');
        }

        const res = await fetch('/api/sketch-to-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sketch_image: sketchBase64,
            mime_type: mimeType,
            user_prompt: params.userPrompt ?? '',
            floor_type: params.floorType ?? 'RESIDENTIAL',
            grid_module: params.gridModule ?? 4000,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `API 오류: ${res.status}`);
        }

        const data = await res.json() as {
          generated_plan_image: string;
          room_analysis: string;
        };
        setGeneratedPlanImage(data.generated_plan_image);
        setRoomAnalysis(data.room_analysis);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setGeneratedPlanImage(null);
    setRoomAnalysis(null);
    setError(null);
  }, []);

  return { isLoading, error, generatedPlanImage, roomAnalysis, generate, reset };
}
