import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import { seedKc, seedMini } from "./seed";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

const TABLES = {
  kcs: "mini_writer_kcs",
  minis: "mini_writer_minis",
  versions: "mini_writer_mini_versions",
  feedback: "mini_writer_feedback_log",
} as const;

function client() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

export function toKc(row: Record<string, any>): KnowledgeComponent {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    grade: row.grade,
    unit: row.unit,
    lesson: row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: row.standards ?? [],
    notesMd: row.notes_md ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function kcRow(kc: Partial<KnowledgeComponent>) {
  return {
    title: kc.title,
    slug: kc.slug,
    grade: kc.grade,
    unit: kc.unit,
    lesson: kc.lesson,
    condition: kc.condition,
    response: kc.response,
    worked_example_md: kc.workedExampleMd,
    standards: kc.standards,
    notes_md: kc.notesMd,
  };
}

export async function listKcs() {
  const db = client();
  if (!db) return [seedKc];
  const { data, error } = await db.from(TABLES.kcs).select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  if (data.length) return data.map(toKc);
  return [await ensureSeedData(db)];
}

export async function getKc(id: string) {
  const db = client();
  if (!db) return id === seedKc.id ? seedKc : null;
  const { data, error } = await db.from(TABLES.kcs).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data && id === seedKc.id) return ensureSeedData(db);
  if (!data) return null;
  return toKc(data);
}

