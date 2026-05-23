import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

export async function askAnthropicForJson<T>(system: string, prompt: string, fallback: T): Promise<T> {
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return fallback;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: getEnv("ANTHROPIC_MODEL") ?? "claude-opus-4-7",
    max_tokens: 4000,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(jsonText) as T;
}
