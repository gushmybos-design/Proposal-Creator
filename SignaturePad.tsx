"use client";

import { useEffect, useRef, useState } from "react";

/** Dependency-free signature pad (mouse + touch + pen). Exposes a PNG data URL via onChange. */
export function SignaturePad({ onChange, height = 160 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const img = c.toDataURL();
      c.width = w * ratio;
      c.height = height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      if (hasInk.current) {
        const im = new Image();
        im.onload = () => ctx.drawImage(im, 0, 0, w, height);
        im.src = img;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    canvas.current!.setPointerCapture(e.pointerId);
    const ctx = canvas.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      setEmpty(false);
    }
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-zinc-300 bg-white">
        <canvas
          ref={canvas}
          style={{ height, touchAction: "none" }}
          className="w-full cursor-crosshair"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Sign here</div>}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-zinc-300" />
      </div>
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={clear} className="text-xs text-zinc-500 hover:text-zinc-900">Clear</button>
      </div>
    </div>
  );
}
