import type { Config } from "@netlify/functions";
import { listWriters } from "./_shared/db";
import { error, json } from "./_shared/response";

export default async (req: Request) => {
  try {
    if (req.method !== "GET") return error("Method not allowed", 405);
    return json(await listWriters());
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/writers",
};
