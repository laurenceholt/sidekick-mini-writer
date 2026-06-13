import { MessageSquareText, Send } from "lucide-react";
import { MarkdownText } from "./MarkdownText";
import type { AgentMessage, Mini } from "../lib/types";

interface AgentPanelProps {
  mini: Mini | null;
  messages: AgentMessage[];
  busyLabel: string | null;
  disabledReason?: string | null;
  onSend: (prompt: string) => void;
}

export function AgentPanel({ mini, messages, busyLabel, disabledReason, onSend }: AgentPanelProps) {
  const isBusy = Boolean(busyLabel);
  const isDisabled = isBusy || !mini || Boolean(disabledReason);

  return (
    <aside className="panel agent-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Revision agent</p>
        </div>
        <MessageSquareText size={22} />
      </div>

      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Ask for revisions, ideas, or type “process notes”.</p>}
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "chat-message",
              message.role === "writer" ? "writer" : "agent",
              message.content.trim().startsWith("**Eval mini**") ? "eval" : "",
            ].filter(Boolean).join(" ")}
          >
            <MarkdownText text={message.content} />
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
          if (input.value.trim() && !isDisabled) {
            onSend(input.value.trim());
            form.reset();
          }
        }}
      >
        <textarea name="prompt" placeholder={disabledReason ?? "Ask the agent to revise this mini"} disabled={isDisabled} />
        <button className="send-button" type="submit" aria-label="Send to agent" disabled={isDisabled}>
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
