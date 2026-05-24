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

const KC_PANEL_COLLAPSED_KEY = "mini-writer:kc-panel-collapsed";

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(seedWorkspace);
  const [selectedKcId, setSelectedKcId] = useState(seedWorkspace.kcs[0].id);
  const [selectedMiniId, setSelectedMiniId] = useState<string | null>(seedWorkspace.minis[0].id);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [agentBusyLabel, setAgentBusyLabel] = useState<string | null>(null);
  const [kcPanelCollapsed, setKcPanelCollapsed] = useState(() => localStorage.getItem(KC_PANEL_COLLAPSED_KEY) === "true");
  const kcSaveTimers = useRef(new Map<string, number>());
  const miniSaveTimers = useRef(new Map<string, number>());

  useEffect(() => {
    const local = loadLocalWorkspace();
    setWorkspace(local);
    setSelectedKcId(local.kcs[0]?.id ?? seedWorkspace.kcs[0].id);
    setSelectedMiniId(local.minis.find((mini) => mini.kcId === local.kcs[0]?.id)?.id ?? null);

    fetchWorkspace().then((remote) => {
      if (remote.kcs.length) {
        setWorkspace(remote);
        setSelectedKcId(remote.kcs[0].id);
        setSelectedMiniId(remote.minis.find((mini) => mini.kcId === remote.kcs[0].id)?.id ?? null);
      }
    });
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(() => {
      saveLocalWorkspace(workspace);
      setDirty(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [dirty, workspace]);

  useEffect(() => {
    localStorage.setItem(KC_PANEL_COLLAPSED_KEY, String(kcPanelCollapsed));
  }, [kcPanelCollapsed]);

  const selectedKc = workspace.kcs.find((kc) => kc.id === selectedKcId) ?? workspace.kcs[0];
  const minisForKc = useMemo(
    () => workspace.minis.filter((mini) => mini.kcId === selectedKc?.id).sort((a, b) => a.miniIndex - b.miniIndex),
    [workspace.minis, selectedKc?.id],
  );
  const selectedMini = minisForKc.find((mini) => mini.id === selectedMiniId) ?? minisForKc[0] ?? null;

  const updateWorkspace = (updater: (data: WorkspaceData) => WorkspaceData) => {
    setWorkspace((current) => {
      const next = updater(current);
      setDirty(true);
      return next;
    });
  };

  const handleKcChange = (kc: KnowledgeComponent) => {
    const updated = { ...kc, updatedAt: new Date().toISOString() };
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
      const kc = await api.createKc(title);
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
      const mini = await api.generateMini(selectedKc.id);
      updateWorkspace((data) => ({ ...data, minis: [...data.minis, mini] }));
      setSelectedMiniId(mini.id);
      setMessages((current) => [...current, addMessage("agent", "Done. Claude generated a mini for this KC.")]);
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
    setAgentBusyLabel("Sending request to Claude...");
    setMessages((current) => [...current, addMessage("writer", prompt)]);
    try {
      const result = await api.reviseMini(selectedMini.id, prompt);
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
    setAgentBusyLabel("Sending step notes to Claude...");
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

  if (!selectedKc) {
    return <div className="boot">Loading mini-writer...</div>;
  }

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
        />
        <AgentPanel
          mini={selectedMini}
          messages={messages}
          busyLabel={agentBusyLabel}
          onSend={handleAgentSend}
          onProcessNotes={handleProcessNotes}
          onRevert={handleRevert}
        />
      </main>
      <DeployMarker />
    </div>
  );
}
