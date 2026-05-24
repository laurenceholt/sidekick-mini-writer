import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./env";

type AskOptions = {
  enableWebSearch?: boolean;
};

export async function askAnthropicForJson<T>(system: string, prompt: string, options: AskOptions = {}): Promise<T> {
  const text = await askAnthropicForText(system, prompt, options);
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(jsonText) as T;
}

export async function askAnthropicForText(system: string, prompt: string, options: AskOptions = {}): Promise<string> {
  const apiKey = getEnv("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Claude is not configured. Add ANTHROPIC_API_KEY in Netlify.");

  const client = new Anthropic({ apiKey });
  const webSearchTools =
    options.enableWebSearch && getEnv("ANTHROPIC_ENABLE_WEB_SEARCH") === "true"
      ? [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ]
      : undefined;
  const createMessage = (tools?: typeof webSearchTools) =>
    client.messages.create({
      model: getEnv("ANTHROPIC_MODEL") ?? "claude-opus-4-7",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
      ...(tools ? { tools } : {}),
    } as any);
  const streamMessage = (tools: typeof webSearchTools) =>
    client.messages
      .stream({
        model: getEnv("ANTHROPIC_MODEL") ?? "claude-opus-4-7",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: prompt }],
        ...(tools ? { tools } : {}),
      } as any)
      .finalMessage();

  let response: Awaited<ReturnType<typeof createMessage>>;
  try {
    response = webSearchTools ? await streamMessage(webSearchTools) : await createMessage();
  } catch (error) {
    if (!webSearchTools) throw error;
    response = await createMessage();
  }

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
