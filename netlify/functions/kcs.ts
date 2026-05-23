import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getKc, insertKc, listKcs, updateKc } from "./_shared/db";
import { fallbackKc } from "./_shared/localAi";
import { error, json } from "./_shared/response";
import type { KnowledgeComponent } from "./_shared/types";

export default async (req: Request, context: Context) => {
  try {
    const id = context.params.id;
    if (req.method === "GET") {
      if (id) {
        const kc = await getKc(id);
        return kc ? json(kc) : error("KC not found", 404);
      }
      return json(await listKcs());
    }
    if (req.method === "POST") {
      const body = (await req.json()) as Record<string, any>;
      const created = await insertKc(body);
      return json(created, { status: 201 });
    }
    if (req.method === "PATCH" && id) {
      const body = (await req.json()) as KnowledgeComponent;
      return json(await updateKc({ ...body, id }));
    }
    return error("Method not allowed", 405);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/kcs", "/api/kcs/:id"],
};

export async function generateKcFromTitle(title: string) {
  const fallback = fallbackKc(title);
  return askAnthropicForJson(
    "You generate concise math knowledge components for grades 3-8. Return only valid JSON.",
    `Create a knowledge component for this title: ${title}

Use this JSON shape:
{
  "title": string,
  "slug": string,
  "grade": number,
  "unit": number,
  "lesson": number,
  "condition": string,
  "response": string,
  "worked_example_md": string,
  "standards": [{"code": string, "label": string, "description": string}],
  "notes_md": string
}

Use markdown and LaTeX delimiters with backticks for inline math text.`,
    fallback,
  );
}
