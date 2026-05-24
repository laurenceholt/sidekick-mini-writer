import { useEffect, useMemo, useRef, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { DeployMarker } from "./components/DeployMarker";
import { KcPanel } from "./components/KcPanel";
import { MiniEditor } from "./components/MiniEditor";
import { MinisWordmark } from "./components/MinisWordmark";
import { api, fetchWorkspace } from "./lib/api";
import { createId } from "./lib/ids";
import { applyAgentNotes, generateKcDraft, generateMiniForKc, reviseStepsFromPrompt } from "./lib/localAgent";
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

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(seedWorkspace);
  const [selectedKcId, setSelectedKcId] = useState(seedWorkspace.kcs[0].id);
  const [selectedMiniId, setSelectedMiniId] = useState<string | null>(seedWorkspace.minis[0].id);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [dirty, setDirty] = useState(false);
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
    let kc = generateKcDraft(title);
    try {
      kc = await api.createKc(title);
    } catch {
      // Local draft already provides a usable offline path.
    }
    updateWorkspace((data) => ({ ...data, kcs: [...data.kcs, kc] }));
    setSelectedKcId(kc.id);
    setSelectedMiniId(null);
  };

  const handleGenerateMini = async () => {
    if (!selectedKc) return;
    const nextIndex = Math.min(minisForKc.length + 1, 4);
    let mini = generateMiniForKc(selectedKc, nextIndex);
    try {
      mini = await api.generateMini(selectedKc.id);
    } catch {
      // Keep generated local mini.
    }
    updateWorkspace((data) => ({ ...data, minis: [...data.minis, mini] }));
    setSelectedMiniId(mini.id);
    setMessages((current) => [...current, addMessage("agent", "Done. I generated a mini for this KC.")]);
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
        snapshot ? 0 : 1200,
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
    setMessages((current) => [...current, addMessage("writer", prompt)]);
    try {
      const result = await api.reviseMini(selectedMini.id, prompt);
      replaceMini(result.mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
    } catch {
      const result = reviseStepsFromPrompt(selectedMini.steps, prompt);
      const mini = addVersion(selectedMini, result.steps, "agent", result.summary);
      replaceMini(mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
    }
  };

  const handleProcessNotes = async () => {
    if (!selectedMini) return;
    try {
      const result = await api.processNotes(selectedMini.id);
      replaceMini(result.mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
    } catch {
      const result = applyAgentNotes(selectedMini.steps);
      const mini = addVersion(selectedMini, result.steps, "notes", "Processed agent notes.");
      replaceMini(mini);
      setMessages((current) => [...current, addMessage("agent", result.response)]);
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
      <main className="app-shell">
        <KcPanel
          kcs={workspace.kcs}
          selectedKc={selectedKc}
          dirty={dirty}
          onSelect={(id) => {
            setSelectedKcId(id);
            setSelectedMiniId(workspace.minis.find((mini) => mini.kcId === id)?.id ?? null);
          }}
          onChange={handleKcChange}
          onCreate={handleCreateKc}
          onGenerateMini={handleGenerateMini}
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
          onSend={handleAgentSend}
          onProcessNotes={handleProcessNotes}
          onRevert={handleRevert}
        />
      </main>
      <DeployMarker />
    </div>
  );
}
