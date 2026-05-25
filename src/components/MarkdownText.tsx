import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  let numbers: ReactNode[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(<ul key={`list-${nodes.length}`}>{bullets}</ul>);
    bullets = [];
  };
  const flushNumbers = () => {
    if (!numbers.length) return;
    nodes.push(<ol key={`number-list-${nodes.length}`}>{numbers}</ol>);
    numbers = [];
  };
  const flushLists = () => {
    flushBullets();
    flushNumbers();
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushNumbers();
      bullets.push(<li key={index}>{renderInline(bullet[1])}</li>);
      return;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushBullets();
      numbers.push(<li key={index}>{renderInline(numbered[1])}</li>);
      return;
    }

    flushLists();
    if (!line.trim()) {
      nodes.push(<br key={index} />);
      return;
    }
    nodes.push(<p key={index}>{renderInline(line)}</p>);
  });

  flushLists();
  return <div className="markdown-text">{nodes}</div>;
}
