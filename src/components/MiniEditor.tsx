import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
import { MarkdownView } from "./MarkdownView";
import { makeStepId, renumberSteps } from "../lib/ids";
import type { KnowledgeComponent, Mini, MiniStep } from "../lib/types";

interface MiniEditorProps {
  kc: KnowledgeComponent;
  minis: Mini[];
  selectedMiniId: string | null;
  onSelectMini: (id: string) => void;
  onChangeMini: (mini: Mini, snapshot?: boolean) => void;
  onAddMini: () => void;
  onDeleteMini: (id: string) => void;
}

export function MiniEditor({ kc, minis, selectedMiniId, onSelectMini, onChangeMini, onAddMini, onDeleteMini }: MiniEditorProps) {
  const selectedMini = minis.find((mini) => mini.id === selectedMiniId) ?? minis[0];

  if (!selectedMini) {
    return (
      <main className="main-panel empty-panel">
        <h2>No mini yet</h2>
        <p>Generate a mini from the KC panel to start authoring.</p>
      </main>
    );
  }

  const updateStep = (stepId: string, patch: Partial<MiniStep>) => {
    onChangeMini({
      ...selectedMini,
      steps: selectedMini.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    });
  };

  const addStep = () => {
    const nextStep: MiniStep = {
      id: makeStepId(kc, selectedMini.miniIndex, selectedMini.steps.length + 1),
      instruction: "New learner instruction.",
      interaction: "Describe the graphic, response control, and target.",
      targetResponse: "",
      hint: "",
      agentNotes: "",
    };
    onChangeMini({ ...selectedMini, steps: [...selectedMini.steps, nextStep] }, true);
  };

  const deleteStep = (stepId: string) => {
    const steps = renumberSteps(kc, selectedMini.miniIndex, selectedMini.steps.filter((step) => step.id !== stepId));
    onChangeMini({ ...selectedMini, steps }, true);
  };

  const moveStep = (stepId: string, direction: -1 | 1) => {
    const index = selectedMini.steps.findIndex((step) => step.id === stepId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedMini.steps.length) return;
    const next = [...selectedMini.steps];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChangeMini({ ...selectedMini, steps: renumberSteps(kc, selectedMini.miniIndex, next) }, true);
  };

  return (
    <main className="main-panel">
      <div className="main-toolbar">
        <div>
          <p className="eyebrow">Mini lessons</p>
          <h2>{kc.title}</h2>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" onClick={onAddMini} disabled={minis.length >= 4}>
            <CopyPlus size={17} />
            Add mini
          </button>
          <button className="secondary-button" onClick={addStep}>
            <Plus size={17} />
            Add step
          </button>
        </div>
      </div>

      <div className="mini-tabs">
        {minis.map((mini) => (
          <button
            key={mini.id}
            className={mini.id === selectedMini.id ? "mini-tab active" : "mini-tab"}
            onClick={() => onSelectMini(mini.id)}
          >
            Mini {mini.miniIndex}
          </button>
        ))}
      </div>

      <div className="mini-title-bar">
        <input
          className="mini-title-input"
          value={selectedMini.title}
          onChange={(event) => onChangeMini({ ...selectedMini, title: event.target.value })}
        />
        <button className="icon-button danger" aria-label="Delete mini" onClick={() => onDeleteMini(selectedMini.id)} disabled={minis.length <= 1}>
          <Trash2 size={17} />
        </button>
      </div>

      <div className="step-table-wrap">
        <table className="step-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Instruction</th>
              <th>Interaction</th>
              <th>Hint text</th>
              <th>Agent notes</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {selectedMini.steps.map((step) => (
              <tr key={step.id}>
                <td className="step-id">{step.id}</td>
                <td>
                  <textarea value={step.instruction} onChange={(event) => updateStep(step.id, { instruction: event.target.value })} />
                  <MarkdownView content={step.instruction} />
                </td>
                <td>
                  <textarea value={step.interaction} onChange={(event) => updateStep(step.id, { interaction: event.target.value })} />
                  <label className="target-label">
                    Target
                    <input value={step.targetResponse} onChange={(event) => updateStep(step.id, { targetResponse: event.target.value })} />
                  </label>
                </td>
                <td>
                  <textarea value={step.hint} onChange={(event) => updateStep(step.id, { hint: event.target.value })} />
                </td>
                <td>
                  <textarea value={step.agentNotes} placeholder="Ask the agent to revise this step" onChange={(event) => updateStep(step.id, { agentNotes: event.target.value })} />
                </td>
                <td className="row-actions">
                  <button className="icon-button" aria-label="Move step up" onClick={() => moveStep(step.id, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-button" aria-label="Move step down" onClick={() => moveStep(step.id, 1)}>
                    <ArrowDown size={16} />
                  </button>
                  <button className="icon-button danger" aria-label="Delete step" onClick={() => deleteStep(step.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
