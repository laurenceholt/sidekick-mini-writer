import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import { seedKc, seedMini } from "./seed";
import type { KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

const TABLES = {
  writers: "mini_writer_writers",
  kcs: "mini_writer_kcs",
  minis: "mini_writer_minis",
  versions: "mini_writer_mini_versions",
  feedback: "mini_writer_feedback_log",
} as const;

const MANUAL_VERSION_WINDOW_MS = 60_000;
export const DEFAULT_WRITER = "Laurence";
const LEGACY_WRITER_MARKER = /^<!--\s*mini-writer-writer:[^>]+?-->\s*/;

function cleanWriterName(value?: string | null) {
  const name = value?.trim();
  return name || DEFAULT_WRITER;
}

function stripLegacyWriterMarker(notes?: string | null) {
  return (notes ?? "").replace(LEGACY_WRITER_MARKER, "");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "kc";
}

function isMissingWriterSchema(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return message.includes(TABLES.writers) || message.includes("writer_id") || message.includes("PGRST200") || message.includes("42P01") || message.includes("42703");
}

function client() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY") ?? getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

export function toKc(row: Record<string, any>, writerName = DEFAULT_WRITER): KnowledgeComponent {
  return {
    id: row.id,
    writerName: row.writer_name ?? row.writer?.name ?? writerName,
    title: row.title,
    slug: row.slug,
    grade: row.grade,
    unit: row.unit,
    lesson: row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: row.standards ?? [],
    notesMd: stripLegacyWriterMarker(row.notes_md),
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
    notes_md: stripLegacyWriterMarker(kc.notesMd),
  };
}

export async function listKcs(writerName = DEFAULT_WRITER) {
  const db = client();
  const writer = cleanWriterName(writerName);
  if (!db) return writer === DEFAULT_WRITER ? [seedKc] : [];
  const writerRow = await getWriterByName(writer);
  if (writerRow) {
    const { data, error } = await db.from(TABLES.kcs).select("*").eq("writer_id", writerRow.id).order("updated_at", { ascending: false });
    if (error) {
      if (!isMissingWriterSchema(error)) throw error;
    } else {
      if (!data.length && writer === DEFAULT_WRITER) return [await ensureSeedData(db)];
      return data.map((row) => toKc(row, writer));
    }
  } else if (await writerSchemaExists()) {
    return [];
  }
  if (writer !== DEFAULT_WRITER) return [];
  const { data, error } = await db.from(TABLES.kcs).select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  if (!data.length && writer === DEFAULT_WRITER) return [await ensureSeedData(db)];
  return data.map((row) => toKc(row, writer));
}

export async function listWriters() {
  const db = client();
  if (!db) return [DEFAULT_WRITER];
  const { data, error } = await db.from(TABLES.writers).select("name").order("name");
  if (error) {
    if (!isMissingWriterSchema(error)) throw error;
    return [DEFAULT_WRITER];
  }
  const writers = new Set((data ?? []).map((row) => cleanWriterName(row.name)));
  writers.add(DEFAULT_WRITER);
  return [...writers].sort((a, b) => a.localeCompare(b));
}

async function writerSchemaExists() {
  const db = client();
  if (!db) return false;
  const { error } = await db.from(TABLES.writers).select("id", { head: true }).limit(1);
  return !error;
}

async function getWriterByName(name: string) {
  const db = client();
  if (!db) return null;
  const { data, error } = await db.from(TABLES.writers).select("*").eq("name", cleanWriterName(name)).maybeSingle();
  if (error) {
    if (isMissingWriterSchema(error)) return null;
    throw error;
  }
  return data;
}

async function ensureWriter(name: string) {
  const db = client();
  if (!db) return null;
  const clean = cleanWriterName(name);
  const existing = await getWriterByName(clean);
  if (existing) return existing;
  const { data, error } = await db.from(TABLES.writers).insert({ name: clean }).select("*").single();
  if (error) {
    if (isMissingWriterSchema(error)) return null;
    throw error;
  }
  return data;
}

export async function getKc(id: string) {
  const db = client();
  if (!db) return id === seedKc.id ? seedKc : null;
  const { data, error } = await db.from(TABLES.kcs).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data && id === seedKc.id) return ensureSeedData(db);
  if (!data) return null;
  const writerName = data.writer_id ? (await getWriterNameById(data.writer_id)) : DEFAULT_WRITER;
  return toKc(data, writerName);
}

