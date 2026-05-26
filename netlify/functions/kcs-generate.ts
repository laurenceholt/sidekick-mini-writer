import type { Config } from "@netlify/functions";
import { insertKc } from "./_shared/db";
import { error, json } from "./_shared/response";
import { generateKcFromConditionResponse } from "./kcs";

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const { condition, response, writerName, grade, topic, kcNumber } = (await req.json()) as {
      condition?: string;
      response?: string;
      writerName?: string;
      grade?: number;
      topic?: number;
      kcNumber?: number;
    };
    if (!condition || typeof condition !== "string") return error("Condition is required", 400);
    if (!response || typeof response !== "string") return error("Response is required", 400);
    const forced = {
      condition: condition.trim(),
      response: response.trim(),
      grade: Number(grade) || 6,
      topic: Number(topic) || 1,
      kcNumber: Number(kcNumber) || 1,
    };
    const draft = await generateKcFromConditionResponse(forced);
    return json(await insertKc({
      ...draft,
      ...forced,
    }, writerName), { status: 201 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/generate-kc",
};
