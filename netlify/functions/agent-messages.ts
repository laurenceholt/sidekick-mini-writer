import type { Config } from "@netlify/functions";
import { listAgentMessages } from "./_shared/db";
import { error, json } from "./_shared/response";

export default async (req: Request) => {
  try {
    if (req.method !== "GET") return error("Method not allowed", 405);
    const kcId = new URL(req.url).searchParams.get("kcId");
    if (!kcId) return error("kcId is required", 400);
    return json(await listAgentMessages(kcId));
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/agent-messages",
};
