import type { Config, Context } from "@netlify/functions";
import { getMini } from "./_shared/db";
import { evaluateMini } from "./_shared/evaluateMini";
import { error, json } from "./_shared/response";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const id = context.params.id;
    if (!id) return error("Mini id is required", 400);
    const mini = await getMini(id);
    if (!mini) return error("Mini not found", 404);
    return json(await evaluateMini(mini));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/:id/eval",
};
