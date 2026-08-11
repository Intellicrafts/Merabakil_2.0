"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { GitBranch, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { KnowledgeGraph, KnowledgeGraphNode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnowledgeGraphPanelProps {
  graph?: KnowledgeGraph;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRefresh: () => void;
}

type SimNode = KnowledgeGraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const W = 960;
const H = 560;

function shortLabel(label: string, max = 28) {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function layoutNodes(nodes: KnowledgeGraphNode[], edges: { source: string; target: string }[]): SimNode[] {
  const docs = nodes.filter((n) => n.type === "Document");
  const refs = nodes.filter((n) => n.type !== "Document");
  const sim: SimNode[] = [];

  docs.forEach((n, i) => {
    const angle = (i / Math.max(docs.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(W, H) * 0.28;
    sim.push({
      ...n,
      x: W / 2 + Math.cos(angle) * r,
      y: H / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    });
  });

  refs.forEach((n, i) => {
    const angle = (i / Math.max(refs.length, 1)) * Math.PI * 2;
    const r = Math.min(W, H) * 0.42;
    sim.push({
      ...n,
      x: W / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    });
  });

  // Light force iterations for separation
  const byId = new Map(sim.map((n) => [n.id, n]));
  for (let iter = 0; iter < 80; iter++) {
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i];
        const b = sim[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 1;
        const minDist = a.type === "Document" || b.type === "Document" ? 72 : 48;
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.35;
          dx *= push;
          dy *= push;
          a.x -= dx;
          a.y -= dy;
          b.x += dx;
          b.y += dy;
        }
      }
    }
    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const target = 110;
      const pull = ((dist - target) / dist) * 0.04;
      a.x += dx * pull;
      a.y += dy * pull;
      b.x -= dx * pull;
      b.y -= dy * pull;
    }
  }

  for (const n of sim) {
    n.x = Math.max(36, Math.min(W - 36, n.x));
    n.y = Math.max(36, Math.min(H - 36, n.y));
  }
  return sim;
}

