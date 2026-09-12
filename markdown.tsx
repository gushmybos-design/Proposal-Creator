import React from "react";

/**
 * Minimal, safe markdown renderer (no raw HTML): paragraphs, ## / ### headings,
 * - bullets, **bold**, *italic*, [links](url). Enough for proposal copy.
 */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={`prose-lite ${className}`}>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (/^###\s/.test(lines[0])) return <h3 key={i}>{inline(lines[0].replace(/^###\s/, ""))}</h3>;
        if (/^##\s/.test(lines[0])) return <h2 key={i}>{inline(lines[0].replace(/^##\s/, ""))}</h2>;
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;

function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(s.slice(last, idx));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(
        <a key={k++} href={m[2]} target="_blank" rel="noreferrer noopener">
          {label}
        </a>,
      );
    }
    last = idx + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
