import { ModelResponse, BenchmarkingMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Zap, Hash, Clock, DollarSign, BarChart3, HelpCircle } from "lucide-react";

interface MetricsMatrixProps {
    responses: ModelResponse[];
    mode?: BenchmarkingMode;
    windowSize?: number;
}

export function MetricsMatrix({ responses, mode, windowSize }: MetricsMatrixProps) {
    if (!responses || responses.length === 0) return null;

    // Filter out any responses that don't have metrics yet (though they almost always will)
    const validResponses = responses.filter(r => r.latency > 0);

    if (validResponses.length === 0) return null;

    return (
        <div className="mt-8 animate-slide-in">
            <div className="flex items-center gap-2 mb-4 px-1">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Performance Matrix Comparison</h3>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-muted/30 border-b border-border">
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Model</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Latency</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">
                                <div className="flex items-center justify-end gap-1 group relative">
                                    Tokens
                                    <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-2 w-48 hidden group-hover:block z-50">
                                        <div className="bg-popover text-popover-foreground text-[9px] p-2 rounded-lg border border-border shadow-md normal-case font-normal leading-relaxed">
                                            {mode === "full-context" && "Full Context: Includes all previous turns in history."}
                                            {mode === "sliding-window" && `Sliding Window: Includes last ${windowSize} turns.`}
                                            {mode === "stateless" && "Stateless: Only current prompt and response."}
                                            {!mode && "Total tokens returned by the provider usage metadata."}
                                        </div>
                                    </div>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Tokens/s</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Cost</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {validResponses.map((r) => {
                            const tokensPerSec = r.tokensPerSecond || (r.duration > 0 ? (r.tokens / r.duration).toFixed(1) : "—");

                            return (
                                <tr key={r.model} className={cn(
                                    "hover:bg-muted/10 transition-colors",
                                    r.isSelected && "bg-primary/5"
                                )}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                                            <span className="text-xs font-semibold text-foreground">{r.model}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-foreground">
                                            <Zap className="h-3 w-3 text-metric-positive" />
                                            {r.latency}ms
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-muted-foreground">
                                            <Hash className="h-3 w-3 text-metric-warning" />
                                            {r.tokens}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-muted-foreground">
                                            <Clock className="h-3 w-3 text-metric-neutral" />
                                            {tokensPerSec}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-foreground font-bold">
                                            <DollarSign className="h-3 w-3 text-accent" />
                                            {r.estimatedCost === 0 ? "Free" : `$${(r.estimatedCost ?? 0).toFixed(6)}`}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