export function KnowledgeGraphPanel({
  graph,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
}: KnowledgeGraphPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const laidOut = useMemo(() => {
    if (!graph?.nodes.length) return [];
    return layoutNodes(graph.nodes, graph.edges);
  }, [graph]);

  const selected = useMemo(
    () => laidOut.find((n) => n.id === selectedId) ?? null,
    [laidOut, selectedId],
  );

  const neighborIds = useMemo(() => {
    if (!selectedId || !graph) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [graph, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [graph]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest("[data-node]")) return;
      dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset],
  );

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const stats = graph?.stats;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Knowledge graph
          {stats ? ` · ${stats.documents} docs · ${stats.citations} citations` : ""}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="kc-btn-soft h-8 w-8 rounded-lg p-0"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}
            className="kc-btn-soft h-8 w-8 rounded-lg p-0"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="kc-btn-soft h-8 rounded-lg px-2.5 text-[12px] font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {isLoading && !graph && (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      )}

      {isError && !graph && (
        <p className="rounded-xl border border-black/[0.06] bg-white/50 px-3 py-3 text-[13px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
          {errorMessage || "Knowledge graph unavailable. Ensure Neo4j is running and documents have been ingested."}
        </p>
      )}

      {!isLoading && graph && graph.nodes.length === 0 && !isError && (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-4 py-12 text-center",
            "dark:border-white/12 dark:bg-white/[0.02]",
            "kc-card-in",
          )}
        >
          <GitBranch className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" strokeWidth={1.5} />
          <p className="text-[13px] font-medium">No graph yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Ingest documents to populate Document → Reference citation links in Neo4j.
          </p>
        </div>
      )}

      {graph && graph.nodes.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-black/[0.06]",
              "bg-[radial-gradient(ellipse_at_30%_20%,rgba(148,163,184,0.18),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(100,116,139,0.12),transparent_50%),linear-gradient(165deg,#f8fafc_0%,#eef2f6_100%)]",
              "dark:border-white/[0.08] dark:bg-[radial-gradient(ellipse_at_30%_20%,rgba(148,163,184,0.08),transparent_55%),linear-gradient(165deg,#0f1419_0%,#151b22_100%)]",
              "kc-card-in cursor-grab active:cursor-grabbing",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[min(62vh,560px)] w-full touch-none">
              <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
                {(graph.edges ?? []).map((e) => {
                  const a = laidOut.find((n) => n.id === e.source);
                  const b = laidOut.find((n) => n.id === e.target);
                  if (!a || !b) return null;
                  const dim =
                    selectedId != null && (!neighborIds.has(e.source) || !neighborIds.has(e.target));
                  return (
                    <line
                      key={e.id}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="currentColor"
                      className={cn(
                        "text-slate-400/55 dark:text-slate-500/45",
                        dim && "opacity-20",
                      )}
                      strokeWidth={1.25}
                    />
                  );
                })}
                {laidOut.map((n) => {
                  const isDoc = n.type === "Document";
                  const dim = selectedId != null && !neighborIds.has(n.id);
                  const active = n.id === selectedId;
                  const r = isDoc ? 16 : 10;
                  return (
                    <g
                      key={n.id}
                      data-node
                      transform={`translate(${n.x} ${n.y})`}
                      className={cn(
                        "cursor-pointer transition-opacity",
                        dim && "opacity-25",
                      )}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedId(n.id === selectedId ? null : n.id);
                      }}
                    >
                      <circle
                        r={r + (active ? 3 : 0)}
                        className={cn(
                          isDoc
                            ? "fill-slate-700 stroke-slate-200 dark:fill-slate-200 dark:stroke-slate-700"
                            : "fill-teal-700/85 stroke-teal-100/80 dark:fill-teal-400/80 dark:stroke-teal-950",
                          active && "stroke-amber-400 stroke-[2.5]",
                        )}
                        strokeWidth={1.5}
                      />
                      <text
                        y={r + 14}
                        textAnchor="middle"
                        className="fill-slate-700 text-[10px] font-medium dark:fill-slate-300"
                        style={{ pointerEvents: "none" }}
                      >
                        {shortLabel(n.label, isDoc ? 32 : 22)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-700 dark:bg-slate-200" />
                Document
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-700 dark:bg-teal-400" />
                Reference
              </span>
              <span className="opacity-70">Drag to pan · scroll zoom via buttons</span>
            </div>
          </div>

          <aside
            className={cn(
              "rounded-2xl border border-black/[0.06] bg-white/55 p-4 backdrop-blur-xl",
              "dark:border-white/[0.08] dark:bg-white/[0.03]",
              "kc-card-in",
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Selection
            </p>
            {!selected && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Click a node to inspect document metadata or citation keys.
              </p>
            )}
            {selected && (
              <div className="mt-3 space-y-2">
                <p className="text-[14px] font-semibold leading-snug text-foreground">
                  {selected.label}
                </p>
                <dl className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="font-medium">{selected.type}</dd>
                  </div>
                  {selected.doc_type && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Doc type</dt>
                      <dd className="font-medium">{selected.doc_type}</dd>
                    </div>
                  )}
                  {selected.jurisdiction && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Jurisdiction</dt>
                      <dd className="font-medium">{selected.jurisdiction}</dd>
                    </div>
                  )}
                  {selected.document_id && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground">Document ID</dt>
                      <dd className="break-all font-mono text-[11px]">{selected.document_id}</dd>
                    </div>
                  )}
                  {selected.key && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground">Citation key</dt>
                      <dd className="break-all font-mono text-[11px]">{selected.key}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 pt-1">
                    <dt className="text-muted-foreground">Linked</dt>
                    <dd className="font-medium">{Math.max(0, neighborIds.size - 1)}</dd>
                  </div>
                </dl>
              </div>
            )}
            {stats && (
              <div className="mt-5 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Corpus graph
                </p>
                <ul className="mt-2 space-y-1 text-[12px]">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Documents</span>
                    <span className="font-semibold">{stats.documents}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">References</span>
                    <span className="font-semibold">{stats.references}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">CITES edges</span>
                    <span className="font-semibold">{stats.citations}</span>
                  </li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
