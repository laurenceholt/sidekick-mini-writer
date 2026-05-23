import type { Config, Context } from "@netlify/functions";
import { getMini, listMinis, updateMini } from "./_shared/db";
import { error, json } from "./_shared/response";
import type { Mini } from "./_shared/types";

export default async (req: Request, context: Context) => {
  try {
    const id = context.params.id;
    if (req.method === "GET") {
      const url = new URL(req.url);
      const kcId = url.searchParams.get("kcId");
      if (kcId) return json(await listMinis(kcId));
      if (id) {
        const mini = await getMini(id);
        return mini ? json(mini) : error("Mini not found", 404);
      }
      return error("kcId is required", 400);
    }
    if (req.method === "PATCH" && id) {
      const body = (await req.json()) as Mini;
      return json(await updateMini({ ...body, id }));
    }
    return error("Method not allowed", 405);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: ["/api/minis", "/api/minis/:id"],
};
