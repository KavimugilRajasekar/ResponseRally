import { ChatMessage, ModelResponse, AI_PROVIDERS } from "@/lib/types";
import { ResponseCard } from "./ResponseCard";
import { MetricsMatrix } from "./MetricsMatrix";
import { Sparkles, ChevronUp, RefreshCw, Activity, Beaker } from "lucide-react";
import { useState, useEffect, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface ChatThreadProps {
  messages: ChatMessage[];
  onSelectBest: (messageId: string, modelIndex: number) => void;
  onReselectResponse: (messageId: string) => void;
  onRetryModel: (messageId: string, modelName: string) => void;
  isStreaming: boolean;
  streamingResponses: ModelResponse[];
  selectedModels: string[];
  isLoading: boolean;
  mode?: "full-context" | "sliding-window" | "stateless";
  windowSize?: number;
}

// --- Skeleton card shown while waiting for a model's response ---
const SkeletonResponseCard = memo(function SkeletonResponseCard({ modelName }: { modelName: string }) {
  const provider = AI_PROVIDERS.find(p => p.name === modelName);
  const color = provider?.color ?? "hsl(220, 15%, 40%)";

  return (
    <div className="card-elevated flex flex-col h-full min-h-[220px] overflow-hidden animate-pulse">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full ring-2 ring-background shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-bold text-foreground tracking-tight">{modelName}</span>
          {provider && (
            <span className="rounded bg-badge px-1.5 py-0.5 text-[9px] font-semibold text-badge-foreground uppercase tracking-wider shrink-0">
              {provider.provider}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-primary">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">Waiting…</span>
        </div>
      </div>
      <div className="flex-1 p-3 space-y-2">
        <div className="h-2.5 rounded bg-muted/60 w-full" />
        <div className="h-2.5 rounded bg-muted/60 w-[92%]" />
        <div className="h-2.5 rounded bg-muted/60 w-[85%]" />
        <div className="h-2.5 rounded bg-muted/40 w-[78%]" />
        <div className="h-2.5 rounded bg-muted/40 w-[60%]" />
        <div className="mt-4 h-2.5 rounded bg-muted/30 w-full" />
        <div className="h-2.5 rounded bg-muted/30 w-[88%]" />
        <div className="h-2.5 rounded bg-muted/20 w-[70%]" />
      </div>
      <div className="border-t border-border px-3 py-2 bg-muted/20 shrink-0">
        <div className="flex gap-3">
          <div className="h-2 rounded bg-muted/50 w-12" />
          <div className="h-2 rounded bg-muted/50 w-12" />
          <div className="h-2 rounded bg-muted/50 w-10" />
        </div>
        <div className="mt-2 h-6 rounded-control bg-muted/40 w-full" />
      </div>
    </div>
  );
});

// --- MessageBubble (must be defined before ChatThread which uses it) ---
const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  isLoading,
  selectedModels,
  onSelectBest,
  onReselect,
  onRetryModel,
  mode,
  windowSize,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  isLoading: boolean;
  selectedModels: string[];
  onSelectBest: (idx: number) => void;
  onReselect: () => void;
  onRetryModel: (modelName: string) => void;
  mode?: "full-context" | "sliding-window" | "stateless";
  windowSize?: number;
}) {
  const [expanded, setExpanded] = useState(!message.selectedModel);

  useEffect(() => {
    setExpanded(!message.selectedModel);
  }, [message.selectedModel]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 shadow-sm">
            <p className="text-sm text-primary-foreground whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.optimizedPrompt && message.optimizedPrompt !== message.content && (
            <div className="mt-1.5 ml-2 rounded-lg bg-highlight/60 border border-accent/20 px-3 py-2">
              <p className="text-[9px] text-accent-foreground font-semibold uppercase tracking-wider mb-0.5">⚡ Optimized Prompt</p>
              <p className="text-[10px] text-foreground/80 font-mono leading-relaxed">{message.optimizedPrompt}</p>
            </div>
          )}
          {message.attachments?.map((a) => (
            <div key={a.id} className="mt-1 ml-2 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted rounded-md px-2 py-1 w-fit">
              <Sparkles className="h-3 w-3" />
              {a.name}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selected = message.responses?.find((r) => r.isSelected);
  const completedCount = (message.responses ?? []).filter(r => !r.isStreaming).length;
  const lockedModels = message.pendingModels ?? selectedModels;
  const totalExpected = lockedModels.length;
  const isThisMessageLoading = isLoading && (message.responses ?? []).length < totalExpected;

  return (
    <div className="space-y-2">
      {selected && !expanded && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-foreground">{selected.model}</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">Best</span>
              <button onClick={() => { onReselect(); setExpanded(true); }} className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-base font-medium">
                <RefreshCw className="h-3 w-3" /> Re-compare
              </button>
            </div>
            <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
              <div className={cn(
                "prose prose-sm dark:prose-invert max-w-none select-text",
                "prose-p:leading-relaxed prose-p:my-1.5",
                "prose-code:text-[10px] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono",
                "prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-[10px]",
                "text-[11px] text-foreground/90 font-mono"
              )}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selected.response}
                </ReactMarkdown>
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground font-mono px-1">
              <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-metric-positive" />{selected.latency}ms</span>
              <span>{selected.tokens} tokens</span>
              <span>${selected.estimatedCost?.toFixed(4)}</span>
              {selected.tokensPerSecond && <span className="text-primary">{selected.tokensPerSecond.toFixed(1)} tok/s</span>}
            </div>
          </div>
        </div>
      )}

      {(expanded || !selected) && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Benchmark Results</span>
              {isThisMessageLoading ? (
                <span className="text-[10px] text-primary animate-pulse font-medium">
                  {completedCount}/{totalExpected} ready…
                </span>
              ) : (
                message.responses && (
                  <span className="text-[10px] text-muted-foreground">
                    {completedCount}/{message.responses.length} completed
                  </span>
                )
              )}
            </div>
            {selected && (
              <button onClick={() => setExpanded(false)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-base font-medium">
                <ChevronUp className="h-3 w-3" /> Collapse
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2">
            {(message.responses ?? []).map((r, i) => (
              <ResponseCard
                key={r.model}
                data={r}
                onSelect={() => onSelectBest(i)}
                onRetry={() => onRetryModel(r.model)}
                compact
              />
            ))}
            {isThisMessageLoading && lockedModels
              .filter(name => !(message.responses ?? []).some(r => r.model === name))
              .map(name => (
                <SkeletonResponseCard key={`skeleton-${name}`} modelName={name} />
              ))
            }
          </div>

          {!isStreaming && !isThisMessageLoading &&
            (message.responses ?? []).filter(r => !r.isStreaming).length > 1 && (
              <MetricsMatrix
                responses={message.responses!}
                mode={mode}
                windowSize={windowSize}
              />
            )}
        </div>
      )}
    </div>
  );
});

// --- Main ChatThread component ---
export const ChatThread = memo(function ChatThread({
  messages,
  onSelectBest,
  onReselectResponse,
  onRetryModel,
  isStreaming,
  streamingResponses,
  selectedModels,
  isLoading,
  mode,
  windowSize,
}: ChatThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
      <div className="mx-auto max-w-[920px] space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-5 border border-primary/20">
              <Beaker className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">ResponseRally</h2>
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-3">AI Benchmarking Suite</p>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Submit a prompt to benchmark responses from Arcee Trinity, StepFun 3.5, Mistral Large, GLM-4.5 Air, and Nemotron-3 simultaneously. Compare latency, token usage, cost, and compute metrics side-by-side.
            </p>
            <div className="flex flex-wrap gap-2 mt-8 justify-center">
              {["Compare summarization quality", "Test code generation", "Evaluate reasoning depth", "Benchmark translation"].map((s) => (
                <span key={s} className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-foreground cursor-pointer transition-base">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground font-mono">6</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">AI Providers</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-mono">7</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Metrics Tracked</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-mono">∞</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Custom Models</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming}
            isLoading={isLoading}
            selectedModels={selectedModels}
            onSelectBest={(idx) => onSelectBest(msg.id, idx)}
            onReselect={() => onReselectResponse(msg.id)}
            onRetryModel={(modelName) => onRetryModel(msg.id, modelName)}
            mode={mode}
            windowSize={windowSize}
          />
        ))}

        {isStreaming && streamingResponses.length > 0 && (
          <div className="animate-slide-in">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Activity className="h-3.5 w-3.5 text-primary animate-pulse-dot" />
              <span className="text-xs font-semibold text-foreground">
                Benchmarking {streamingResponses.length} models
              </span>
              <span className="text-[10px] text-muted-foreground">
                — {streamingResponses.filter(r => r.isStreaming).length} still streaming
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2">
              {streamingResponses.map((r) => (
                <ResponseCard key={r.model} data={r} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
