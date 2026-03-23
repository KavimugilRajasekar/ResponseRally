import { useState, useEffect, useRef, memo } from "react";
import { Clock, Hash, Zap, Check, Copy, DollarSign, Database, AlertCircle, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ModelResponse, AI_PROVIDERS } from "@/lib/types";

const MAX_RETRIES = 5;

/** Resolve a friendly display name from either a stored friendly name or raw modelId. */
function resolveDisplayName(model: string): string {
  const byName = AI_PROVIDERS.find(p => p.name === model);
  if (byName) return byName.name;
  const byModelId = AI_PROVIDERS.find(p => p.modelId === model);
  if (byModelId) return byModelId.name;
  return model;
}

/** Detect if the response is an error message returned by our proxy/aiClient */
function isErrorResponse(text: string): boolean {
  return (
    text.startsWith("Error:") ||
    text.startsWith("error:") ||
    text.includes("HTTP 4") ||
    text.includes("HTTP 5") ||
    text.includes("Failed to fetch") ||
    text === ""
  );
}

/** Extract a human-readable error reason with guidance */
function parseErrorMessage(text: string): { title: string; detail: string } {
  if (text.includes("Invalid model")) {
    return { title: "Invalid Model ID", detail: "The model identifier sent to the API is incorrect. Check your provider configuration." };
  }
  if (text.includes("401") || text.includes("Unauthorized") || text.includes("invalid_api_key")) {
    return { title: "Authentication Failed", detail: "The API key is missing, expired, or incorrect. Check your .env settings." };
  }
  if (text.includes("429") || text.includes("rate limit") || text.includes("Rate limit")) {
    return { title: "Rate Limited", detail: "Too many requests to this provider. Wait a moment before retrying." };
  }
  if (text.includes("402") || text.includes("insufficient_quota")) {
    return { title: "Quota Exceeded", detail: "Your API credits are exhausted. Top up your account to continue." };
  }
  if (text.includes("503") || text.includes("502") || text.includes("overloaded")) {
    return { title: "Provider Unavailable", detail: "The provider's servers are temporarily overloaded. Retrying may help." };
  }
  if (text.includes("400") || text.includes("bad_request")) {
    return { title: "Bad Request", detail: text.replace(/^Error:\s*/i, "") };
  }
  if (text.includes("Failed to fetch") || text.includes("Network")) {
    return { title: "Network Error", detail: "Could not reach the backend proxy. Ensure the server is running." };
  }
  if (text === "") {
    return { title: "Empty Response", detail: "The provider returned an empty response. This can happen with very short prompts or token limits." };
  }
  return { title: "Request Failed", detail: text.replace(/^Error:\s*/i, "") };
}

