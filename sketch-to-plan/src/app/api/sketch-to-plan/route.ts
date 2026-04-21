import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { buildSystemPrompt, loadProtocolFile } from '@/lib/prompt';

const MODEL_ANALYSIS = 'gemini-3.1-pro-preview';
const MODEL_IMAGE_GEN = 'gemini-3.1-flash-image-preview';
const MODEL_ANALYSIS_FB = 'gemini-2.5-pro-preview';
const MODEL_IMAGE_GEN_FB = 'gemini-2.5-flash-image';
const TIMEOUT_ANALYSIS = 90000;
const TIMEOUT_IMAGE_GEN = 90000;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 2000;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

async function callWithFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await withRetry(primary);
  } catch (err) {
    console.warn('Primary model failed, trying fallback:', err);
    return await withRetry(fallback);
  }
}

export async function POST(req: NextRequest) {
  let body: {
    sketch_image: string;
    mime_type?: string;
    user_prompt?: string;
    floor_type?: string;
    grid_module?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    sketch_image,
    mime_type = 'image/png',
    user_prompt = '',
    floor_type = 'RESIDENTIAL',
    grid_module = 4000,
  } = body;

  if (!sketch_image) {
    return NextResponse.json({ error: 'sketch_image is required' }, { status: 400 });
  }

  const mimeTypeLower = mime_type.toLowerCase();
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeTypeLower)) {
    return NextResponse.json(
      { error: 'Invalid image type. Allowed: JPEG, PNG, WebP' },
      { status: 400 }
    );
  }

  const imageBytes = Buffer.from(sketch_image, 'base64');
  if (imageBytes.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image size exceeds 10MB limit' }, { status: 400 });
  }

  if (user_prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt exceeds ${MAX_PROMPT_LENGTH} character limit` },
      { status: 400 }
    );
  }

  // Load Protocol + Knowledge Docs — server-side only, never exposed to client
  let systemPrompt: string;
  try {
    const protocol = loadProtocolFile('protocol-sketch-to-plan-v3.8.txt');
    const wpGrid = loadProtocolFile('knowledge-wp-grid-mapping.txt');
    const templateA = loadProtocolFile('knowledge-template-a.txt');
    const archStd = loadProtocolFile('knowledge-architectural-standards.txt');
    systemPrompt = buildSystemPrompt(protocol, [wpGrid, templateA, archStd]);
  } catch (err) {
    console.error('Protocol load failed:', err);
    return NextResponse.json({ error: 'Protocol initialization failed' }, { status: 500 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const imagePart: Part = {
    inlineData: {
      mimeType: mimeTypeLower as AllowedMimeType,
      data: sketch_image,
    },
  };

  // Phase 1: Spatial Analysis (gemini-3.1-pro-preview)
  let analysisText: string;
  let analysisSpec: Record<string, unknown> = {};

  try {
    const analysisPrompt = [
      '스케치 이미지를 분석하세요.',
      '섹션 2 (AMP Engine) → 섹션 3 (Deep Spatial Vision 5-Step) → 섹션 4 Step 1~2 (Project Manager → Structural Engineer) 순서로 실행하세요.',
      '각 Step 완료 시 섹션 4.1의 Micro-Report Form 형식으로 핸드오프 리포트를 출력하세요.',
      '섹션 4 Step 2 완료 후 반드시 SPEC_OUTPUT: analysis-spec JSON 블록을 출력하세요.',
      '',
      `건물 용도: ${floor_type}`,
      `구조 그리드 모듈: ${grid_module}mm`,
      `사용자 요청: ${user_prompt || '(없음)'}`,
    ].join('\n');

    const makeAnalysisCall = (modelName: string) => () => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      return withTimeout(
        model.generateContent([imagePart, { text: analysisPrompt }]),
        TIMEOUT_ANALYSIS
      ).then((r) => r.response.text());
    };

    analysisText = await callWithFallback(
      makeAnalysisCall(MODEL_ANALYSIS),
      makeAnalysisCall(MODEL_ANALYSIS_FB)
    );

    // analysis-spec JSON 추출
    const jsonFenced = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonInline = analysisText.match(/\{[\s\S]*?"process"\s*:\s*"analysis"[\s\S]*?\}/);
    const rawJson = jsonFenced?.[1] ?? jsonInline?.[0];
    if (rawJson) {
      const jsonStart = rawJson.indexOf('{');
      const jsonEnd = rawJson.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          analysisSpec = JSON.parse(rawJson.slice(jsonStart, jsonEnd + 1));
        } catch {
          // spec 파싱 실패 시 빈 객체로 계속 진행
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Analysis failed:', msg);
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 503 });
  }

  // Phase 2: CAD Floor Plan Image Generation (gemini-3.1-flash-image-preview)
  let generatedPlanImageBase64: string;
  let roomAnalysis = '';

  try {
    const generationPrompt = [
      '섹션 4 Step 3~4 (Architectural Drafter → Interior Designer) 및 섹션 5~7을 실행하여 CAD 스타일 2D Top-down 건축 평면도를 생성하세요.',
      '',
      'Phase 1 analysis-spec:',
      JSON.stringify(analysisSpec, null, 2),
      '',
      '이미지 생성 후 섹션 6의 Self-Correction Protocol을 실행하고,',
      '섹션 8의 공간 파라미터 분석 결과를 텍스트로 출력하세요.',
      '',
      `건물 용도: ${floor_type}`,
      `구조 그리드 모듈: ${grid_module}mm`,
    ].join('\n');

    const makeGenerationCall = (modelName: string) => () => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as any,
      });
      return withTimeout(
        model.generateContent([imagePart, { text: generationPrompt }]),
        TIMEOUT_IMAGE_GEN
      ).then((r) => {
        const parts = r.response.candidates?.[0]?.content?.parts ?? [];
        const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imgPart?.inlineData?.data) throw new Error('No image in generation response');
        // 텍스트 파트(room analysis) 수집
        const textParts = parts.filter((p) => p.text).map((p) => p.text ?? '').join('\n');
        return { image: imgPart.inlineData.data, text: textParts };
      });
    };

    const result = await callWithFallback(
      makeGenerationCall(MODEL_IMAGE_GEN),
      makeGenerationCall(MODEL_IMAGE_GEN_FB)
    );
    generatedPlanImageBase64 = result.image;
    roomAnalysis = result.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Plan generation failed:', msg);
    return NextResponse.json({ error: `Plan generation failed: ${msg}` }, { status: 503 });
  }

  return NextResponse.json({
    generated_plan_image: generatedPlanImageBase64,
    room_analysis: roomAnalysis,
    analysis_spec: analysisSpec,
  });
}
