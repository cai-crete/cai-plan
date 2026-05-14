import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { loadProtocolFile } from '@/lib/prompt';

const MODEL_ANALYSIS     = 'gemini-3.1-pro-preview';
const MODEL_IMAGE_GEN    = 'gemini-3.1-flash-image-preview';
const MODEL_ANALYSIS_FB  = 'gemini-2.5-pro-preview';
const MODEL_IMAGE_GEN_FB = 'gemini-2.5-flash-image';
const TIMEOUT_ANALYSIS   = 90000;
const TIMEOUT_IMAGE_GEN  = 90000;

const MAX_IMAGE_BYTES    = 10 * 1024 * 1024;
const MAX_PROMPT_LENGTH  = 2000;
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

function toImagePart(base64: string, mimeType: string): Part {
  return { inlineData: { mimeType: mimeType as AllowedMimeType, data: base64 } };
}

function extractBlock(text: string, tag: string): string {
  const pattern = new RegExp('```' + tag + '\\s*([\\s\\S]*?)\\s*```', 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractWorkmanagerLog(text: string): string {
  const match = text.match(/■\s*WORKMANAGER\s*LOG[\s\S]*?(?=\n■|\n##|$)/i);
  return match?.[0]?.trim() ?? '';
}

function extractResultPanel(text: string): string {
  const match = text.match(/■\s*Result\s*Summary[\s\S]*/i);
  return match?.[0]?.trim() ?? text.trim();
}

export async function POST(req: NextRequest) {
  let body: {
    sketch_image: string;
    mime_type?: string;
    user_prompt?: string;
    floor_type?: string;
    scale?: number;
    bcr_width_m?: number;
    bcr_height_m?: number;
    canvas_spatial_spec?: object;
    cadastral_image?: string;
    cadastral_mime_type?: string;
    composite_image?: string;
    composite_mime_type?: string;
    wp_mask_image?: string;
    wp_mask_mime_type?: string;
    artboard_width?: number;
    artboard_height?: number;
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
    scale,
    bcr_width_m,
    bcr_height_m,
    canvas_spatial_spec,
    cadastral_image,
    cadastral_mime_type = 'image/png',
    composite_image,
    composite_mime_type = 'image/png',
    wp_mask_image,
    wp_mask_mime_type = 'image/png',
    artboard_width,
    artboard_height,
  } = body;

  if (!sketch_image) {
    return NextResponse.json({ error: 'sketch_image is required' }, { status: 400 });
  }

  const requestStart = Date.now();

  const mimeTypeLower = mime_type.toLowerCase();
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeTypeLower)) {
    return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, WebP' }, { status: 400 });
  }

  if (Buffer.from(sketch_image, 'base64').length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image size exceeds 10MB limit' }, { status: 400 });
  }

  if (user_prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Prompt exceeds ${MAX_PROMPT_LENGTH} character limit` }, { status: 400 });
  }

  // ── System Instruction: 헌법 + 작업반장 + v5.0 ──────────────────────
  let systemPrompt: string;
  try {
    const constitution  = loadProtocolFile('gemini-constitution-v1.1.md');
    const workmanager   = loadProtocolFile('workmanager-v1.2.md');
    const sketchToPlanV5 = loadProtocolFile('system-prompt-sketch-to-plan-v5.0.md');
    systemPrompt = [
      '# LAYER 1: GEMINI ARCHITECTURAL CONSTITUTION',
      constitution,
      '---',
      '# LAYER 2: ADAPTIVE TASK COMPLETION PROTOCOL (작업반장)',
      workmanager,
      '---',
      '# LAYER 3: SKETCH-TO-PLAN v5.0 EXECUTION ENGINE',
      sketchToPlanV5,
    ].join('\n\n');
  } catch (err) {
    console.error('Protocol load failed:', err);
    return NextResponse.json({ error: 'Protocol initialization failed' }, { status: 500 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API configuration error' }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const sketchPart = toImagePart(sketch_image, mimeTypeLower);
  const extraImageParts: Part[] = [];
  if (cadastral_image)  extraImageParts.push(toImagePart(cadastral_image,  cadastral_mime_type));
  if (composite_image)  extraImageParts.push(toImagePart(composite_image,  composite_mime_type));
  if (wp_mask_image)    extraImageParts.push(toImagePart(wp_mask_image,    wp_mask_mime_type));

  console.log('[SKETCH-TO-PLAN] ▶ Request received', {
    floor_type,
    scale:        scale ?? null,
    bcr:          (bcr_width_m != null && bcr_height_m != null) ? `${bcr_width_m}x${bcr_height_m}m` : null,
    extra_images: extraImageParts.length,
    sketch_kb:    Math.round(Buffer.from(sketch_image, 'base64').length / 1024),
    user_prompt:  user_prompt || null,
  });

  // ── Phase 1: §1 ORCHESTRATE + §2 PERCEIVE + §3 LOCK & TRANSFORM ────
  let phase1Text = '';
  let gscData    = '';
  let orchestrationLog = '';
  let phase1ModelUsed = MODEL_ANALYSIS;

  try {
    const phase1Start = Date.now();
    console.log('[SKETCH-TO-PLAN] Phase 1 start — Analysis', { model: MODEL_ANALYSIS });
    const contextLines = [
      `건물 용도: ${floor_type}`,
      ...(scale != null        ? [`축척: 1/${scale}`] : []),
      ...(bcr_width_m != null  ? [`건물 폭: ${bcr_width_m}m`] : []),
      ...(bcr_height_m != null ? [`건물 깊이: ${bcr_height_m}m`] : []),
      ...(extraImageParts.length > 0 ? [`추가 이미지: ${extraImageParts.length}개 첨부 (지적도/합성/WP마스크)`] : []),
      `사용자 요청: ${user_prompt || '(없음)'}`,
      ...(canvas_spatial_spec ? ['', '캔버스 공간 정보:', JSON.stringify(canvas_spatial_spec, null, 2)] : []),
    ];

    const phase1Prompt = [
      '=== Phase 1: Analysis ===',
      '',
      '컨텍스트:',
      ...contextLines,
      '',
      '다음 순서로 실행하세요:',
      '',
      '【STEP A】 작업반장(Adaptive Task Completion Protocol) 로그 출력 (Section 8 예외 — 로그 출력 명시 요청):',
      '아래 형식으로 출력하세요:',
      '■ WORKMANAGER LOG',
      '  TASK INVENTORY:',
      '    [1] {작업명} — {등급 H/M/L}',
      '    [2] ...',
      '  LOAD ASSESSMENT: {전체 등급 및 사유}',
      '  REASONING BOUNDARY:',
      '    NON-REASONING: {위상 데이터 등 비추론 항목}',
      '    REASONING: {기하 정류, 추론 항목}',
      '  DEPTH ALLOCATION: {작업별 추론 깊이}',
      '',
      '【STEP B】 §1 ORCHESTRATE → Execution Plan 출력',
      '【STEP C】 §2 PERCEIVE → TSC 출력',
      '【STEP D】 §3 LOCK & TRANSFORM → GSC 출력',
      '',
      'GSC는 반드시 아래 블록 형식으로 출력하세요:',
      '```gsc',
      '{GSC 전체 내용}',
      '```',
    ].join('\n');

    const makePhase1Call = (modelName: string) => () => {
      phase1ModelUsed = modelName;
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
      return withTimeout(
        model.generateContent([sketchPart, ...extraImageParts, { text: phase1Prompt }]),
        TIMEOUT_ANALYSIS
      ).then((r) => r.response.text());
    };

    phase1Text = await callWithFallback(
      makePhase1Call(MODEL_ANALYSIS),
      makePhase1Call(MODEL_ANALYSIS_FB)
    );

    gscData          = extractBlock(phase1Text, 'gsc');
    orchestrationLog = extractWorkmanagerLog(phase1Text);

    console.log('[SKETCH-TO-PLAN] Phase 1 complete', {
      duration_ms:            Date.now() - phase1Start,
      model:                  phase1ModelUsed,
      gsc_found:              gscData.length > 0 && gscData !== phase1Text,
      orchestration_log_found: orchestrationLog.length > 0,
    });

    if (orchestrationLog) {
      console.log('[WORKMANAGER]\n' + orchestrationLog);
    }
    if (!gscData) {
      gscData = phase1Text;
      console.warn('[WORKMANAGER] GSC block not found, using full phase1 text as fallback');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Phase 1 (Analysis) failed:', msg);
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 503 });
  }

  // ── Phase 2: §4 SYNTHESIZE + §5 VERIFY & DELIVER ──────────────────
  let generatedPlanImageBase64 = '';
  let resultPanel = '';
  let siteAuthorityWarning = false;
  let scaleMismatchWarning = false;
  let phase2ModelUsed = MODEL_IMAGE_GEN;

  try {
    const phase2Start = Date.now();
    console.log('[SKETCH-TO-PLAN] Phase 2 start — Synthesis', { model: MODEL_IMAGE_GEN });
    const aspectRatioLine = (artboard_width && artboard_height)
      ? `출력 이미지 가로:세로 비율 = ${artboard_width}:${artboard_height} (입력 스케치와 동일)`
      : '';

    const phase2Prompt = [
      '=== Phase 2: Synthesis & Delivery ===',
      '',
      'Phase 1 GSC (Geometry-State Contract):',
      '```',
      gscData,
      '```',
      '',
      ...(aspectRatioLine ? [aspectRatioLine, ''] : []),
      '다음 순서로 실행하세요:',
      '【STEP E】 §4 SYNTHESIZE — GSC를 기반으로 2D 직교 CAD 평면도 이미지를 생성하세요.',
      '  - 원본 이미지 재참조 금지. GSC만 사용.',
      '  - §4.4 CAD 출력 표준 (흑백, 선 굵기 위계, 솔리드 포쉐, Boolean Union) 준수.',
      '',
      '【STEP F】 §5 VERIFY & DELIVER — 이미지 생성 후 텍스트로 출력:',
      '  - §5.1~§5.4 품질 검증 실행',
      '  - §5.6 Result Summary 포맷 출력',
      '  - §5.10 Room Parameter Panel 출력 (실이 3개 이상 확인된 경우)',
    ].join('\n');

    const makePhase2Call = (modelName: string) => () => {
      phase2ModelUsed = modelName;
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as any,
      });
      return withTimeout(
        // Phase 2: 스케치 이미지 포함 (§4는 GSC 전용이지만 모델은 이미지 필요)
        model.generateContent([sketchPart, ...extraImageParts, { text: phase2Prompt }]),
        TIMEOUT_IMAGE_GEN
      ).then((r) => {
        const parts = r.response.candidates?.[0]?.content?.parts ?? [];
        const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!imgPart?.inlineData?.data) throw new Error('No image in generation response');
        const textParts = parts.filter((p) => p.text).map((p) => p.text ?? '').join('\n');
        return { image: imgPart.inlineData.data, text: textParts };
      });
    };

    const result = await callWithFallback(
      makePhase2Call(MODEL_IMAGE_GEN),
      makePhase2Call(MODEL_IMAGE_GEN_FB)
    );

    generatedPlanImageBase64 = result.image;
    resultPanel = extractResultPanel(result.text);

    if (/SITE[_\s]AUTHORITY[_\s]WARNING|site authority warning/i.test(result.text)) {
      siteAuthorityWarning = true;
    }
    if (/SCALE[_\s]MISMATCH[_\s]WARNING|scale mismatch warning/i.test(result.text)) {
      scaleMismatchWarning = true;
    }

    console.log('[SKETCH-TO-PLAN] Phase 2 complete', {
      duration_ms:             Date.now() - phase2Start,
      model:                   phase2ModelUsed,
      image_kb:                Math.round(Buffer.from(generatedPlanImageBase64, 'base64').length / 1024),
      site_authority_warning:  siteAuthorityWarning,
      scale_mismatch_warning:  scaleMismatchWarning,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Phase 2 (Synthesis) failed:', msg);
    return NextResponse.json({ error: `Plan generation failed: ${msg}` }, { status: 503 });
  }

  console.log('[SKETCH-TO-PLAN] ✓ Done', { total_ms: Date.now() - requestStart });

  return NextResponse.json({
    generated_plan_image:    generatedPlanImageBase64,
    result_panel:            resultPanel,
    orchestration_log:       orchestrationLog,
    site_authority_warning:  siteAuthorityWarning,
    scale_mismatch_warning:  scaleMismatchWarning,
  });
}
