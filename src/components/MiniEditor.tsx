import { CopyPlus, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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

type ColumnKey = "drag" | "step" | "instruction" | "interaction" | "hint" | "notes" | "actions";

function kcCode(kc: KnowledgeComponent) {
  return `${kc.grade}-${kc.unit}-${kc.lesson}`;
}

export function MiniEditor({ kc, minis, selectedMiniId, onSelectMini, onChangeMini, onAddMini, onDeleteMini }: MiniEditorProps) {
  const selectedMini = minis.find((mini) => mini.id === selectedMiniId) ?? minis[0];
  const [showStepIds, setShowStepIds] = useState(true);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>({
    drag: 34,
    step: 92,
    instruction: 330,
    interaction: 430,
    hint: 210,
    notes: 210,
    actions: 42,
  });

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

  const moveDraggedStep = (targetIndex: number | null) => {
    if (!draggedStepId || targetIndex === null) return;
    const fromIndex = selectedMini.steps.findIndex((step) => step.id === draggedStepId);
    if (fromIndex < 0) return;
    const next = [...selectedMini.steps];
    const [moved] = next.splice(fromIndex, 1);
    const adjustedIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
    next.splice(adjustedIndex, 0, moved);
    onChangeMini({ ...selectedMini, steps: renumberSteps(kc, selectedMini.miniIndex, next) }, true);
  };

  const dragTargetIndex = dropIndex ?? selectedMini.steps.length;
  const visibleColumnWidth =
    columnWidths.drag +
    (showStepIds ? columnWidths.step : 0) +
    columnWidths.instruction +
    columnWidths.interaction +
    columnWidths.hint +
    columnWidths.notes +
    columnWidths.actions;

  const startResize = (key: ColumnKey, event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const minWidth: Record<ColumnKey, number> = {
      drag: 34,
      step: 72,
      instruction: 190,
      interaction: 260,
      hint: 150,
      notes: 150,
      actions: 42,
    };

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidths((current) => ({
        ...current,
        [key]: Math.max(minWidth[key], startWidth + delta),
      }));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const ResizeHandle = ({ column }: { column: ColumnKey }) => (
    <span
      className="column-resizer"
      onMouseDown={(event) => startResize(column, event)}
      role="separator"
      aria-label={`Resize ${column} column`}
    />
  );

  return (
    <main className="main-panel">
      <div className="main-toolbar">
        <div>
          <p className="eyebrow">Mini lessons</p>
          <div className="kc-heading">
            <h2>{kc.title}</h2>
            <span className="id-badge compact">{kcCode(kc)}</span>
          </div>
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
        <table className="step-table" style={{ minWidth: visibleColumnWidth }}>
          <colgroup>
            <col style={{ width: columnWidths.drag }} />
            {showStepIds && <col style={{ width: columnWidths.step }} />}
            <col style={{ width: columnWidths.instruction }} />
            <col style={{ width: columnWidths.interaction }} />
            <col style={{ width: columnWidths.hint }} />
            <col style={{ width: columnWidths.notes }} />
            <col style={{ width: columnWidths.actions }} />
          </colgroup>
          <thead>
            <tr>
              <th className="drag-head" aria-label="Reorder">
                {!showStepIds && (
                  <button className="header-icon-button" aria-label="Show step IDs" onClick={() => setShowStepIds(true)}>
                    <Eye size={14} />
                  </button>
                )}
              </th>
              {showStepIds && (
                <th className="resizable-head">
                  <div className="head-content">
                    <span>Step</span>
                    <button className="header-icon-button" aria-label="Hide step IDs" onClick={() => setShowStepIds(false)}>
                      <EyeOff size={14} />
                    </button>
                  </div>
                  <ResizeHandle column="step" />
                </th>
              )}
              <th className="resizable-head">
                Instruction
                <ResizeHandle column="instruction" />
              </th>
              <th className="resizable-head">
                Interaction
                <ResizeHandle column="interaction" />
              </th>
              <th className="resizable-head">
                Hint text
                <ResizeHandle column="hint" />
              </th>
              <th className="resizable-head">
                Agent notes
                <ResizeHandle column="notes" />
              </th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {selectedMini.steps.map((step, index) => (
              <tr
                key={step.id}
                className={[
                  draggedStepId === step.id ? "dragging-row" : "",
                  draggedStepId && dragTargetIndex === index ? "drop-before" : "",
                ].filter(Boolean).join(" ")}
                onDragOver={(event) => {
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const midpoint = bounds.top + bounds.height / 2;
                  setDropIndex(event.clientY < midpoint ? index : index + 1);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  moveDraggedStep(dropIndex);
                  setDraggedStepId(null);
                  setDropIndex(null);
                }}
              >
                <td className="drag-cell">
                  <button
                    className="drag-handle"
                    draggable
                    aria-label={`Drag step ${step.id}`}
                    onDragStart={(event) => {
                      setDraggedStepId(step.id);
                      setDropIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", step.id);
                    }}
                    onDragEnd={() => {
                      setDraggedStepId(null);
                      setDropIndex(null);
                    }}
                  >
                    <GripVertical size={16} />
                  </button>
                </td>
                {showStepIds && <td className="step-id">{step.id}</td>}
                <td>
                  <textarea value={step.instruction} onChange={(event) => updateStep(step.id, { instruction: event.target.value })} />
                </td>
                <td>
                  <textarea value={step.interaction} onChange={(event) => updateStep(step.id, { interaction: event.target.value })} />
                  <label className="target-row">
                    <span>Target</span>
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
                  <button className="icon-button danger" aria-label="Delete step" onClick={() => deleteStep(step.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {draggedStepId && dragTargetIndex === selectedMini.steps.length && (
              <tr className="drop-after">
                <td colSpan={showStepIds ? 7 : 6} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
