import { BookOpen, FilePlus2, PanelLeftClose, PanelLeftOpen, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { KnowledgeComponent, NewKcInput } from "../lib/types";

interface KcPanelProps {
  kcs: KnowledgeComponent[];
  selectedKc: KnowledgeComponent | null;
  dirty: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onChange: (kc: KnowledgeComponent) => void;
  onCreate: (input: NewKcInput) => void;
  onDelete: (id: string) => void;
  onGenerateMini: () => void;
  onToggleCollapsed: () => void;
  creatingKc: NewKcInput | null;
  createError: string | null;
  generatingMini: boolean;
}

function kcCode(kc: KnowledgeComponent) {
  return `${kc.grade}-${kc.topic}-${kc.kcNumber}`;
}

function shortStandardCode(code: string) {
  return code.replace(/^CCSS\.MATH\.CONTENT\./i, "");
}

export function KcPanel({
  kcs,
  selectedKc,
  dirty,
  collapsed,
  onSelect,
  onChange,
  onCreate,
  onDelete,
  onGenerateMini,
  onToggleCollapsed,
  creatingKc,
  createError,
  generatingMini,
}: KcPanelProps) {
  const [draftKc, setDraftKc] = useState<NewKcInput | null>(null);

  const nextKcNumber = (grade: number, topic: number) => {
    const matching = kcs.filter((kc) => kc.grade === grade && kc.topic === topic).map((kc) => kc.kcNumber);
    return matching.length ? Math.max(...matching) + 1 : 1;
  };

  const openAddKc = () => {
    const grade = selectedKc?.grade ?? 6;
    const topic = selectedKc?.topic ?? 1;
    setDraftKc({
      grade,
      topic,
      kcNumber: nextKcNumber(grade, topic),
      condition: "",
      response: "",
    });
  };

  if (collapsed) {
    return (
      <aside className="panel left-panel collapsed-panel" aria-label="Knowledge component panel collapsed">
        <button className="icon-button collapse-button" aria-label="Expand KC panel" onClick={onToggleCollapsed}>
          <PanelLeftOpen size={18} />
        </button>
        <div className="collapsed-kc">
          <span className="collapsed-label">KC</span>
          <span className="collapsed-id">{selectedKc ? kcCode(selectedKc) : "None"}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel left-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Knowledge component</p>
          <h1>mini-writer</h1>
        </div>
        <div className="panel-header-actions">
          <span className={dirty ? "save-state saving" : "save-state"}>{dirty ? "Saving" : "Saved"}</span>
          <button className="icon-button collapse-button" aria-label="Collapse KC panel" onClick={onToggleCollapsed}>
            <PanelLeftClose size={18} />
          </button>
        </div>
      </div>

      <label className="field-label" htmlFor="kc-select">Previous KCs</label>
      <select id="kc-select" className="select" value={selectedKc?.id ?? ""} onChange={(event) => onSelect(event.target.value)} disabled={!kcs.length}>
        {!selectedKc && <option value="">No KC selected</option>}
        {!kcs.length && <option value="">No KCs yet</option>}
        {kcs.map((kc) => (
          <option key={kc.id} value={kc.id}>{kcCode(kc)} · {kc.title}</option>
        ))}
      </select>

      <button className="secondary-button add-kc-button" type="button" onClick={openAddKc}>
        <FilePlus2 size={17} />
        Add KC
      </button>

      {creatingKc && (
        <section className="working-kc">
          <div className="working-spinner" aria-hidden />
          <p className="eyebrow">Working</p>
          <h2>Drafting KC {creatingKc.grade}-{creatingKc.topic}-{creatingKc.kcNumber}</h2>
          <p>Claude is writing the title, worked example, and standards from your condition and response.</p>
          <div className="working-preview">
            <strong>Condition</strong>
            <span>{creatingKc.condition}</span>
            <strong>Response</strong>
            <span>{creatingKc.response}</span>
          </div>
        </section>
      )}

      {!selectedKc && !creatingKc && <p className="empty-copy">This writer has no KCs yet. Add a KC to start a blank workspace.</p>}
      {createError && !creatingKc && <p className="error-copy">{createError}</p>}

      {draftKc && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDraftKc(null)}>
          <form
            className="kc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-kc-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const condition = draftKc.condition.trim();
              const response = draftKc.response.trim();
              if (!condition || !response) return;
              onCreate({ ...draftKc, condition, response });
              setDraftKc(null);
            }}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">New knowledge component</p>
                <h2 id="add-kc-title">Add KC</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close Add KC" onClick={() => setDraftKc(null)}>
                <X size={17} />
              </button>
            </div>

            <label className="field-label" htmlFor="new-kc-condition">Condition</label>
            <textarea
              id="new-kc-condition"
              className="textarea compact"
              autoFocus
              placeholder="Given an equation with numerical expressions on both sides."
              value={draftKc.condition}
              onChange={(event) => setDraftKc({ ...draftKc, condition: event.target.value })}
            />

            <label className="field-label" htmlFor="new-kc-response">Response</label>
            <textarea
              id="new-kc-response"
              className="textarea compact"
              placeholder="Determine whether the equation is true or false."
              value={draftKc.response}
              onChange={(event) => setDraftKc({ ...draftKc, response: event.target.value })}
            />

            <div className="grade-grid modal-grid">
              {([
                ["grade", "Grade"],
                ["topic", "Topic"],
                ["kcNumber", "KC #"],
              ] as const).map(([field, label]) => (
                <label key={field} className="mini-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={1}
                    value={draftKc[field]}
                    onChange={(event) => setDraftKc({ ...draftKc, [field]: Number(event.target.value) || 1 })}
                  />
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setDraftKc(null)}>
                Cancel
              </button>
              <button className="primary-button modal-primary" type="submit" disabled={!draftKc.condition.trim() || !draftKc.response.trim()}>
                <Sparkles size={17} />
                Draft KC
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedKc && !creatingKc && (
        <>
      <div className="kc-title-row">
        <input
          className="title-input"
          value={selectedKc.title}
          onChange={(event) => onChange({ ...selectedKc, title: event.target.value })}
        />
        <div className="id-badge">{kcCode(selectedKc)}</div>
        <button className="icon-button danger" aria-label="Delete KC" type="button" onClick={() => onDelete(selectedKc.id)}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grade-grid">
        {([
          ["grade", "Grade"],
          ["topic", "Topic"],
          ["kcNumber", "KC #"],
        ] as const).map(([field, label]) => (
          <label key={field} className="mini-field">
            <span>{label}</span>
            <input
              type="number"
              min={1}
              value={selectedKc[field]}
              onChange={(event) => onChange({ ...selectedKc, [field]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>

      <label className="field-label">Condition</label>
      <textarea className="textarea compact" value={selectedKc.condition} onChange={(event) => onChange({ ...selectedKc, condition: event.target.value })} />

      <label className="field-label">Response</label>
      <textarea className="textarea compact" value={selectedKc.response} onChange={(event) => onChange({ ...selectedKc, response: event.target.value })} />

      <section className="example-block">
        <div className="section-title">
          <BookOpen size={16} />
          Worked example
        </div>
        <textarea className="textarea" value={selectedKc.workedExampleMd} onChange={(event) => onChange({ ...selectedKc, workedExampleMd: event.target.value })} />
      </section>

      <section>
        <div className="section-title">CCSS math</div>
        <div className="standards-list">
          {selectedKc.standards.map((standard) => (
            <div className="standard-pill" key={standard.code}>
              <div>
                <strong>{shortStandardCode(standard.code)}</strong>
                <span>{standard.label}</span>
              </div>
              <p>{standard.description}</p>
            </div>
          ))}
        </div>
      </section>

      <label className="field-label">Writer notes</label>
      <textarea
        className="textarea notes"
        value={selectedKc.notesMd}
        placeholder="Markdown notes for this KC"
        onChange={(event) => onChange({ ...selectedKc, notesMd: event.target.value })}
      />

      <button className="primary-button" onClick={onGenerateMini} disabled={generatingMini}>
        <Sparkles size={18} />
        {generatingMini ? "Generating" : "Generate Mini"}
      </button>
        </>
      )}
    </aside>
  );
}
