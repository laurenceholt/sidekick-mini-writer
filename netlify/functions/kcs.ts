import type { Config, Context } from "@netlify/functions";
import { askAnthropicForJson } from "./_shared/ai";
import { getKc, insertKc, listKcs, softDeleteKc, updateKc } from "./_shared/db";
import { MINI_LESSON_SKILL } from "./_shared/miniLessonSkill";
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
      const url = new URL(req.url);
      return json(await listKcs(url.searchParams.get("writer") ?? undefined));
    }
    if (req.method === "POST") {
      const body = (await req.json()) as Record<string, any>;
      const created = await insertKc(body, body.writerName);
      return json(created, { status: 201 });
    }
    if (req.method === "PATCH" && id) {
      const body = (await req.json()) as KnowledgeComponent;
      return json(await updateKc({ ...body, id }));
    }
    if (req.method === "DELETE" && id) {
      await softDeleteKc(id);
      return json({ ok: true });
    }
    return error("Method not allowed", 405);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/kcs", "/api/kcs/:id"],
};

export async function generateKcFromConditionResponse(input: { condition: string; response: string; grade: number; topic: number; kcNumber: number }) {
  return askAnthropicForJson<KnowledgeComponent>(
    `You generate concise math knowledge components for grades 3-8. Return only valid JSON.

Use this lesson-writing guidance when choosing examples and standards:
${MINI_LESSON_SKILL}`,
    `Create a knowledge component from this condition/response.

Grade: ${input.grade}
Topic: ${input.topic}
KC number: ${input.kcNumber}
Condition: ${input.condition}
Response: ${input.response}

Generate a short precise title and slug. Keep the condition and response semantically the same, but you may lightly clean wording.

Use this JSON shape:
{
  "title": string,
  "slug": string,
  "grade": number,
  "topic": number,
  "kcNumber": number,
  "condition": string,
  "response": string,
  "worked_example_md": string,
  "standards": [{"code": string, "label": string, "description": string}],
  "notes_md": string
}

Use short CCSS standard codes such as 6.EE.A.2. Do not include the CCSS.MATH.CONTENT. prefix.
Use plain text math such as 0.4 x 15 = 6. Do not use math markup delimiters.`,
  );
}
