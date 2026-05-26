import type { Config } from "@netlify/functions";
import { insertKc } from "./_shared/db";
import { error, json } from "./_shared/response";
import { generateKcFromTitle } from "./kcs";

export default async (req: Request) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const { title, writerName, grade, topic, kcNumber } = (await req.json()) as {
      title?: string;
      writerName?: string;
      grade?: number;
      topic?: number;
      kcNumber?: number;
    };
    if (!title || typeof title !== "string") return error("Title is required", 400);
    const draft = await generateKcFromTitle(title);
    return json(await insertKc({
      ...draft,
      grade: Number(grade) || draft.grade,
      topic: Number(topic) || draft.topic,
      kcNumber: Number(kcNumber) || draft.kcNumber,
    }, writerName), { status: 201 });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/generate-kc",
};