interface ResponseCardProps {
  data: ModelResponse;
  onSelect?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

export const ResponseCard = memo(function ResponseCard({ data, onSelect, onRetry, compact }: ResponseCardProps) {
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && data.isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [data.response, data.isStreaming]);

  // Reset retry state when the response succeeds after a retry
  useEffect(() => {
    if (!isErrorResponse(data.response) && isRetrying) {
      setIsRetrying(false);
    }
  }, [data.response]);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES || !onRetry) return;
    setRetryCount(c => c + 1);
    setIsRetrying(true);
    onRetry();
  };

  const isError = isErrorResponse(data.response) && !data.isStreaming;
  const error = isError ? parseErrorMessage(data.response) : null;
  const retriesLeft = MAX_RETRIES - retryCount;
  const canRetry = retriesLeft > 0 && !!onRetry;

  return (
    <div className={cn(
      "card-elevated flex flex-col transition-base group overflow-hidden",
      // Max height with scroll: ~420px before scrolling kicks in
      "min-h-[260px] max-h-[480px]",
      data.isSelected && "ring-2 ring-primary/50 shadow-lg",
      compact && "text-xs",
    )}>
      {/* ── Header ── */}
      <div className="border-b border-border px-2.5 py-2 bg-muted/20 shrink-0">
        {/* Row 1: Model name + provider + copy */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-2.5 w-2.5 rounded-full ring-2 ring-background shrink-0" style={{ backgroundColor: data.color }} />
            <span className="text-[11px] font-bold text-foreground tracking-tight truncate" title={resolveDisplayName(data.model)}>
              {resolveDisplayName(data.model)}
            </span>
            <span className="rounded bg-badge px-1 py-0.5 text-[8px] font-semibold text-badge-foreground uppercase tracking-wider shrink-0">
              {data.provider}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {data.isStreaming && (
              <div className="flex items-center gap-1 text-primary">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Live</span>
              </div>
            )}
            {!isError && (
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-muted transition-base text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                title="Copy response"
              >
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
        {/* Row 2: Status indicators (error / retrying) — only when needed */}
        {(isError || isRetrying) && (
          <div className="flex items-center gap-2 mt-1.5">
            {isError && (
              <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="h-2.5 w-2.5" /> Error
              </span>
            )}
            {isRetrying && (
              <div className="flex items-center gap-1 text-primary">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Retrying {retryCount}/{MAX_RETRIES}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Response content — scrollable ── */}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin">
        {isError ? (
          /* Error display */
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-destructive mb-1">{error!.title}</p>
                  <p className="text-[11px] text-foreground/70 leading-relaxed break-words">{error!.detail}</p>
                </div>
              </div>
            </div>

            {canRetry ? (
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-control border border-primary/30 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-base"
              >
                <RefreshCw className="h-3 w-3" />
                Retry ({retriesLeft} attempt{retriesLeft !== 1 ? "s" : ""} left)
              </button>
            ) : retryCount >= MAX_RETRIES ? (
              <p className="text-[10px] text-muted-foreground text-center">Max retries reached for this model.</p>
            ) : null}
          </div>
        ) : (
          /* Markdown-rendered response */
          <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none select-text",
            "prose-p:leading-relaxed prose-p:my-1.5",
            "prose-headings:font-bold prose-headings:tracking-tight prose-headings:my-2",
            "prose-code:text-[10px] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
            // Solid opaque background — prevents blur artifact from card's backdrop-filter
            "prose-pre:bg-[hsl(var(--muted))] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:text-[10px]",
            "prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5",
            "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:italic",
            "prose-table:text-[10px] prose-th:py-1 prose-td:py-1",
            "text-[11px] text-foreground/85",
            compact && "prose-xs",
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.response || (data.isStreaming ? "\u200b" : "")}
            </ReactMarkdown>
            {data.isStreaming && (
              <span className="inline-block w-0.5 h-3.5 bg-primary ml-0.5 animate-pulse-dot" />
            )}
          </div>
        )}
      </div>

      {/* ── Metrics footer ── */}
      <div className="border-t border-border px-3 py-2 bg-muted/20 shrink-0">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
            <Zap className="h-3 w-3 text-metric-positive" />
            <span>{data.latency}ms</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
            <Hash className="h-3 w-3 text-metric-warning" />
            <span>{data.tokens} tok</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
            <Clock className="h-3 w-3 text-metric-neutral" />
            <span>{data.duration}s</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
            <DollarSign className="h-3 w-3 text-accent" />
            <span>${data.estimatedCost?.toFixed(4) ?? "—"}</span>
          </div>
          {data.maxTokens && (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
              <Database className="h-3 w-3" />
              <span>{(data.maxTokens / 1000).toFixed(0)}k</span>
            </div>
          )}
        </div>
        {!isError && (
          <button
            onClick={onSelect}
            className={cn(
              "mt-2 w-full text-[10px] font-semibold px-2 py-1.5 rounded-control transition-base",
              data.isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-primary/10 border border-border"
            )}
          >
            {data.isSelected ? "✓ Selected as Best" : "Select as Best"}
          </button>
        )}
      </div>
    </div>
  );
});
