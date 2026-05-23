import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./_shared/env";
import { error, json } from "./_shared/response";

export default async (req: Request) => {
  try {
    if (req.method !== "GET") return error("Method not allowed", 405);
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json([]);
    const db = createClient(url, key);
    const { data, error: dbError } = await db.from("mini_writer_feedback_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (dbError) throw dbError;
    return json(data);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/feedback-log",
};
