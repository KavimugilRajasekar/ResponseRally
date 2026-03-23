import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, GitBranch, Zap, Hash, DollarSign, Trophy, Clock, TrendingUp, MessageSquare, Layers } from "lucide-react";
import { ChatMessage, AI_PROVIDERS, Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConversationFlowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  /** For combined benchmarking: all conversations in the group */
  groupedConversations?: Conversation[];
}

// Layout constants
const NODE_W = 180;
const NODE_H = 56;
const PROMPT_R = 38;
const GAP_X = 42;
const GAP_Y = 100;
const TOP_PAD = 60;
const LEFT_PAD = 60;

// Combined mode layout
const LANE_GAP = 32;
const LANE_HEADER_H = 36;

interface HoverInfo {
  x: number;
  y: number;
  type: "prompt" | "response";
  content: string;
  model?: string;
  latency?: number;
  tokens?: number;
  cost?: number;
  isSelected?: boolean;
  provider?: string;
  mode?: string;
}

const MODE_COLORS: Record<string, string> = {
  "full-context": "hsl(var(--mode-full-context, 142 50% 45%))",
  "sliding-window": "hsl(var(--mode-sliding-window, 48 85% 55%))",
  "stateless": "hsl(var(--mode-stateless, 200 70% 50%))",
};

function getModelColor(name: string): string {
  const p = AI_PROVIDERS.find((a) => a.name === name);
  return p?.color ?? "hsl(280, 70%, 50%)";
}

function getModeColor(mode?: string): string {
  return MODE_COLORS[mode ?? ""] ?? "hsl(var(--primary))";
}

/** Left-panel summary computed from conversation messages */
function useSummary(messages: ChatMessage[]) {
  return useMemo(() => {
    const turns = messages.filter(m => m.role === "user").length;
    const allResponses = messages.flatMap(m => m.responses ?? []);

    const totalTokens = allResponses.reduce((s, r) => s + (r.tokens || 0), 0);
    const totalCost = allResponses.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
    const avgLatency = allResponses.length
      ? Math.round(allResponses.reduce((s, r) => s + r.latency, 0) / allResponses.length)
      : 0;
    const fastestResp = allResponses.length
      ? allResponses.reduce((a, b) => a.latency < b.latency ? a : b)
      : null;

    const winCounts: Record<string, number> = {};
    messages.forEach(m => {
      if (m.selectedModel) {
        winCounts[m.selectedModel] = (winCounts[m.selectedModel] || 0) + 1;
      }
    });
    const topModel = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];
    const providerSet = new Set(allResponses.map(r => r.provider));

    return { turns, totalTokens, totalCost, avgLatency, fastestResp, topModel, providerSet };
  }, [messages]);
}

/** Combined summary across all grouped conversations */
function useCombinedSummary(conversations: Conversation[]) {
  return useMemo(() => {
    const allMessages = conversations.flatMap(c => c.messages);
    const turns = conversations[0]?.messages.filter(m => m.role === "user").length ?? 0;
    const allResponses = allMessages.flatMap(m => m.responses ?? []);

    const totalTokens = allResponses.reduce((s, r) => s + (r.tokens || 0), 0);
    const totalCost = allResponses.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
    const avgLatency = allResponses.length
      ? Math.round(allResponses.reduce((s, r) => s + r.latency, 0) / allResponses.length)
      : 0;

    // Per-mode stats
    const modeStats = conversations.map(c => {
      const resps = c.messages.flatMap(m => m.responses ?? []);
      const modeAvgLatency = resps.length ? Math.round(resps.reduce((s, r) => s + r.latency, 0) / resps.length) : 0;
      const modeTotalTokens = resps.reduce((s, r) => s + (r.tokens || 0), 0);
      const modeTotalCost = resps.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
      return {
        mode: c.benchmarkingMode || "full-context",
        label: c.groupLabel || c.benchmarkingMode || "Unknown",
        avgLatency: modeAvgLatency,
        totalTokens: modeTotalTokens,
        totalCost: modeTotalCost,
        turns: c.messages.filter(m => m.role === "user").length,
      };
    });

    return { turns, totalTokens, totalCost, avgLatency, modeStats, modes: conversations.length };
  }, [conversations]);
}