export async function insertKc(data: Record<string, any>) {
  const db = client();
  if (!db) return { ...seedKc, ...toKcLike(data), id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const { data: inserted, error } = await db.from(TABLES.kcs).insert(data).select("*").single();
  if (error) throw error;
  return toKc(inserted);
}

function toKcLike(row: Record<string, any>) {
  return {
    title: row.title,
    slug: row.slug,
    grade: row.grade,
    unit: row.unit,
    lesson: row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: row.standards ?? [],
    notesMd: row.notes_md ?? "",
  };
}

export async function updateKc(kc: KnowledgeComponent) {
  const db = client();
  if (!db) return kc;
  const { data, error } = await db.from(TABLES.kcs).update(kcRow(kc)).eq("id", kc.id).select("*").single();
  if (error) throw error;
  return toKc(data);
}

function toVersion(row: Record<string, any>): MiniVersion {
  return {
    id: row.id,
    miniId: row.mini_id,
    versionNumber: row.version_number,
    source: row.source,
    summary: row.summary,
    steps: row.steps ?? [],
    createdAt: row.created_at,
  };
}

function toMini(row: Record<string, any>, versions: MiniVersion[]): Mini {
  const current = versions.find((version) => version.id === row.current_version_id) ?? versions.at(-1);
  return {
    id: row.id,
    kcId: row.kc_id,
    miniIndex: row.mini_index,
    title: row.title,
    currentVersionId: row.current_version_id,
    steps: current?.steps ?? [],
    versions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMinis(kcId: string) {
  const db = client();
  if (!db) return kcId === seedKc.id ? [seedMini] : [];
  const { data: minis, error } = await db.from(TABLES.minis).select("*").eq("kc_id", kcId).order("mini_index");
  if (error) throw error;
  if (!minis.length && kcId === seedKc.id) {
    await ensureSeedData(db);
    return [seedMini];
  }
  const miniIds = minis.map((mini) => mini.id);
  const { data: versions, error: versionError } = await db.from(TABLES.versions).select("*").in("mini_id", miniIds).order("version_number");
  if (versionError) throw versionError;
  return minis.map((mini) => toMini(mini, (versions ?? []).filter((version) => version.mini_id === mini.id).map(toVersion)));
}

export async function getMini(id: string) {
  const db = client();
  if (!db) return id === seedMini.id ? seedMini : null;
  const { data: mini, error } = await db.from(TABLES.minis).select("*").eq("id", id).single();
  if (error) throw error;
  const { data: versions, error: versionError } = await db.from(TABLES.versions).select("*").eq("mini_id", id).order("version_number");
  if (versionError) throw versionError;
  return toMini(mini, (versions ?? []).map(toVersion));
}

export async function createMini(kc: KnowledgeComponent, miniIndex: number, title: string, steps: MiniStep[], source = "generate", summary = "Generated mini.") {
  const db = client();
  if (!db) {
    const miniId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    return {
      id: miniId,
      kcId: kc.id,
      miniIndex,
      title,
      currentVersionId: versionId,
      steps,
      versions: [{ id: versionId, miniId, versionNumber: 1, source: source as any, summary, steps, createdAt }],
      createdAt,
      updatedAt: createdAt,
    } satisfies Mini;
  }
  const { data: mini, error } = await db
    .from(TABLES.minis)
    .insert({ kc_id: kc.id, mini_index: miniIndex, title })
    .select("*")
    .single();
  if (error) throw error;
  const version = await createVersion(mini.id, steps, source, summary);
  const { data: updated, error: updateError } = await db
    .from(TABLES.minis)
    .update({ current_version_id: version.id })
    .eq("id", mini.id)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return toMini(updated, [version]);
}

export async function updateMini(mini: Mini) {
  const db = client();
  if (!db) return mini;
  const { data, error } = await db.from(TABLES.minis).update({ title: mini.title }).eq("id", mini.id).select("*").single();
  if (error) throw error;
  const version = await createVersion(mini.id, mini.steps, "manual", "Manual edit autosave.");
  await db.from(TABLES.minis).update({ current_version_id: version.id }).eq("id", mini.id);
  return toMini({ ...data, current_version_id: version.id }, [...mini.versions, version]);
}

export async function createVersion(miniId: string, steps: MiniStep[], source: string, summary: string) {
  const db = client();
  if (!db) {
    return {
      id: crypto.randomUUID(),
      miniId,
      versionNumber: 1,
      source: source as any,
      summary,
      steps,
      createdAt: new Date().toISOString(),
    } satisfies MiniVersion;
  }
  const { count } = await db.from(TABLES.versions).select("*", { count: "exact", head: true }).eq("mini_id", miniId);
  const { data, error } = await db
    .from(TABLES.versions)
    .insert({ mini_id: miniId, version_number: (count ?? 0) + 1, source, summary, steps })
    .select("*")
    .single();
  if (error) throw error;
  return toVersion(data);
}

export async function replaceMiniSteps(mini: Mini, steps: MiniStep[], source: string, summary: string) {
  const db = client();
  if (!db) {
    const version = await createVersion(mini.id, steps, source, summary);
    return { ...mini, steps, currentVersionId: version.id, versions: [...mini.versions, version], updatedAt: version.createdAt };
  }
  const version = await createVersion(mini.id, steps, source, summary);
  const { data, error } = await db.from(TABLES.minis).update({ current_version_id: version.id }).eq("id", mini.id).select("*").single();
  if (error) throw error;
  return toMini(data, [...mini.versions, version]);
}

export async function logFeedback(entry: Record<string, any>) {
  const db = client();
  if (!db) return;
  await db.from(TABLES.feedback).insert(entry);
}

async function ensureSeedData(db: SupabaseClient<any>) {
  const { data: existing, error: existingError } = await db.from(TABLES.kcs).select("*").eq("id", seedKc.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return toKc(existing);

  const seedRow = {
    id: seedKc.id,
    title: seedKc.title,
    slug: seedKc.slug,
    grade: seedKc.grade,
    unit: seedKc.unit,
    lesson: seedKc.lesson,
    condition: seedKc.condition,
    response: seedKc.response,
    worked_example_md: seedKc.workedExampleMd,
    standards: seedKc.standards,
    notes_md: seedKc.notesMd,
  };
  const { data: inserted, error: insertError } = await db.from(TABLES.kcs).insert(seedRow).select("*").single();
  if (insertError) throw insertError;

  const { data: mini, error: miniError } = await db
    .from(TABLES.minis)
    .insert({ id: seedMini.id, kc_id: seedKc.id, mini_index: seedMini.miniIndex, title: seedMini.title })
    .select("*")
    .single();
  if (miniError) throw miniError;

  const version = seedMini.versions[0];
  const { data: insertedVersion, error: versionError } = await db
    .from(TABLES.versions)
    .insert({
      id: version.id,
      mini_id: mini.id,
      version_number: version.versionNumber,
      source: version.source,
      summary: version.summary,
      steps: version.steps,
    })
    .select("*")
    .single();
  if (versionError) throw versionError;

  await db.from(TABLES.minis).update({ current_version_id: insertedVersion.id }).eq("id", mini.id);
  return toKc(inserted);
}
