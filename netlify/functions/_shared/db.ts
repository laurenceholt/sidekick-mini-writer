import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import { seedKc, seedMini } from "./seed";
import type { AgentMessage, KnowledgeComponent, Mini, MiniStep, MiniVersion } from "./types";

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

function normalizeStandardCode(code: string) {
  return code.replace(/^CCSS\.MATH\.CONTENT\./i, "");
}

function normalizeStandards(standards: any[] = []) {
  return standards.map((standard) => ({
    ...standard,
    code: normalizeStandardCode(String(standard.code ?? "")),
  }));
}

function isMissingWriterSchema(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return message.includes(TABLES.writers) || message.includes("writer_id") || message.includes("PGRST200") || message.includes("42P01") || message.includes("42703");
}

function isMissingStatusSchema(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return message.includes("status") || message.includes("42703") || message.includes("PGRST204");
}

function isMissingTopicSchema(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return message.includes("topic") || message.includes("kc_number") || message.includes("PGRST204") || message.includes("42703");
}

function isMissingDeletedSchema(error: any) {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return message.includes("deleted_at") || message.includes("PGRST204") || message.includes("42703");
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
    topic: row.topic ?? row.unit,
    kcNumber: row.kc_number ?? row.kcNumber ?? row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: normalizeStandards(row.standards ?? []),
    notesMd: stripLegacyWriterMarker(row.notes_md),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function kcRow(kc: Partial<KnowledgeComponent>) {
  return {
    title: kc.title,
    slug: kc.slug,
    grade: kc.grade,
    topic: kc.topic,
    kc_number: kc.kcNumber,
    condition: kc.condition,
    response: kc.response,
    worked_example_md: kc.workedExampleMd,
    standards: normalizeStandards(kc.standards),
    notes_md: stripLegacyWriterMarker(kc.notesMd),
  };
}

function legacyKcRow(kc: Partial<KnowledgeComponent>) {
  const row = kcRow(kc) as Record<string, any>;
  row.unit = row.topic;
  row.lesson = row.kc_number;
  delete row.topic;
  delete row.kc_number;
  return row;
}

function normalizeIncomingKcRow(data: Record<string, any>) {
  const row = { ...data };
  row.topic = row.topic ?? row.unit ?? 6;
  row.kc_number = row.kc_number ?? row.kcNumber ?? row.lesson ?? 1;
  row.notes_md = stripLegacyWriterMarker(row.notes_md ?? row.notesMd);
  row.worked_example_md = row.worked_example_md ?? row.workedExampleMd;
  delete row.unit;
  delete row.lesson;
  delete row.kcNumber;
  delete row.notesMd;
  delete row.workedExampleMd;
  return row;
}

async function runActiveKcQuery(db: SupabaseClient<any>, build: (query: any) => any) {
  let result = await build(db.from(TABLES.kcs).select("*").is("deleted_at", null));
  if (result.error && isMissingDeletedSchema(result.error)) {
    result = await build(db.from(TABLES.kcs).select("*"));
  }
  return result;
}

async function anyKcsExist(db: SupabaseClient<any>) {
  const { count, error } = await db.from(TABLES.kcs).select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listKcs(writerName = DEFAULT_WRITER) {
  const db = client();
  const writer = cleanWriterName(writerName);
  if (!db) return writer === DEFAULT_WRITER ? [seedKc] : [];
  if (writer === DEFAULT_WRITER) {
    const { data, error } = await runActiveKcQuery(db, (query) => query.order("updated_at", { ascending: false }));
    if (error) throw error;
    if (data.length) return data.map((row: Record<string, any>) => toKc(row, DEFAULT_WRITER));
    if (await anyKcsExist(db)) return [];
    return [await ensureSeedData(db)];
  }
  const hasWriterSchema = await writerSchemaExists();
  const writerRow = hasWriterSchema ? await ensureWriter(writer) : null;
  if (hasWriterSchema && writerRow) {
    const { data, error } = await runActiveKcQuery(db, (query) => query.eq("writer_id", writerRow.id).order("updated_at", { ascending: false }));
    if (error) {
      if (!isMissingWriterSchema(error)) throw error;
    } else {
      if (data.length) return data.map((row: Record<string, any>) => toKc(row, writer));
      if (writer !== DEFAULT_WRITER) return [];
      const { data: legacy, error: legacyError } = await runActiveKcQuery(db, (query) => query.is("writer_id", null).order("updated_at", { ascending: false }));
      if (legacyError) {
        if (!isMissingWriterSchema(legacyError)) throw legacyError;
      } else if (legacy.length) {
        return legacy.map((row: Record<string, any>) => toKc(row, DEFAULT_WRITER));
      }
      const { data: allDefault, error: allDefaultError } = await runActiveKcQuery(db, (query) => query.order("updated_at", { ascending: false }));
      if (allDefaultError) throw allDefaultError;
      if (allDefault.length) return allDefault.map((row: Record<string, any>) => toKc(row, DEFAULT_WRITER));
      if (await anyKcsExist(db)) return [];
      return [await ensureSeedData(db)];
    }
  } else if (hasWriterSchema) {
    return [];
  }
  if (writer !== DEFAULT_WRITER) return [];
  const { data, error } = await runActiveKcQuery(db, (query) => query.order("updated_at", { ascending: false }));
  if (error) throw error;
  if (!data.length && writer === DEFAULT_WRITER) {
    if (await anyKcsExist(db)) return [];
    return [await ensureSeedData(db)];
  }
  return data.map((row: Record<string, any>) => toKc(row, writer));
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
  let { data, error } = await db.from(TABLES.kcs).select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error && isMissingDeletedSchema(error)) {
    const fallback = await db.from(TABLES.kcs).select("*").eq("id", id).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }
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
  const row: Record<string, any> = { ...normalizeIncomingKcRow(data), writer_id: writerRow?.id, writerName: undefined };
  if (!db) return { ...seedKc, ...toKcLike(row), writerName: writer, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const baseSlug = slugify(row.slug ?? row.title ?? "kc");
  const { data: existingSlug, error: slugError } = await db.from(TABLES.kcs).select("id").eq("slug", baseSlug).maybeSingle();
  if (slugError) throw slugError;
  const insertRow: Record<string, any> = { ...row, slug: existingSlug ? `${baseSlug}_${crypto.randomUUID().slice(0, 8)}` : baseSlug };
  delete insertRow.writerName;
  if (!insertRow.writer_id) delete insertRow.writer_id;
  let { data: inserted, error } = await db.from(TABLES.kcs).insert(insertRow).select("*").single();
  if (error) {
    if (!isMissingTopicSchema(error)) throw error;
    const legacyRow: Record<string, any> = { ...insertRow, unit: insertRow.topic, lesson: insertRow.kc_number };
    delete legacyRow.topic;
    delete legacyRow.kc_number;
    const fallback = await db.from(TABLES.kcs).insert(legacyRow).select("*").single();
    if (fallback.error) throw fallback.error;
    inserted = fallback.data;
  }
  return toKc(inserted, writer);
}

function toKcLike(row: Record<string, any>) {
  return {
    writerName: row.writerName ?? DEFAULT_WRITER,
    title: row.title,
    slug: row.slug,
    grade: row.grade,
    topic: row.topic ?? row.unit,
    kcNumber: row.kc_number ?? row.kcNumber ?? row.lesson,
    condition: row.condition,
    response: row.response,
    workedExampleMd: row.worked_example_md,
    standards: normalizeStandards(row.standards ?? []),
    notesMd: stripLegacyWriterMarker(row.notes_md),
    deletedAt: row.deleted_at,
  };
}

export async function updateKc(kc: KnowledgeComponent) {
  const db = client();
  if (!db) return kc;
  let { data, error } = await db.from(TABLES.kcs).update(kcRow(kc)).eq("id", kc.id).select("*").single();
  if (error) {
    if (!isMissingTopicSchema(error)) throw error;
    const fallback = await db.from(TABLES.kcs).update(legacyKcRow(kc)).eq("id", kc.id).select("*").single();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  return toKc(data);
}

export async function softDeleteKc(id: string) {
  const db = client();
  if (!db) return;
  const deletedAt = new Date().toISOString();
  const { data: minis, error: minisError } = await db.from(TABLES.minis).select("id").eq("kc_id", id);
  if (minisError) throw minisError;
  const miniIds = (minis ?? []).map((mini) => mini.id);
  if (miniIds.length) {
    const { error: versionsError } = await db.from(TABLES.versions).update({ deleted_at: deletedAt }).in("mini_id", miniIds);
    if (versionsError && !isMissingDeletedSchema(versionsError)) throw versionsError;
    const { error: minisUpdateError } = await db.from(TABLES.minis).update({ deleted_at: deletedAt }).in("id", miniIds);
    if (minisUpdateError) {
      if (isMissingDeletedSchema(minisUpdateError)) throw new Error("Soft delete needs the deleted_at Supabase migration to be run first.");
      throw minisUpdateError;
    }
  }
  const { error: kcError } = await db.from(TABLES.kcs).update({ deleted_at: deletedAt }).eq("id", id);
  if (kcError) {
    if (isMissingDeletedSchema(kcError)) throw new Error("Soft delete needs the deleted_at Supabase migration to be run first.");
    throw kcError;
  }
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
    status: row.status ?? "writing",
    currentVersionId: row.current_version_id,
    steps: current?.steps ?? [],
    versions,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function runActiveMiniQuery(db: SupabaseClient<any>, build: (query: any) => any) {
  let result = await build(db.from(TABLES.minis).select("*").is("deleted_at", null));
  if (result.error && isMissingDeletedSchema(result.error)) {
    result = await build(db.from(TABLES.minis).select("*"));
  }
  return result;
}

async function runActiveVersionQuery(db: SupabaseClient<any>, build: (query: any) => any) {
  let result = await build(db.from(TABLES.versions).select("*").is("deleted_at", null));
  if (result.error && isMissingDeletedSchema(result.error)) {
    result = await build(db.from(TABLES.versions).select("*"));
  }
  return result;
}

export async function listMinis(kcId: string) {
  const db = client();
  if (!db) return kcId === seedKc.id ? [seedMini] : [];
  const { data: minis, error } = await runActiveMiniQuery(db, (query) => query.eq("kc_id", kcId).order("mini_index"));
  if (error) throw error;
  if (!minis.length && kcId === seedKc.id) {
    await ensureSeedData(db);
    return [seedMini];
  }
  if (!minis.length) return [];
  const miniIds = minis.map((mini: Record<string, any>) => mini.id);
  const { data: versions, error: versionError } = await runActiveVersionQuery(db, (query) => query.in("mini_id", miniIds).order("version_number"));
  if (versionError) throw versionError;
  return minis.map((mini: Record<string, any>) => toMini(mini, (versions ?? []).filter((version: Record<string, any>) => version.mini_id === mini.id).map(toVersion)));
}

export async function getMini(id: string) {
  const db = client();
  if (!db) return id === seedMini.id ? seedMini : null;
  let { data: mini, error } = await db.from(TABLES.minis).select("*").eq("id", id).is("deleted_at", null).single();
  if (error && isMissingDeletedSchema(error)) {
    const fallback = await db.from(TABLES.minis).select("*").eq("id", id).single();
    mini = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  const { data: versions, error: versionError } = await runActiveVersionQuery(db, (query) => query.eq("mini_id", id).order("version_number"));
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
      status: "writing",
      currentVersionId: versionId,
      steps,
      versions: [{ id: versionId, miniId, versionNumber: 1, source: source as any, summary, steps, createdAt }],
      createdAt,
      updatedAt: createdAt,
    } satisfies Mini;
  }
  const { data: mini, error } = await db
    .from(TABLES.minis)
    .insert({ kc_id: kc.id, mini_index: miniIndex, title, status: "writing" })
    .select("*")
    .single();
  if (error) {
    if (!isMissingStatusSchema(error)) throw error;
    const fallback = await db.from(TABLES.minis).insert({ kc_id: kc.id, mini_index: miniIndex, title }).select("*").single();
    if (fallback.error) throw fallback.error;
    const version = await createVersion(fallback.data.id, steps, source, summary);
    const { data: updated, error: updateError } = await db
      .from(TABLES.minis)
      .update({ current_version_id: version.id })
      .eq("id", fallback.data.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return toMini(updated, [version]);
  }
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
  const current = await getMini(mini.id);
  const stepsChanged = JSON.stringify(current?.steps ?? []) !== JSON.stringify(mini.steps ?? []);
  const row = { title: mini.title, status: mini.status ?? (stepsChanged ? "writing" : current?.status ?? "writing") };
  let { data, error } = await db.from(TABLES.minis).update(row).eq("id", mini.id).select("*").single();
  if (error) {
    if (!isMissingStatusSchema(error)) throw error;
    const fallback = await db.from(TABLES.minis).update({ title: mini.title }).eq("id", mini.id).select("*").single();
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  const version = stepsChanged ? await saveManualVersion(mini.id, mini.steps) : null;
  if (version) await db.from(TABLES.minis).update({ current_version_id: version.id }).eq("id", mini.id);
  const versions = await listVersionsForMini(mini.id);
  return toMini({ ...data, status: row.status, current_version_id: version?.id ?? data.current_version_id }, versions);
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
  const { data, error } = await runActiveVersionQuery(db, (query) => query.eq("mini_id", miniId).order("version_number"));
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
    return { ...mini, status: "writing", steps, currentVersionId: version.id, versions: [...mini.versions, version], updatedAt: version.createdAt };
  }
  const version = await createVersion(mini.id, steps, source, summary);
  let { data, error } = await db.from(TABLES.minis).update({ current_version_id: version.id, status: "writing" }).eq("id", mini.id).select("*").single();
  if (error) {
    if (!isMissingStatusSchema(error)) throw error;
    const fallback = await db.from(TABLES.minis).update({ current_version_id: version.id }).eq("id", mini.id).select("*").single();
    if (fallback.error) throw fallback.error;
    data = { ...fallback.data, status: "writing" };
  }
  return toMini(data, [...mini.versions, version]);
}

export async function logFeedback(entry: Record<string, any>) {
  const db = client();
  if (!db) return;
  const { data } = await db.from(TABLES.feedback).insert(entry).select("*").single();
  return data;
}

export async function updateFeedbackLog(id: string, entry: Record<string, any>) {
  const db = client();
  if (!db) return;
  const { data } = await db.from(TABLES.feedback).update(entry).eq("id", id).select("*").single();
  return data;
}

export async function findFeedbackByRequestId(miniId: string, requestId: string) {
  const db = client();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLES.feedback)
    .select("*")
    .eq("mini_id", miniId)
    .filter("payload->>requestId", "eq", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findFeedbackByKcRequestId(kcId: string, requestId: string) {
  const db = client();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLES.feedback)
    .select("*")
    .eq("kc_id", kcId)
    .filter("payload->>requestId", "eq", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPendingMiniGenerationByKc(kcId: string) {
  const db = client();
  if (!db) return null;
  const { data, error } = await db
    .from(TABLES.feedback)
    .select("*")
    .eq("kc_id", kcId)
    .eq("event_type", "generate_mini")
    .filter("payload->>status", "eq", "started")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function extractJsonObjects(text: string) {
  const objects: string[] = [];
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        objects.push(text.slice(start, index + 1));
        break;
      }
    }
  }
  return objects.reverse();
}

function cleanLegacyAgentResponse(content: string) {
  if (!content.includes('"updateMini"') || !content.includes('"response"')) return content;
  for (const candidate of extractJsonObjects(content)) {
    try {
      const parsed = JSON.parse(candidate) as { response?: unknown };
      if (typeof parsed.response === "string" && parsed.response.trim()) return parsed.response;
    } catch {
      // Try the next JSON-looking object.
    }
  }
  const extracted = extractLegacyResponseValue(content);
  if (extracted) return extracted;
  const proseStart = content.indexOf("Here's what I found");
  if (proseStart >= 0) return content.slice(proseStart).trim();
  return content;
}

function extractLegacyResponseValue(content: string) {
  const keyIndex = content.lastIndexOf('"response"');
  if (keyIndex < 0) return null;
  const colonIndex = content.indexOf(":", keyIndex);
  const startQuote = content.indexOf('"', colonIndex + 1);
  if (colonIndex < 0 || startQuote < 0) return null;

  let escaped = false;
  for (let index = startQuote + 1; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char !== '"') continue;
    if (!/^\s*,\s*"summary"/.test(content.slice(index + 1))) continue;

    const raw = content.slice(startQuote + 1, index);
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      return raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
    }
  }
  return null;
}

function feedbackToMessages(rows: Record<string, any>[]): AgentMessage[] {
  return rows.flatMap((row) => {
    const createdAt = row.created_at ?? new Date().toISOString();
    const messages: AgentMessage[] = [];
    if (row.writer_input && ["agent_revision", "process_agent_notes"].includes(row.event_type)) {
      messages.push({ id: `${row.id}-writer`, role: "writer", content: row.writer_input, createdAt });
    }
    if (row.agent_response) {
      messages.push({ id: `${row.id}-agent`, role: "agent", content: cleanLegacyAgentResponse(row.agent_response), createdAt });
    }
    return messages;
  });
}

export async function listAgentMessages(kcId: string) {
  const db = client();
  if (!db) return [];
  const { data, error } = await db
    .from(TABLES.feedback)
    .select("*")
    .eq("kc_id", kcId)
    .in("event_type", ["agent_revision", "generate_mini", "process_agent_notes", "mini_eval"])
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return feedbackToMessages(data ?? []);
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
    topic: seedKc.topic,
    kc_number: seedKc.kcNumber,
    condition: seedKc.condition,
    response: seedKc.response,
    worked_example_md: seedKc.workedExampleMd,
    standards: seedKc.standards,
    notes_md: stripLegacyWriterMarker(seedKc.notesMd),
  };
  let { data: inserted, error: insertError } = await db.from(TABLES.kcs).insert(seedRow).select("*").single();
  if (insertError) {
    if (!isMissingTopicSchema(insertError)) throw insertError;
    const legacySeedRow: Record<string, any> = { ...seedRow, unit: seedRow.topic, lesson: seedRow.kc_number };
    delete legacySeedRow.topic;
    delete legacySeedRow.kc_number;
    const fallback = await db.from(TABLES.kcs).insert(legacySeedRow).select("*").single();
    if (fallback.error) throw fallback.error;
    inserted = fallback.data;
  }

  let { data: mini, error: miniError } = await db
    .from(TABLES.minis)
    .insert({ id: seedMini.id, kc_id: seedKc.id, mini_index: seedMini.miniIndex, title: seedMini.title, status: "writing" })
    .select("*")
    .single();
  if (miniError) {
    if (!isMissingStatusSchema(miniError)) throw miniError;
    const fallback = await db
      .from(TABLES.minis)
      .insert({ id: seedMini.id, kc_id: seedKc.id, mini_index: seedMini.miniIndex, title: seedMini.title })
      .select("*")
      .single();
    if (fallback.error) throw fallback.error;
    mini = fallback.data;
  }

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

  const seedMiniUpdate = await db.from(TABLES.minis).update({ current_version_id: insertedVersion.id, status: "writing" }).eq("id", mini.id);
  if (seedMiniUpdate.error && isMissingStatusSchema(seedMiniUpdate.error)) {
    await db.from(TABLES.minis).update({ current_version_id: insertedVersion.id }).eq("id", mini.id);
  } else if (seedMiniUpdate.error) {
    throw seedMiniUpdate.error;
  }
  return toKc(inserted);
}
