import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY가 없습니다. .env.local에 ANTHROPIC_API_KEY=sk-ant-... 를 추가하고 서버를 재시작하세요."
    );
  }
  if (!client) client = new Anthropic();
  return client;
}
