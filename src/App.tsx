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
import { seedWorkspace } from "./lib/seed";
import { addVersion, revertMini } from "./lib/versions";
import type { AgentMessage, KnowledgeComponent, Mini, WorkspaceData } from "./lib/types";

const DEFAULT_WRITER = "Laurence";
const WRITER_KEY = "mini-writer:selected-writer";
const KC_PANEL_COLLAPSED_KEY = "mini-writer:kc-panel-collapsed";
const THINKING_LABELS = [
  "Thinking...",
  "Reading the mini...",
  "Checking the skill guidance...",
  "Researching sources...",
  "Drafting a response...",
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
  return new URLSearchParams(window.location.search).get("writer") || localStorage.getItem(WRITER_KEY) || DEFAULT_WRITER;
}

function readKcIdFromUrl() {
  const match = window.location.pathname.match(/^\/kc\/([^/]+)/);
  return match?.[1] ?? null;
}

function setBrowserKcUrl(writerName: string, kcId: string | null) {
  const params = new URLSearchParams();
  params.set("writer", writerName);
  const path = kcId ? `/kc/${kcId}` : "/";
  window.history.replaceState(null, "", `${path}?${params.toString()}`);
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(seedWorkspace);
  const [writerName, setWriterName] = useState(readWriterFromUrl);
  const [writers, setWriters] = useState<string[]>([readWriterFromUrl()]);
  const [selectedKcId, setSelectedKcId] = useState<string | null>(readKcIdFromUrl() ?? seedWorkspace.kcs[0].id);
  const [selectedMiniId, setSelectedMiniId] = useState<string | null>(seedWorkspace.minis[0].id);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [agentBusyLabel, setAgentBusyLabel] = useState<string | null>(null);
  const [kcPanelCollapsed, setKcPanelCollapsed] = useState(() => localStorage.getItem(KC_PANEL_COLLAPSED_KEY) === "true");
  const kcSaveTimers = useRef(new Map<string, number>());
  const miniSaveTimers = useRef(new Map<string, number>());
  const initialKcId = useRef(readKcIdFromUrl());

  useEffect(() => {
    let active = true;
    localStorage.setItem(WRITER_KEY, writerName);
    const local = loadLocalWorkspace(writerName);
    setWorkspace(local);
    const preferredId = initialKcId.current;
    const localKcId = (preferredId && local.kcs.some((kc) => kc.id === preferredId) ? preferredId : local.kcs[0]?.id) ?? null;
    setSelectedKcId(localKcId);
    setSelectedMiniId(local.minis.find((mini) => mini.kcId === localKcId)?.id ?? null);

    api.listWriters().then((remoteWriters) => {
      if (!active) return;
      setWriters([...new Set([...remoteWriters, writerName])].sort((a, b) => a.localeCompare(b)));
    }).catch(() => undefined);

    fetchWorkspace(writerName).then((remote) => {
      if (!active) return;
      setWorkspace(remote);
      const remoteKcId = (preferredId && remote.kcs.some((kc) => kc.id === preferredId) ? preferredId : remote.kcs[0]?.id) ?? null;
      setSelectedKcId(remoteKcId);
      setSelectedMiniId(remote.minis.find((mini) => mini.kcId === remoteKcId)?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [writerName]);

  useEffect(() => {
    if (!dirty) return;
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
    let index = THINKING_LABELS.indexOf(agentBusyLabel);
    const interval = window.setInterval(() => {
      index = (index + 1) % THINKING_LABELS.length;
      setAgentBusyLabel(THINKING_LABELS[index]);
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
    setBrowserKcUrl(writerName, selectedKc?.id ?? null);
  }, [writerName, selectedKc?.id]);

  const updateWorkspace = (updater: (data: WorkspaceData) => WorkspaceData) => {
    setWorkspace((current) => {
      const next = updater(current);
      setDirty(true);
      return next;
    });
  };

  const handleKcChange = (kc: KnowledgeComponent) => {
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

  const handleCreateKc = async (title: string) => {
    setAgentBusyLabel("Asking Claude to draft the KC...");
    try {
      const kc = await api.createKc(title, writerName);
      updateWorkspace((data) => ({ ...data, kcs: [...data.kcs, kc] }));
      setSelectedKcId(kc.id);
      setSelectedMiniId(null);
    } catch (err) {
      setMessages((current) => [...current, addMessage("agent", `I couldn't ask Claude to create that KC: ${errorMessage(err)}`)]);
    } finally {
      setAgentBusyLabel(null);
    }
  };

  const handleGenerateMini = async () => {
    if (!selectedKc) return;
    setAgentBusyLabel("Asking Claude to generate a mini...");
    try {
      const { mini, response } = await api.generateMini(selectedKc.id);
      updateWorkspace((data) => ({ ...data, minis: [...data.minis, mini] }));
      setSelectedMiniId(mini.id);
      setMessages((current) => [...current, addMessage("agent", response)]);
    } catch (err) {
      setMessages((current) => [...current, addMessage("agent", `I couldn't ask Claude to generate a mini: ${errorMessage(err)}`)]);
    } finally {
      setAgentBusyLabel(null);
    }
  };

  const handleMiniChange = (mini: Mini, snapshot = false) => {
    const updated = snapshot ? addVersion(mini, mini.steps, "manual", "Manual structure edit.") : { ...mini, updatedAt: new Date().toISOString() };
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
    if (/^\s*process(?:\s+agent)?\s+notes?\s*\.?\s*$/i.test(prompt)) {
      setMessages((current) => [...current, addMessage("writer", prompt)]);
      await handleProcessNotes();
      return;
    }
    setAgentBusyLabel("Thinking...");
    setMessages((current) => [...current, addMessage("writer", prompt)]);
    try {
      const result = await api.reviseMini(selectedMini.id, prompt, messages);
      replaceMini(result.mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
    } catch (err) {
      setMessages((current) => [...current, addMessage("agent", `I couldn't send that to Claude: ${errorMessage(err)}`)]);
    } finally {
      setAgentBusyLabel(null);
    }
  };

  const handleProcessNotes = async () => {
    if (!selectedMini) return;
    setAgentBusyLabel("Thinking...");
    try {
      const result = await api.processNotes(selectedMini.id);
      replaceMini(result.mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
    } catch (err) {
      setMessages((current) => [...current, addMessage("agent", `I couldn't send the notes to Claude: ${errorMessage(err)}`)]);
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
    if (value !== "__new__") {
      setWriterName(value);
      setMessages([]);
      initialKcId.current = null;
      return;
    }
    const next = window.prompt("Writer name");
    const clean = next?.trim();
    if (!clean) return;
    setWriters((current) => [...new Set([...current, clean])].sort((a, b) => a.localeCompare(b)));
    setWriterName(clean);
    setMessages([]);
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
          <span>Writer</span>
          <select value={writerName} onChange={(event) => handleWriterSelect(event.target.value)}>
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
          onGenerateMini={handleGenerateMini}
          onToggleCollapsed={() => setKcPanelCollapsed((current) => !current)}
        />
        <MiniEditor
          kc={selectedKc}
          minis={minisForKc}
          selectedMiniId={selectedMini?.id ?? null}
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
          onSend={handleAgentSend}
        />
      </main>
      <DeployMarker />
    </div>
  );
}
