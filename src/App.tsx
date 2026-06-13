import { useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { DeployMarker } from "./components/DeployMarker";
import { KcPanel } from "./components/KcPanel";
import { MiniEditor } from "./components/MiniEditor";
import { MinisWordmark } from "./components/MinisWordmark";
import { api, fetchWorkspace } from "./lib/api";
import { createId } from "./lib/ids";
import { generateMiniForKc } from "./lib/localAgent";
import { loadLocalWorkspace, saveLocalWorkspace } from "./lib/localStore";
import { addVersion, revertMini } from "./lib/versions";
import type { AgentMessage, KnowledgeComponent, Mini, NewKcInput, WorkspaceData } from "./lib/types";

const WRITER_KEY = "mini-writer:selected-writer";
const KC_PANEL_COLLAPSED_KEY = "mini-writer:kc-panel-collapsed";
const EMPTY_WORKSPACE: WorkspaceData = { kcs: [], minis: [] };
const THINKING_LABELS = [
  "Thinking...",
  "Reading the mini...",
  "Checking the skill guidance...",
  "Researching sources...",
  "Drafting a response...",
  "Finding the shape of the lesson...",
  "Looking for a better hook...",
  "Comparing possible revisions...",
  "Checking the grade-level voice...",
  "Reconsidering...",
  "Thinking of something profound...",
  "Making the hints less helpful in the right way...",
  "Looking for the shortest useful wording...",
  "Checking the step arc...",
  "Trying a less boring version...",
  "Sorting the ideas...",
  "Looking for a tiny cartoon moment...",
  "Making sure the math still works...",
  "Reading the writer notes...",
  "Turning the crank...",
  "Looking suspiciously at the equal sign...",
  "Polishing the response...",
];

function addMessage(role: AgentMessage["role"], content: string): AgentMessage {
  return {
    id: createId("message"),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Unexpected error";
}

function readWriterFromUrl() {
  return new URLSearchParams(window.location.search).get("writer");
}

function readKcIdFromUrl() {
  const match = window.location.pathname.match(/^\/kc\/([^/]+)/);
  return match?.[1] ?? null;
}

function readMiniIdFromUrl() {
  return new URLSearchParams(window.location.search).get("mini");
}

function setBrowserKcUrl(writerName: string | null, kcId: string | null, miniId: string | null) {
  const params = new URLSearchParams();
  if (writerName) params.set("writer", writerName);
  if (miniId) params.set("mini", miniId);
  const path = kcId ? `/kc/${kcId}` : "/";
  const query = params.toString();
  window.history.replaceState(null, "", query ? `${path}?${query}` : path);
}

export default function App() {
  const initialWriter = readWriterFromUrl();
  const [workspace, setWorkspace] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [writerName, setWriterName] = useState<string | null>(initialWriter);
  const [writers, setWriters] = useState<string[]>(initialWriter ? [initialWriter] : []);
  const [selectedKcId, setSelectedKcId] = useState<string | null>(initialWriter ? readKcIdFromUrl() : null);
  const [selectedMiniId, setSelectedMiniId] = useState<string | null>(initialWriter ? readMiniIdFromUrl() : null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [agentBusyLabel, setAgentBusyLabel] = useState<string | null>(null);
  const [creatingKc, setCreatingKc] = useState<NewKcInput | null>(null);
  const [kcCreateError, setKcCreateError] = useState<string | null>(null);
  const [generatingMiniKcId, setGeneratingMiniKcId] = useState<string | null>(null);
  const [kcPanelCollapsed, setKcPanelCollapsed] = useState(() => localStorage.getItem(KC_PANEL_COLLAPSED_KEY) === "true");
  const kcSaveTimers = useRef(new Map<string, number>());
  const miniSaveTimers = useRef(new Map<string, number>());
  const messageCache = useRef(new Map<string, AgentMessage[]>());
  const selectedKcIdRef = useRef<string | null>(selectedKcId);
  const initialKcId = useRef(readKcIdFromUrl());
  const generatingMiniRef = useRef<string | null>(null);

  useEffect(() => {
    selectedKcIdRef.current = selectedKcId;
  }, [selectedKcId]);

  useEffect(() => {
    let active = true;
    api.listWriters().then((remoteWriters) => {
      if (!active) return;
      setWriters(remoteWriters.sort((a, b) => a.localeCompare(b)));
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!writerName) {
      localStorage.removeItem(WRITER_KEY);
      setWorkspace(EMPTY_WORKSPACE);
      setSelectedKcId(null);
      setSelectedMiniId(null);
      setMessages([]);
      return () => {
        active = false;
      };
    }
    localStorage.setItem(WRITER_KEY, writerName);
    const local = loadLocalWorkspace(writerName);
    setWorkspace(local);
    const preferredId = initialKcId.current;
    const preferredMiniId = readMiniIdFromUrl();
    const localKcId = (preferredId && local.kcs.some((kc) => kc.id === preferredId) ? preferredId : local.kcs[0]?.id) ?? null;
    setSelectedKcId(localKcId);
    setSelectedMiniId(local.minis.find((mini) => mini.id === preferredMiniId && mini.kcId === localKcId)?.id ?? local.minis.find((mini) => mini.kcId === localKcId)?.id ?? null);

    setWriters((current) => [...new Set([...current, writerName])].sort((a, b) => a.localeCompare(b)));

    fetchWorkspace(writerName).then((remote) => {
      if (!active) return;
      setWorkspace(remote);
      const remoteKcId = (preferredId && remote.kcs.some((kc) => kc.id === preferredId) ? preferredId : remote.kcs[0]?.id) ?? null;
      setSelectedKcId(remoteKcId);
      setSelectedMiniId(remote.minis.find((mini) => mini.id === preferredMiniId && mini.kcId === remoteKcId)?.id ?? remote.minis.find((mini) => mini.kcId === remoteKcId)?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [writerName]);

  useEffect(() => {
    if (!dirty || !writerName) return;
    const timeout = window.setTimeout(() => {
      saveLocalWorkspace(workspace, writerName);
      setDirty(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [dirty, workspace, writerName]);

  useEffect(() => {
    localStorage.setItem(KC_PANEL_COLLAPSED_KEY, String(kcPanelCollapsed));
  }, [kcPanelCollapsed]);

  useEffect(() => {
    if (!agentBusyLabel || !THINKING_LABELS.includes(agentBusyLabel)) return;
    const interval = window.setInterval(() => {
      setAgentBusyLabel((current) => {
        if (!current || !THINKING_LABELS.includes(current)) return current;
        const choices = THINKING_LABELS.filter((label) => label !== current);
        return choices[Math.floor(Math.random() * choices.length)];
      });
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [agentBusyLabel]);

  const selectedKc = workspace.kcs.find((kc) => kc.id === selectedKcId) ?? null;
  const minisForKc = useMemo(
    () => workspace.minis.filter((mini) => mini.kcId === selectedKc?.id).sort((a, b) => a.miniIndex - b.miniIndex),
    [workspace.minis, selectedKc?.id],
  );
  const selectedMini = minisForKc.find((mini) => mini.id === selectedMiniId) ?? minisForKc[0] ?? null;

  useEffect(() => {
    setBrowserKcUrl(writerName, selectedKc?.id ?? null, selectedMini?.id ?? null);
  }, [writerName, selectedKc?.id, selectedMini?.id]);

  useEffect(() => {
    if (!selectedKc?.id) {
      setMessages([]);
      return;
    }
    let active = true;
    const cached = messageCache.current.get(selectedKc.id) ?? [];
    setMessages(cached);
    api.listAgentMessages(selectedKc.id).then((remoteMessages) => {
      if (!active) return;
      messageCache.current.set(selectedKc.id, remoteMessages);
      setMessages(remoteMessages);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedKc?.id, writerName]);

  const appendKcMessage = (role: AgentMessage["role"], content: string, kcId = selectedKc?.id) => {
    if (!kcId) return;
    const message = addMessage(role, content);
    setMessages((current) => {
      const next = [...current, message];
      messageCache.current.set(kcId, next);
      return selectedKcIdRef.current === kcId ? next : current;
    });
  };

  const finishMiniGeneration = async (kcId: string, requestId: string) => {
    if (generatingMiniRef.current === kcId) return;
    generatingMiniRef.current = kcId;
    setGeneratingMiniKcId(kcId);
    setAgentBusyLabel("Generating mini...");
    try {
      const { mini, response } = await api.waitForMiniGeneration(kcId, requestId);
      updateWorkspace((data) => ({
        ...data,
        minis: data.minis.some((item) => item.id === mini.id) ? data.minis.map((item) => (item.id === mini.id ? mini : item)) : [...data.minis, mini],
      }));
      setSelectedMiniId(mini.id);
      appendKcMessage("agent", response, kcId);
    } catch (err) {
      appendKcMessage("agent", `I couldn't ask Claude to generate a mini: ${errorMessage(err)}`, kcId);
    } finally {
      generatingMiniRef.current = null;
      setGeneratingMiniKcId(null);
      setAgentBusyLabel(null);
    }
  };

  const updateWorkspace = (updater: (data: WorkspaceData) => WorkspaceData) => {
    setWorkspace((current) => {
      const next = updater(current);
      setDirty(true);
      return next;
    });
  };

  const handleKcChange = (kc: KnowledgeComponent) => {
    if (!writerName) return;
    const updated = { ...kc, writerName, updatedAt: new Date().toISOString() };
    updateWorkspace((data) => ({
      ...data,
      kcs: data.kcs.map((item) => (item.id === updated.id ? updated : item)),
    }));
    window.clearTimeout(kcSaveTimers.current.get(updated.id));
    kcSaveTimers.current.set(
      updated.id,
      window.setTimeout(() => {
        api.updateKc(updated).catch(() => undefined);
      }, 900),
    );
  };

  const handleCreateKc = async (input: NewKcInput) => {
    if (!writerName) return;
    setKcCreateError(null);
    setCreatingKc(input);
    setSelectedKcId(null);
    setSelectedMiniId(null);
    setAgentBusyLabel("Asking Claude to draft the KC...");
    try {
      const kc = await api.createKc(input, writerName);
      updateWorkspace((data) => ({ ...data, kcs: [...data.kcs, kc] }));
      setSelectedKcId(kc.id);
      setSelectedMiniId(null);
    } catch (err) {
      setKcCreateError(`I couldn't ask Claude to create that KC: ${errorMessage(err)}`);
    } finally {
      setCreatingKc(null);
      setAgentBusyLabel(null);
    }
  };

  const handleDeleteKc = async (kcId: string) => {
    const kc = workspace.kcs.find((item) => item.id === kcId);
    if (!kc) return;
    const confirmed = window.confirm(`Delete KC ${kc.grade}-${kc.topic}-${kc.kcNumber} · ${kc.title}?\n\nThis will hide it from the app but keep it in the database as soft deleted.`);
    if (!confirmed) return;
    try {
      await api.deleteKc(kcId);
    } catch (err) {
      appendKcMessage("agent", `I couldn't delete that KC: ${errorMessage(err)}`, kcId);
      return;
    }
    const remainingKcs = workspace.kcs.filter((item) => item.id !== kcId);
    const nextKc = remainingKcs[0] ?? null;
    updateWorkspace((data) => ({
      ...data,
      kcs: data.kcs.filter((item) => item.id !== kcId),
      minis: data.minis.filter((mini) => mini.kcId !== kcId),
    }));
    setSelectedKcId(nextKc?.id ?? null);
    setSelectedMiniId(nextKc ? workspace.minis.find((mini) => mini.kcId === nextKc.id)?.id ?? null : null);
  };

  const handleGenerateMini = async () => {
    if (!selectedKc) return;
    const kcId = selectedKc.id;
    if (generatingMiniRef.current === kcId) return;
    generatingMiniRef.current = kcId;
    setGeneratingMiniKcId(kcId);
    setAgentBusyLabel("Generating mini...");
    try {
      const { mini, response } = await api.generateMini(kcId, messages);
      updateWorkspace((data) => ({ ...data, minis: [...data.minis, mini] }));
      setSelectedMiniId(mini.id);
      appendKcMessage("agent", response, kcId);
    } catch (err) {
      appendKcMessage("agent", `I couldn't ask Claude to generate a mini: ${errorMessage(err)}`, kcId);
    } finally {
      generatingMiniRef.current = null;
      setGeneratingMiniKcId(null);
      setAgentBusyLabel(null);
    }
  };

  useEffect(() => {
    if (!selectedKc?.id || generatingMiniRef.current) return;
    let active = true;
    api.getActiveMiniGeneration(selectedKc.id).then((status) => {
      if (!active || !status || !("pending" in status) || !status.pending) return;
      void finishMiniGeneration(selectedKc.id, status.requestId);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedKc?.id]);

  const handleMiniChange = (mini: Mini, snapshot = false) => {
    const baseMini = mini.status === "not_started" && (mini.steps.length > 0 || mini.title.trim()) ? { ...mini, status: "writing" as const } : mini;
    const updated = snapshot ? addVersion(baseMini, baseMini.steps, "manual", "Manual structure edit.") : { ...baseMini, updatedAt: new Date().toISOString() };
    updateWorkspace((data) => ({
      ...data,
      minis: data.minis.map((item) => (item.id === updated.id ? updated : item)),
    }));
    window.clearTimeout(miniSaveTimers.current.get(updated.id));
    miniSaveTimers.current.set(
      updated.id,
      window.setTimeout(
        () => {
          api.updateMini(updated).catch(() => undefined);
        },
        snapshot ? 0 : 250,
      ),
    );
  };

  const handleAddMini = () => {
    if (!selectedKc || minisForKc.length >= 4) return;
    const mini = generateMiniForKc(selectedKc, minisForKc.length + 1);
    updateWorkspace((data) => ({ ...data, minis: [...data.minis, mini] }));
    setSelectedMiniId(mini.id);
  };

  const handleDeleteMini = (miniId: string) => {
    const remaining = minisForKc.filter((mini) => mini.id !== miniId);
    updateWorkspace((data) => ({ ...data, minis: data.minis.filter((mini) => mini.id !== miniId) }));
    setSelectedMiniId(remaining[0]?.id ?? null);
  };

  const replaceMini = (mini: Mini) => {
    updateWorkspace((data) => ({
      ...data,
      minis: data.minis.map((item) => (item.id === mini.id ? mini : item)),
    }));
    setSelectedMiniId(mini.id);
  };

  const handleAgentSend = async (prompt: string) => {
    if (!selectedMini) return;
    if (selectedMini.status === "done") return;
    const kcId = selectedMini.kcId;
    if (/^\s*process(?:\s+agent)?\s+notes?\s*\.?\s*$/i.test(prompt)) {
      appendKcMessage("writer", prompt, kcId);
      await handleProcessNotes(kcId);
      return;
    }
    setAgentBusyLabel("Thinking...");
    appendKcMessage("writer", prompt, kcId);
    try {
      const result = await api.reviseMini(selectedMini.id, prompt, messages);
      replaceMini(result.mini);
      appendKcMessage("agent", result.response, kcId);
    } catch (err) {
      appendKcMessage("agent", `I couldn't send that to Claude: ${errorMessage(err)}`, kcId);
    } finally {
      setAgentBusyLabel(null);
    }
  };

  const handleProcessNotes = async (kcId = selectedMini?.kcId) => {
    if (!selectedMini) return;
    if (selectedMini.status === "done") return;
    setAgentBusyLabel("Thinking...");
    try {
      const result = await api.processNotes(selectedMini.id);
      replaceMini(result.mini);
      appendKcMessage("agent", result.response, kcId);
    } catch (err) {
      appendKcMessage("agent", `I couldn't send the notes to Claude: ${errorMessage(err)}`, kcId);
    } finally {
      setAgentBusyLabel(null);
    }
  };

  const handleRevert = async (versionId: string) => {
    if (!selectedMini) return;
    try {
      const mini = await api.revertMini(selectedMini.id, versionId);
      replaceMini(mini);
    } catch {
      replaceMini(revertMini(selectedMini, versionId));
    }
  };

  const handleWriterSelect = (value: string) => {
    if (!value) {
      setWriterName(null);
      initialKcId.current = null;
      return;
    }
    if (value !== "__new__") {
      setWriterName(value);
      initialKcId.current = null;
      return;
    }
    const next = window.prompt("Writer name");
    const clean = next?.trim();
    if (!clean) return;
    setWriters((current) => [...new Set([...current, clean])].sort((a, b) => a.localeCompare(b)));
    setWriterName(clean);
    initialKcId.current = null;
  };

  return (
    <div className="app-frame">
      <header className="brand-header">
        <div className="brand-lockup">
          <div className="brand-icon" aria-hidden>
            <span className="brand-dot mustard" />
            <span className="brand-dot green" />
          </div>
          <MinisWordmark size={36} />
          <span className="brand-divider" aria-hidden />
          <h1>mini-writer</h1>
        </div>
        <label className="writer-switcher">
          <span>Current writer</span>
          <select value={writerName ?? ""} onChange={(event) => handleWriterSelect(event.target.value)}>
            <option value="">Select writer</option>
            {writers.map((writer) => (
              <option key={writer} value={writer}>{writer}</option>
            ))}
            <option value="__new__">New writer</option>
          </select>
        </label>
      </header>
      <main className={kcPanelCollapsed ? "app-shell kc-panel-collapsed" : "app-shell"}>
        <KcPanel
          kcs={workspace.kcs}
          selectedKc={selectedKc}
          dirty={dirty}
          collapsed={kcPanelCollapsed}
          onSelect={(id) => {
            setSelectedKcId(id);
            setSelectedMiniId(workspace.minis.find((mini) => mini.kcId === id)?.id ?? null);
            initialKcId.current = null;
          }}
          onChange={handleKcChange}
          onCreate={handleCreateKc}
          onDelete={handleDeleteKc}
          onGenerateMini={handleGenerateMini}
          onToggleCollapsed={() => setKcPanelCollapsed((current) => !current)}
          creatingKc={creatingKc}
          createError={kcCreateError}
          generatingMini={generatingMiniKcId === selectedKc?.id}
          writerSelected={Boolean(writerName)}
        />
        <MiniEditor
          kc={selectedKc}
          minis={minisForKc}
          selectedMiniId={selectedMini?.id ?? null}
          creatingKc={creatingKc}
          generatingMini={Boolean(generatingMiniKcId)}
          onSelectMini={setSelectedMiniId}
          onChangeMini={handleMiniChange}
          onAddMini={handleAddMini}
          onDeleteMini={handleDeleteMini}
          onRevert={handleRevert}
        />
        <AgentPanel
          mini={selectedMini}
          messages={messages}
          busyLabel={agentBusyLabel}
          disabledReason={selectedMini?.status === "done" ? "Mini is Done. Change status back to Writing to edit." : null}
          onSend={handleAgentSend}
        />
      </main>
      <DeployMarker />
    </div>
  );
}
