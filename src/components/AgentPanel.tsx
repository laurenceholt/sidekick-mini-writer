import { History, MessageSquareText, RotateCcw, Wand2 } from "lucide-react";
import type { AgentMessage, Mini } from "../lib/types";

interface AgentPanelProps {
  mini: Mini | null;
  messages: AgentMessage[];
  busyLabel: string | null;
  onSend: (prompt: string) => void;
  onProcessNotes: () => void;
  onRevert: (versionId: string) => void;
}

export function AgentPanel({ mini, messages, busyLabel, onSend, onProcessNotes, onRevert }: AgentPanelProps) {
  const isBusy = Boolean(busyLabel);

  return (
    <aside className="panel agent-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Revision agent</p>
          <h2>Agent</h2>
        </div>
        <MessageSquareText size={22} />
      </div>

      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Ask for a revision or process step notes.</p>}
        {messages.map((message) => (
          <div key={message.id} className={message.role === "writer" ? "chat-message writer" : "chat-message agent"}>
            {message.content}
          </div>
        ))}
        {busyLabel && (
          <div className="agent-working" aria-live="polite">
            <span className="working-dot" />
            {busyLabel}
          </div>
        )}
      </div>

      <form
        className="agent-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("prompt") as HTMLTextAreaElement;
          if (input.value.trim() && !isBusy) {
            onSend(input.value.trim());
            form.reset();
          }
        }}
      >
        <textarea name="prompt" placeholder="Ask the agent to revise this mini" disabled={isBusy || !mini} />
        <button className="primary-button" type="submit" disabled={isBusy || !mini}>
          <Wand2 size={17} />
          {isBusy ? "Working" : "Send to agent"}
        </button>
      </form>

      <button className="secondary-button full" onClick={onProcessNotes} disabled={!mini || isBusy}>
        <Wand2 size={17} />
        Process agent notes
      </button>

      <section className="history-section">
        <div className="section-title">
          <History size={16} />
          Versions
        </div>
        {!mini && <p className="muted">No mini selected.</p>}
        {mini?.versions.slice().reverse().map((version) => (
          <div className="version-row" key={version.id}>
            <div>
              <strong>v{version.versionNumber}</strong>
              <span>{version.source}</span>
              <p>{version.summary}</p>
            </div>
            <button className="icon-button" aria-label={`Revert to version ${version.versionNumber}`} onClick={() => onRevert(version.id)}>
              <RotateCcw size={16} />
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