export function ConversationFlowDialog({ isOpen, onClose, messages, groupedConversations }: ConversationFlowDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const isCombined = (groupedConversations?.length ?? 0) > 1;
  const allMessages = isCombined
    ? groupedConversations!.flatMap(c => c.messages)
    : messages;
  const summary = useSummary(allMessages);
  const combinedSummary = useCombinedSummary(groupedConversations ?? []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Build paired turns for single conversation
  const turns = useMemo(() => {
    const result: { prompt: ChatMessage; assistant: ChatMessage | null }[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user") {
        const next = messages[i + 1];
        result.push({
          prompt: msg,
          assistant: next?.role === "assistant" ? next : null,
        });
        if (next?.role === "assistant") i++;
      }
    }
    return result;
  }, [messages]);

  // Build combined turns (shared prompts across modes)
  const combinedTurns = useMemo(() => {
    if (!isCombined) return [];
    const convs = groupedConversations!;
    // Use first conv's user messages as the shared prompt timeline
    const baseConv = convs[0];
    const userMsgs = baseConv.messages.filter(m => m.role === "user");

    return userMsgs.map((userMsg, turnIdx) => {
      const lanes = convs.map(conv => {
        const convUserMsgs = conv.messages.filter(m => m.role === "user");
        const thisUser = convUserMsgs[turnIdx];
        if (!thisUser) return { conv, responses: [] };
        const userIdx = conv.messages.indexOf(thisUser);
        const nextMsg = conv.messages[userIdx + 1];
        const assistant = nextMsg?.role === "assistant" ? nextMsg : null;
        return { conv, responses: assistant?.responses ?? [], selectedModel: assistant?.selectedModel };
      });
      return { prompt: userMsg, lanes };
    });
  }, [isCombined, groupedConversations, messages]);

  // Single-mode SVG layout
  const svgLayout = useMemo(() => {
    if (isCombined || turns.length === 0) return { width: 600, height: 400, nodes: [] as any[] };

    type NodeInfo = {
      turnIdx: number;
      promptCx: number;
      promptCy: number;
      responses: {
        name: string; color: string; x: number; y: number;
        isSelected: boolean; latency: number; tokens: number;
        cost: number; content: string; provider: string;
      }[];
      promptContent: string;
      selectedModel: string | undefined;
    };

    const nodes: NodeInfo[] = [];
    let currentY = TOP_PAD;

    for (let t = 0; t < turns.length; t++) {
      const turn = turns[t];
      const responses = turn.assistant?.responses ?? [];
      const respCount = Math.max(responses.length, 1);
      const totalWidth = respCount * NODE_W + (respCount - 1) * GAP_X;

      const promptCx = LEFT_PAD + totalWidth / 2;
      const promptCy = currentY + PROMPT_R;
      const respY = promptCy + PROMPT_R + GAP_Y;

      const respNodes = responses.map((r, i) => ({
        name: r.model,
        color: r.color || getModelColor(r.model),
        x: LEFT_PAD + i * (NODE_W + GAP_X),
        y: respY,
        isSelected: !!r.isSelected,
        latency: r.latency,
        tokens: r.tokens,
        cost: r.estimatedCost ?? 0,
        content: r.response,
        provider: r.provider,
      }));

      nodes.push({
        turnIdx: t,
        promptCx,
        promptCy,
        responses: respNodes,
        promptContent: turn.prompt.content,
        selectedModel: turn.assistant?.selectedModel,
      });

      currentY = respY + NODE_H + GAP_Y;
    }

    const maxX = Math.max(600, ...nodes.flatMap((n) => n.responses.map((r) => r.x + NODE_W + LEFT_PAD)));
    return { width: maxX, height: currentY + 40, nodes };
  }, [turns, isCombined]);

  // Combined-mode SVG layout
  const combinedLayout = useMemo(() => {
    if (!isCombined || combinedTurns.length === 0) return { width: 800, height: 400, turnRows: [] as any[] };

    const convs = groupedConversations!;
    const laneCount = convs.length;

    // Calculate lane widths based on max responses per lane
    const laneWidths = convs.map((conv) => {
      const maxResp = Math.max(1, ...conv.messages
        .filter(m => m.role === "assistant")
        .map(m => (m.responses ?? []).length));
      return maxResp * NODE_W + (maxResp - 1) * GAP_X + LEFT_PAD;
    });

    const totalWidth = laneWidths.reduce((a, b) => a + b, 0) + (laneCount - 1) * LANE_GAP + LEFT_PAD;

    // Lane x offsets
    const laneOffsets: number[] = [];
    let accX = LEFT_PAD;
    for (let i = 0; i < laneCount; i++) {
      laneOffsets.push(accX);
      accX += laneWidths[i] + LANE_GAP;
    }

    // Build rows
    let currentY = TOP_PAD + LANE_HEADER_H + 20;
    const turnRows: {
      turnIdx: number;
      promptCx: number;
      promptCy: number;
      promptContent: string;
      lanes: {
        laneIdx: number;
        mode: string;
        label: string;
        responses: {
          name: string; color: string; x: number; y: number;
          isSelected: boolean; latency: number; tokens: number;
          cost: number; content: string; provider: string;
        }[];
        selectedModel?: string;
      }[];
    }[] = [];

    for (let t = 0; t < combinedTurns.length; t++) {
      const ct = combinedTurns[t];
      const promptCx = totalWidth / 2;
      const promptCy = currentY + PROMPT_R;
      const respY = promptCy + PROMPT_R + GAP_Y * 0.8;

      const lanes = ct.lanes.map((lane, li) => {
        const resps = lane.responses.map((r, ri) => ({
          name: r.model,
          color: r.color || getModelColor(r.model),
          x: laneOffsets[li] + ri * (NODE_W + GAP_X),
          y: respY,
          isSelected: !!r.isSelected,
          latency: r.latency,
          tokens: r.tokens,
          cost: r.estimatedCost ?? 0,
          content: r.response,
          provider: r.provider,
        }));
        return {
          laneIdx: li,
          mode: lane.conv.benchmarkingMode || "full-context",
          label: lane.conv.groupLabel || lane.conv.benchmarkingMode || "Unknown",
          responses: resps,
          selectedModel: lane.selectedModel,
        };
      });

      turnRows.push({
        turnIdx: t,
        promptCx,
        promptCy,
        promptContent: ct.prompt.content,
        lanes,
      });

      const maxRespCount = Math.max(1, ...lanes.map(l => l.responses.length));
      currentY = respY + NODE_H + GAP_Y + (maxRespCount > 3 ? 20 : 0);
    }

    return { width: Math.max(800, totalWidth + LEFT_PAD), height: currentY + 60, turnRows, laneOffsets, laneWidths, laneCount };
  }, [isCombined, combinedTurns, groupedConversations]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hover) return;
    setHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  }, [hover]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-md animate-slide-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            {isCombined ? <Layers className="h-4 w-4 text-primary" /> : <GitBranch className="h-4 w-4 text-primary" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">
              {isCombined ? "Combined Conversation Flow" : "Conversation Flow"}
            </h2>
            <p className="text-[10px] text-muted-foreground">
              {isCombined
                ? `${combinedSummary.modes} modes · ${combinedSummary.turns} shared turn${combinedSummary.turns !== 1 ? "s" : ""}`
                : `${turns.length} turn${turns.length !== 1 ? "s" : ""} · hover nodes for details`
              }
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body: left summary + right flow */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: Summary panel ── */}
        <aside className="w-72 shrink-0 border-r border-border overflow-y-auto scrollbar-thin p-5 space-y-5 bg-card/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {isCombined ? "Combined Report" : "Conversation Report"}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={<MessageSquare className="h-3.5 w-3.5 text-primary" />} label="Turns" value={String(isCombined ? combinedSummary.turns : summary.turns)} />
            <StatCard icon={<Hash className="h-3.5 w-3.5 text-metric-warning" />} label="Total Tokens" value={(isCombined ? combinedSummary.totalTokens : summary.totalTokens).toLocaleString()} />
            <StatCard icon={<DollarSign className="h-3.5 w-3.5 text-accent" />} label="Total Cost" value={`$${(isCombined ? combinedSummary.totalCost : summary.totalCost).toFixed(4)}`} />
            <StatCard icon={<Clock className="h-3.5 w-3.5 text-metric-neutral" />} label="Avg Latency" value={`${isCombined ? combinedSummary.avgLatency : summary.avgLatency}ms`} />
          </div>

          {/* Combined mode: per-mode breakdown */}
          {isCombined && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Mode Comparison</p>
              {combinedSummary.modeStats.map((ms) => (
                <div key={ms.mode} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getModeColor(ms.mode) }} />
                    <span className="text-[10px] font-bold text-foreground">{ms.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-muted-foreground">
                    <span>⚡ {ms.avgLatency}ms</span>
                    <span>📊 {ms.totalTokens.toLocaleString()}</span>
                    <span>💰 ${ms.totalCost.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Single-mode specific: fastest + preferred */}
          {!isCombined && summary.fastestResp && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Zap className="h-2.5 w-2.5 text-metric-positive" /> Fastest Response
              </p>
              <p className="text-xs font-bold text-foreground">{summary.fastestResp.model}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{summary.fastestResp.latency}ms · {summary.fastestResp.tokens} tok</p>
            </div>
          )}

          {!isCombined && summary.topModel && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
              <p className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Trophy className="h-2.5 w-2.5" /> Preferred Model
              </p>
              <p className="text-xs font-bold text-foreground">{summary.topModel[0]}</p>
              <p className="text-[10px] text-muted-foreground">Selected {summary.topModel[1]}× as best</p>
            </div>
          )}

          {!isCombined && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Providers Used</p>
              <div className="flex flex-wrap gap-1.5">
                {[...summary.providerSet].map(p => (
                  <span key={p} className="rounded bg-badge px-2 py-0.5 text-[9px] font-semibold text-badge-foreground uppercase tracking-wider">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Turn breakdown */}
          {!isCombined && turns.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Turn Breakdown</p>
              <div className="space-y-1.5">
                {turns.map((turn, i) => {
                  const responses = turn.assistant?.responses ?? [];
                  const bestModel = turn.assistant?.selectedModel;
                  return (
                    <div key={i} className="rounded-md bg-muted/30 px-2.5 py-2 border border-border/50">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-bold text-foreground">Turn {i + 1}</span>
                        {bestModel && (
                          <span className="text-[8px] text-primary font-semibold truncate max-w-[80px]">★ {bestModel}</span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground truncate">{turn.prompt.content}</p>
                      <p className="text-[8px] font-mono text-muted-foreground/70 mt-0.5">{responses.length} model{responses.length !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Combined: shared turn breakdown */}
          {isCombined && combinedTurns.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Shared Turns</p>
              <div className="space-y-1.5">
                {combinedTurns.map((ct, i) => (
                  <div key={i} className="rounded-md bg-muted/30 px-2.5 py-2 border border-border/50">
                    <span className="text-[9px] font-bold text-foreground">Turn {i + 1}</span>
                    <p className="text-[9px] text-muted-foreground truncate mt-0.5">{ct.prompt.content}</p>
                    <div className="flex gap-1 mt-1">
                      {ct.lanes.map((lane, li) => (
                        <span key={li} className="text-[8px] font-mono text-muted-foreground/70">
                          {lane.conv.groupLabel}: {lane.responses.length}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── RIGHT: Flow graph ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto scrollbar-thin"
          onMouseMove={handleMouseMove}
        >
          {/* Single-mode flow */}
          {!isCombined && (
            turns.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No conversation data to visualize yet.
              </div>
            ) : (
              <svg width={svgLayout.width} height={svgLayout.height} className="min-w-full">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {svgLayout.nodes.map((node, nodeIdx) => {
                  const nextNode = svgLayout.nodes[nodeIdx + 1];
                  const isPromptHovered = hover?.type === "prompt" && hover.content === node.promptContent;
                  return (
                    <g key={`turn-${nodeIdx}`}>
                      <circle
                        cx={node.promptCx} cy={node.promptCy} r={PROMPT_R}
                        className="fill-primary/15 stroke-primary"
                        strokeWidth={isPromptHovered ? 3 : 2}
                        onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, type: "prompt", content: node.promptContent })}
                        onMouseLeave={() => setHover(null)}
                        style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                      />
                      <text x={node.promptCx} y={node.promptCy - 8} textAnchor="middle" className="fill-primary font-bold uppercase tracking-wider" fontSize="9">
                        Prompt {nodeIdx + 1}
                      </text>
                      {isPromptHovered && (
                        <text x={node.promptCx} y={node.promptCy + 8} textAnchor="middle" className="fill-foreground" fontSize="8.5">
                          {node.promptContent.length > 22 ? node.promptContent.slice(0, 22) + "…" : node.promptContent}
                        </text>
                      )}

                      {node.responses.map((resp: any) => (
                        <path
                          key={`conn-${nodeIdx}-${resp.name}`}
                          d={`M ${node.promptCx} ${node.promptCy + PROMPT_R} C ${node.promptCx} ${node.promptCy + PROMPT_R + GAP_Y * 0.5}, ${resp.x + NODE_W / 2} ${resp.y - GAP_Y * 0.3}, ${resp.x + NODE_W / 2} ${resp.y}`}
                          fill="none"
                          stroke={resp.isSelected ? resp.color : "hsl(var(--border))"}
                          strokeWidth={resp.isSelected ? 3 : 1.5}
                          strokeDasharray={resp.isSelected ? "none" : "6 4"}
                          opacity={resp.isSelected ? 1 : 0.5}
                          filter={resp.isSelected ? "url(#glow)" : undefined}
                        />
                      ))}

                      {node.responses.map((resp: any) => (
                        <g
                          key={`resp-${nodeIdx}-${resp.name}`}
                          onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, type: "response", content: resp.content, model: resp.name, latency: resp.latency, tokens: resp.tokens, cost: resp.cost, isSelected: resp.isSelected, provider: resp.provider })}
                          onMouseLeave={() => setHover(null)}
                          style={{ cursor: "pointer" }}
                        >
                          <rect x={resp.x} y={resp.y} width={NODE_W} height={NODE_H} rx={10}
                            fill={resp.isSelected ? resp.color : "hsl(var(--card))"} fillOpacity={resp.isSelected ? 0.2 : 1}
                            stroke={resp.color} strokeWidth={resp.isSelected ? 2.5 : 1.5}
                            filter={resp.isSelected ? "url(#glow)" : undefined}
                          />
                          <circle cx={resp.x + 14} cy={resp.y + NODE_H / 2} r={4} fill={resp.color} />
                          <text x={resp.x + 24} y={resp.y + NODE_H / 2 - 6} className="fill-foreground font-bold" fontSize="10">{resp.name}</text>
                          <text x={resp.x + 24} y={resp.y + NODE_H / 2 + 10} className="fill-muted-foreground font-mono" fontSize="8">
                            {resp.latency}ms · {resp.tokens}tok · ${resp.cost.toFixed(4)}
                          </text>
                          {resp.isSelected && (
                            <text x={resp.x + NODE_W - 12} y={resp.y + 14} textAnchor="end" className="fill-primary font-bold uppercase" fontSize="8">★ Best</text>
                          )}
                        </g>
                      ))}

                      {nextNode && (() => {
                        const selectedResp = node.responses.find((r: any) => r.isSelected) ?? node.responses[0];
                        if (!selectedResp) return null;
                        return (
                          <path
                            d={`M ${selectedResp.x + NODE_W / 2} ${selectedResp.y + NODE_H} C ${selectedResp.x + NODE_W / 2} ${selectedResp.y + NODE_H + GAP_Y * 0.5}, ${nextNode.promptCx} ${nextNode.promptCy - PROMPT_R - GAP_Y * 0.3}, ${nextNode.promptCx} ${nextNode.promptCy - PROMPT_R}`}
                            fill="none" stroke={selectedResp.color} strokeWidth={2.5} opacity={0.8} filter="url(#glow)"
                          />
                        );
                      })()}
                    </g>
                  );
                })}
              </svg>
            )
          )}

          {/* Combined-mode flow */}
          {isCombined && (
            combinedTurns.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No conversation data to visualize yet.
              </div>
            ) : (
              <svg width={combinedLayout.width} height={combinedLayout.height} className="min-w-full">
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Lane headers */}
                {'laneOffsets' in combinedLayout && groupedConversations!.map((conv, li) => {
                  const laneX = (combinedLayout as any).laneOffsets[li];
                  const laneW = (combinedLayout as any).laneWidths[li];
                  const modeColor = getModeColor(conv.benchmarkingMode);
                  return (
                    <g key={`lane-header-${li}`}>
                      {/* Lane background stripe */}
                      <rect
                        x={laneX - 8}
                        y={TOP_PAD}
                        width={laneW + 16}
                        height={combinedLayout.height - TOP_PAD - 20}
                        rx={12}
                        fill={modeColor}
                        fillOpacity={0.04}
                        stroke={modeColor}
                        strokeWidth={1}
                        strokeOpacity={0.15}
                        strokeDasharray="8 4"
                      />
                      {/* Lane header label */}
                      <rect x={laneX} y={TOP_PAD + 6} width={laneW} height={LANE_HEADER_H} rx={8} fill={modeColor} fillOpacity={0.12} stroke={modeColor} strokeWidth={1.5} strokeOpacity={0.3} />
                      <circle cx={laneX + 14} cy={TOP_PAD + 6 + LANE_HEADER_H / 2} r={4} fill={modeColor} />
                      <text x={laneX + 24} y={TOP_PAD + 6 + LANE_HEADER_H / 2 + 4} className="fill-foreground font-bold uppercase" fontSize="10" letterSpacing="0.05em">
                        {conv.groupLabel || conv.benchmarkingMode}
                      </text>
                    </g>
                  );
                })}

                {/* Turn rows */}
                {(combinedLayout as any).turnRows?.map((row: any, rowIdx: number) => {
                  const isPromptHovered = hover?.type === "prompt" && hover.content === row.promptContent;
                  const nextRow = (combinedLayout as any).turnRows?.[rowIdx + 1];
                  return (
                    <g key={`comb-turn-${rowIdx}`}>
                      {/* Central shared prompt */}
                      <circle
                        cx={row.promptCx} cy={row.promptCy} r={PROMPT_R}
                        className="fill-primary/15 stroke-primary"
                        strokeWidth={isPromptHovered ? 3 : 2}
                        onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, type: "prompt", content: row.promptContent })}
                        onMouseLeave={() => setHover(null)}
                        style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                      />
                      <text x={row.promptCx} y={row.promptCy - 8} textAnchor="middle" className="fill-primary font-bold uppercase tracking-wider" fontSize="9">
                        Prompt {rowIdx + 1}
                      </text>
                      {isPromptHovered && (
                        <text x={row.promptCx} y={row.promptCy + 8} textAnchor="middle" className="fill-foreground" fontSize="8.5">
                          {row.promptContent.length > 22 ? row.promptContent.slice(0, 22) + "…" : row.promptContent}
                        </text>
                      )}

                      {/* Responses per lane */}
                      {row.lanes.map((lane: any) => {
                        const modeColor = getModeColor(lane.mode);
                        return (
                          <g key={`lane-${lane.laneIdx}`}>
                            {/* Connectors from prompt to each response */}
                            {lane.responses.map((resp: any) => (
                              <path
                                key={`conn-c-${rowIdx}-${lane.laneIdx}-${resp.name}`}
                                d={`M ${row.promptCx} ${row.promptCy + PROMPT_R} C ${row.promptCx} ${row.promptCy + PROMPT_R + GAP_Y * 0.3}, ${resp.x + NODE_W / 2} ${resp.y - GAP_Y * 0.2}, ${resp.x + NODE_W / 2} ${resp.y}`}
                                fill="none"
                                stroke={resp.isSelected ? resp.color : modeColor}
                                strokeWidth={resp.isSelected ? 2.5 : 1}
                                strokeDasharray={resp.isSelected ? "none" : "6 4"}
                                opacity={resp.isSelected ? 0.9 : 0.3}
                                filter={resp.isSelected ? "url(#glow)" : undefined}
                              />
                            ))}

                            {/* Response nodes */}
                            {lane.responses.map((resp: any) => (
                              <g
                                key={`resp-c-${rowIdx}-${lane.laneIdx}-${resp.name}`}
                                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, type: "response", content: resp.content, model: resp.name, latency: resp.latency, tokens: resp.tokens, cost: resp.cost, isSelected: resp.isSelected, provider: resp.provider, mode: lane.label })}
                                onMouseLeave={() => setHover(null)}
                                style={{ cursor: "pointer" }}
                              >
                                <rect x={resp.x} y={resp.y} width={NODE_W} height={NODE_H} rx={10}
                                  fill={resp.isSelected ? resp.color : "hsl(var(--card))"} fillOpacity={resp.isSelected ? 0.15 : 1}
                                  stroke={resp.isSelected ? resp.color : modeColor}
                                  strokeWidth={resp.isSelected ? 2.5 : 1.5}
                                  filter={resp.isSelected ? "url(#glow)" : undefined}
                                />
                                <circle cx={resp.x + 14} cy={resp.y + NODE_H / 2} r={4} fill={resp.color} />
                                <text x={resp.x + 24} y={resp.y + NODE_H / 2 - 6} className="fill-foreground font-bold" fontSize="10">{resp.name}</text>
                                <text x={resp.x + 24} y={resp.y + NODE_H / 2 + 10} className="fill-muted-foreground font-mono" fontSize="8">
                                  {resp.latency}ms · {resp.tokens}tok · ${resp.cost.toFixed(4)}
                                </text>
                                {resp.isSelected && (
                                  <text x={resp.x + NODE_W - 12} y={resp.y + 14} textAnchor="end" className="fill-primary font-bold uppercase" fontSize="8">★ Best</text>
                                )}
                              </g>
                            ))}

                            {/* Connector from selected response to next prompt */}
                            {nextRow && (() => {
                              const sel = lane.responses.find((r: any) => r.isSelected) ?? lane.responses[0];
                              if (!sel) return null;
                              return (
                                <path
                                  d={`M ${sel.x + NODE_W / 2} ${sel.y + NODE_H} C ${sel.x + NODE_W / 2} ${sel.y + NODE_H + GAP_Y * 0.4}, ${nextRow.promptCx} ${nextRow.promptCy - PROMPT_R - GAP_Y * 0.3}, ${nextRow.promptCx} ${nextRow.promptCy - PROMPT_R}`}
                                  fill="none" stroke={modeColor} strokeWidth={2} opacity={0.5} strokeDasharray="4 3"
                                />
                              );
                            })()}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            )
          )}
        </div>
      </div>

      {/* ── Floating hover tooltip ── */}
      {hover && (
        <div
          className="fixed z-[70] pointer-events-none"
          style={{ left: hover.x + 16, top: hover.y - 10, maxWidth: 340 }}
        >
          <div className="rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-3.5 space-y-2">
            {hover.type === "prompt" ? (
              <>
                <p className="text-[9px] font-bold text-primary uppercase tracking-wider">User Prompt</p>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap line-clamp-8">{hover.content}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getModelColor(hover.model ?? "") }} />
                  <span className="text-xs font-bold text-foreground">{hover.model}</span>
                  {hover.provider && (
                    <span className="text-[8px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{hover.provider}</span>
                  )}
                  {hover.isSelected && (
                    <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">★ BEST</span>
                  )}
                </div>
                {hover.mode && (
                  <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: getModeColor(hover.mode) }}>
                    {hover.mode}
                  </p>
                )}
                <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6 font-mono">{hover.content}</p>
                <div className="flex gap-3 pt-1 border-t border-border text-[9px] font-mono text-muted-foreground">
                  <span>⚡ {hover.latency}ms</span>
                  <span>📊 {hover.tokens} tokens</span>
                  <span>💰 ${hover.cost?.toFixed(4)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Small stat card for the summary panel
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold text-foreground font-mono">{value}</p>
    </div>
  );
}
