import { MessageSquareText, Send } from "lucide-react";
import type { AgentMessage, Mini } from "../lib/types";

interface AgentPanelProps {
  mini: Mini | null;
  messages: AgentMessage[];
  busyLabel: string | null;
  onSend: (prompt: string) => void;
}

export function AgentPanel({ mini, messages, busyLabel, onSend }: AgentPanelProps) {
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
        {messages.length === 0 && <p className="muted">Ask for revisions, ideas, or type “process notes”.</p>}
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
        <button className="send-button" type="submit" aria-label="Send to agent" disabled={isBusy || !mini}>
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
