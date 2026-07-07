import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getClient, MODEL } from "./anthropic";

/**
 * LLM 프로바이더 추상화.
 * - ANTHROPIC_API_KEY가 있으면 Claude (품질 우선)
 * - 없으면 Ollama 로컬 모델 (비용 제로, 데이터 로컬 유지)
 * 두 경로 모두 JSON 스키마 강제 출력을 사용한다.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

export function llmProviderInfo(): string {
  return process.env.ANTHROPIC_API_KEY
    ? `Claude (${MODEL})`
    : `Ollama (${OLLAMA_MODEL})`;
}

export async function generateStructured<S extends z.ZodType>(args: {
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
}): Promise<z.infer<S>> {
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(args);
  }
  return generateWithOllama(args);
}

async function generateWithClaude<S extends z.ZodType>({
  system,
  user,
  schema,
  maxTokens,
}: {
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
}): Promise<z.infer<S>> {
  const client = getClient();
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(schema) },
  });
  if (!res.parsed_output) throw new Error("Claude 응답 파싱 실패");
  return res.parsed_output;
}

async function generateWithOllama<S extends z.ZodType>({
  system,
  user,
  schema,
  maxTokens,
}: {
  system: string;
  user: string;
  schema: S;
  maxTokens: number;
}): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 로컬 모델은 느릴 수 있으니 넉넉하게 15분
      signal: AbortSignal.timeout(15 * 60_000),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // JSON 스키마 강제 (구조화 출력) — 문법 제약 디코딩이라 항상 유효한 JSON
        format: z.toJSONSchema(schema),
        options: {
          num_ctx: 16384, // 공고 원문 + 경험 카드가 길 수 있어 컨텍스트 확장
          num_predict: maxTokens,
          temperature: 0.3,
        },
      }),
    });
  } catch (e) {
    throw new Error(
      `Ollama(${OLLAMA_BASE_URL})에 연결할 수 없습니다. \`brew services start ollama\`로 서버를 켜주세요. (${e instanceof Error ? e.message : e})`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    if (body.includes("not found")) {
      throw new Error(
        `Ollama에 ${OLLAMA_MODEL} 모델이 없습니다. \`ollama pull ${OLLAMA_MODEL}\`로 받아주세요.`
      );
    }
    throw new Error(`Ollama 오류 (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Ollama 응답이 비어 있습니다.");

  try {
    return schema.parse(JSON.parse(content));
  } catch (e) {
    throw new Error(
      `로컬 모델의 출력이 스키마에 맞지 않습니다. 다시 시도하거나 더 큰 모델을 사용해보세요. (${e instanceof Error ? e.message.slice(0, 200) : e})`
    );
  }
}
