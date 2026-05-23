import type { Config, Context } from "@netlify/functions";
import { getMini, logFeedback, replaceMiniSteps } from "./_shared/db";
import { error, json } from "./_shared/response";

export default async (req: Request, context: Context) => {
  try {
    if (req.method !== "POST") return error("Method not allowed", 405);
    const mini = await getMini(context.params.id);
    if (!mini) return error("Mini not found", 404);
    const { versionId } = (await req.json()) as { versionId?: string };
    const target = mini.versions.find((version) => version.id === versionId);
    if (!target) return error("Version not found", 404);
    const beforeVersionId = mini.currentVersionId;
    const updated = await replaceMiniSteps(mini, target.steps, "revert", `Reverted to version ${target.versionNumber}.`);
    await logFeedback({
      kc_id: mini.kcId,
      mini_id: mini.id,
      before_version_id: beforeVersionId,
      after_version_id: updated.currentVersionId,
      event_type: "revert",
      writer_input: versionId,
      agent_response: `Reverted to version ${target.versionNumber}.`,
    });
    return json(updated);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Unexpected error");
  }
};

export const config: Config = {
  path: "/api/minis/:id/revert",
};
