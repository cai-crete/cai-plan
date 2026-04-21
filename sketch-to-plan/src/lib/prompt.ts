import { readFileSync } from 'fs';
import { join } from 'path';

export function buildSystemPrompt(principleProtocol: string, knowledgeDocs: string[] = []): string {
  const parts = [principleProtocol, ...knowledgeDocs].filter(Boolean);
  return parts.join('\n\n---\n\n');
}

export function loadProtocolFile(filename: string): string {
  const contextDir = join(process.cwd(), '_context');
  return readFileSync(join(contextDir, filename), 'utf-8');
}
