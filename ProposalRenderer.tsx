"use client";

import { useState } from "react";
import type { Block, Theme } from "@/lib/blocks/schema";
import { AccordionBlock, FeaturesBlock, HeroBlock, ImageBlock, QuoteBlock, TextBlock, VideoBlock, type Track } from "./blocks";
import { AcceptBlock, type SignatureInfo } from "./AcceptBlock";
import { useTracker } from "./useTracker";

export type RendererProps = {
  blocks: Block[];
  theme: Theme;
  token: string;
  mode: "public" | "preview" | "editor";
  /** proposal status + signatures for the accept block */
  status?: string;
  signatures?: SignatureInfo[];
  requireCounterSign?: boolean;
  /** PDF rendering: expand accordions, no interactivity */
  printMode?: boolean;
  /** editor-only: highlight/select blocks */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

/**
 * Renders a proposal from its block list. Used by the public page (with tracking),
 * the rep's preview, and the live canvas inside the editor.
 */
export function ProposalRenderer({ blocks, theme, token, mode, status, signatures, requireCounterSign, printMode, selectedId, onSelect }: RendererProps) {
  const { track, getSessionId } = useTracker(token, mode === "public");
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const t: Track = (ev) => track(ev);

  return (
    <div
      className={theme.font === "serif" ? "font-serif" : ""}
      style={{ ["--brand" as string]: theme.brandColor }}
    >
      {blocks.map((b) => (
        <div
          key={b.id}
          data-block-id={b.id}
          onClick={mode === "editor" ? () => onSelect?.(b.id) : undefined}
          className={
            mode === "editor"
              ? `relative cursor-pointer outline-offset-[-3px] transition ${selectedId === b.id ? "outline outline-2 outline-blue-500" : "hover:outline hover:outline-2 hover:outline-blue-300"}`
              : ""
          }
        >
          {renderBlock(b, { theme, token, mode, status, signatures, requireCounterSign, printMode, selections, setSelections, t, getSessionId })}
        </div>
      ))}
      <footer className="border-t border-zinc-200 bg-white py-8 text-center text-xs text-zinc-400">
        {theme.logoUrl && <img src={theme.logoUrl} alt="" className="mx-auto mb-3 h-6 opacity-70" />}
        Powered by Propel · MYBOS
      </footer>
    </div>
  );
}

function renderBlock(
  b: Block,
  ctx: {
    theme: Theme;
    token: string;
    mode: RendererProps["mode"];
    status?: string;
    signatures?: SignatureInfo[];
    requireCounterSign?: boolean;
    printMode?: boolean;
    selections: Record<string, boolean>;
    setSelections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    t: Track;
    getSessionId: () => string | undefined;
  },
) {
  switch (b.type) {
    case "hero":
      return <HeroBlock b={b} logoUrl={ctx.theme.logoUrl} />;
    case "text":
      return <TextBlock b={b} />;
    case "features":
      return <FeaturesBlock b={b} />;
    case "image":
      return <ImageBlock b={b} />;
    case "video":
      return <VideoBlock b={b} track={ctx.t} />;
    case "accordion":
      return <AccordionBlock b={b} track={ctx.t} expandAll={ctx.printMode} />;
    case "quote":
      return (
        <QuoteBlock
          b={b}
          selections={ctx.selections}
          onToggle={ctx.mode === "public" && ctx.status !== "ACCEPTED" ? (id, v) => ctx.setSelections((s) => ({ ...s, [id]: v })) : undefined}
        />
      );
    case "accept":
      return (
        <AcceptBlock b={b} token={ctx.token} mode={ctx.mode} status={ctx.status} signatures={ctx.signatures} requireCounterSign={ctx.requireCounterSign} selections={ctx.selections} track={ctx.t} getSessionId={ctx.getSessionId} />
      );
  }
}