async function getWriterNameById(id: string) {
  const db = client();
  if (!db) return DEFAULT_WRITER;
  const { data, error } = await db.from(TABLES.writers).select("name").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingWriterSchema(error)) return DEFAULT_WRITER;
    throw error;
  }
  return cleanWriterName(data?.name);
}

export async function insertKc(data: Record<string, any>, writerName = DEFAULT_WRITER) {
  const db = client();
  const writer = cleanWriterName(writerName);
  const writerRow = await ensureWriter(writer);
  const row: Record<string, any> = { ...data, writer_id: writerRow?.id, notes_md: stripLegacyWriterMarker(data.notes_md), writerName: undefined };
  if (!db) return { ...seedKc, ...toKcLike(row), writerName: writer, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const baseSlug = slugify(row.slug ?? row.title ?? "kc");
  const { data: existingSlug, error: slugError } = await db.from(TABLES.kcs).select("id").eq("slug", baseSlug).maybeSingle();
  if (slugError) throw slugError;
  const insertRow: Record<string, any> = { ...row, slug: existingSlug ? `${baseSlug}_${crypto.randomUUID().slice(0, 8)}` : baseSlug };
  delete insertRow.writerName;
  if (!insertRow.writer_id) delete insertRow.writer_id;
  const { data: inserted, error } = await db.from(TABLES.kcs).insert(insertRow).select("*").single();
  if (error) throw error;
  return toKc(inserted, writer);
}

function toKcLike(row: Record<string, any>) {
  return {
    writerName: row.writerName ?? DEFAULT_WRITER,
    title: row.title,
    slug: row.slug,
    grade: row.grade,
    unit: row.unit,
    lesson: row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: row.standards ?? [],
    notesMd: stripLegacyWriterMarker(row.notes_md),
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
  if (!minis.length) return [];
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
  const version = await saveManualVersion(mini.id, mini.steps);
  await db.from(TABLES.minis).update({ current_version_id: version.id }).eq("id", mini.id);
  const versions = await listVersionsForMini(mini.id);
  return toMini({ ...data, current_version_id: version.id }, versions);
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

async function listVersionsForMini(miniId: string) {
  const db = client();
  if (!db) return [];
  const { data, error } = await db.from(TABLES.versions).select("*").eq("mini_id", miniId).order("version_number");
  if (error) throw error;
  return (data ?? []).map(toVersion);
}

async function saveManualVersion(miniId: string, steps: MiniStep[]) {
  const db = client();
  if (!db) return createVersion(miniId, steps, "manual", "Manual edit autosave.");
  const { data: latest, error: latestError } = await db
    .from(TABLES.versions)
    .select("*")
    .eq("mini_id", miniId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (latest?.source === "manual" && Date.now() - new Date(latest.created_at).getTime() < MANUAL_VERSION_WINDOW_MS) {
    const { data, error } = await db
      .from(TABLES.versions)
      .update({ steps, summary: "Manual edit autosave." })
      .eq("id", latest.id)
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }
  return createVersion(miniId, steps, "manual", "Manual edit autosave.");
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
  const writerRow = await ensureWriter(seedKc.writerName);
  const { data: existing, error: existingError } = await db.from(TABLES.kcs).select("*").eq("id", seedKc.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return toKc(existing);

  const seedRow = {
    id: seedKc.id,
    writer_id: writerRow?.id,
    title: seedKc.title,
    slug: seedKc.slug,
    grade: seedKc.grade,
    unit: seedKc.unit,
    lesson: seedKc.lesson,
    condition: seedKc.condition,
    response: seedKc.response,
    worked_example_md: seedKc.workedExampleMd,
    standards: seedKc.standards,
    notes_md: stripLegacyWriterMarker(seedKc.notesMd),
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
