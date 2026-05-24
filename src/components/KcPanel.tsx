import { BookOpen, FilePlus2, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import type { KnowledgeComponent } from "../lib/types";

interface KcPanelProps {
  kcs: KnowledgeComponent[];
  selectedKc: KnowledgeComponent | null;
  dirty: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onChange: (kc: KnowledgeComponent) => void;
  onCreate: (title: string) => void;
  onGenerateMini: () => void;
  onToggleCollapsed: () => void;
}

function kcCode(kc: KnowledgeComponent) {
  return `${kc.grade}-${kc.unit}-${kc.lesson}`;
}

export function KcPanel({
  kcs,
  selectedKc,
  dirty,
  collapsed,
  onSelect,
  onChange,
  onCreate,
  onGenerateMini,
  onToggleCollapsed,
}: KcPanelProps) {
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
        {!kcs.length && <option value="">No KCs yet</option>}
        {kcs.map((kc) => (
          <option key={kc.id} value={kc.id}>{kcCode(kc)} · {kc.title}</option>
        ))}
      </select>

      <form
        className="new-kc"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("title") as HTMLInputElement;
          if (input.value.trim()) {
            onCreate(input.value.trim());
            form.reset();
          }
        }}
      >
        <input name="title" className="input" placeholder="New KC name" />
        <button className="icon-button" aria-label="Create KC" type="submit">
          <FilePlus2 size={18} />
        </button>
      </form>

      {!selectedKc && <p className="empty-copy">This writer has no KCs yet. Create one above to start a blank workspace.</p>}

      {selectedKc && (
        <>
      <div className="kc-title-row">
        <input
          className="title-input"
          value={selectedKc.title}
          onChange={(event) => onChange({ ...selectedKc, title: event.target.value })}
        />
        <div className="id-badge">{kcCode(selectedKc)}</div>
      </div>

      <div className="grade-grid">
        {(["grade", "unit", "lesson"] as const).map((field) => (
          <label key={field} className="mini-field">
            <span>{field}</span>
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
                <strong>{standard.code}</strong>
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

      <button className="primary-button" onClick={onGenerateMini}>
        <Sparkles size={18} />
        Generate Mini
      </button>
        </>
      )}
    </aside>
  );
}
