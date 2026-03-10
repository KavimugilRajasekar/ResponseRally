import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BenchmarkingMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Layers, GitMerge, MessageSquarePlus, SlidersHorizontal } from "lucide-react";

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, modes: BenchmarkingMode[], slidingWindowSize?: number) => void;
}

const MODE_INFO: { id: BenchmarkingMode; label: string; desc: string; icon: string; colorVar: string }[] = [
  {
    id: "full-context",
    label: "Full Context Mode",
    desc: "Sends the entire conversation history with every prompt for maximum coherence.",
    icon: "📚",
    colorVar: "mode-full-context",
  },
  {
    id: "sliding-window",
    label: "Sliding Window Mode",
    desc: "Sends only the last N messages as context, balancing relevance and token cost.",
    icon: "🪟",
    colorVar: "mode-sliding-window",
  },
  {
    id: "stateless",
    label: "Stateless Mode",
    desc: "Each prompt is sent in isolation with no prior context — pure single-turn benchmarking.",
    icon: "⚡",
    colorVar: "mode-stateless",
  },
];

const MODE_STYLES: Record<BenchmarkingMode, { border: string; bg: string; ring: string; accent: string }> = {
  "full-context": {
    border: "border-[hsl(var(--mode-full-context)/0.5)]",
    bg: "bg-[hsl(var(--mode-full-context-light))]",
    ring: "ring-[hsl(var(--mode-full-context)/0.3)]",
    accent: "text-[hsl(var(--mode-full-context))]",
  },
  "sliding-window": {
    border: "border-[hsl(var(--mode-sliding-window)/0.5)]",
    bg: "bg-[hsl(var(--mode-sliding-window-light))]",
    ring: "ring-[hsl(var(--mode-sliding-window)/0.3)]",
    accent: "text-[hsl(var(--mode-sliding-window))]",
  },
  "stateless": {
    border: "border-[hsl(var(--mode-stateless)/0.5)]",
    bg: "bg-[hsl(var(--mode-stateless-light))]",
    ring: "ring-[hsl(var(--mode-stateless)/0.3)]",
    accent: "text-[hsl(var(--mode-stateless))]",
  },
};

export function NewChatDialog({ isOpen, onClose, onCreate }: NewChatDialogProps) {
  const [name, setName] = useState("New Benchmarking");
  const [isCombined, setIsCombined] = useState(false);
  const [singleMode, setSingleMode] = useState<BenchmarkingMode>("full-context");
  const [multiModes, setMultiModes] = useState<BenchmarkingMode[]>(["full-context"]);
  const [windowSize, setWindowSize] = useState<number>(5);

  const toggleMulti = (mode: BenchmarkingMode) => {
    setMultiModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const activeModes = isCombined ? multiModes : [singleMode];
  const needsWindowSize = activeModes.includes("sliding-window");

  const handleCreate = () => {
    const modes = isCombined ? multiModes : [singleMode];
    if (modes.length === 0) return;
    const finalWindowSize = needsWindowSize ? Math.max(2, windowSize) : undefined;
    onCreate(name.trim() || "New Benchmarking", modes, finalWindowSize);
    // Reset
    setName("New Benchmarking");
    setIsCombined(false);
    setSingleMode("full-context");
    setMultiModes(["full-context"]);
    setWindowSize(5);
  };

  const selectedCount = isCombined ? multiModes.length : 1;
  const layoutLabel =
    selectedCount === 1
      ? "Single conversation"
      : selectedCount === 2
      ? "Dual parallel benchmarking"
      : "Triple parallel benchmarking";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <MessageSquarePlus className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">New Conversation</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Choose a benchmarking strategy for this session.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Name field */}
          <div className="space-y-1.5">
            <Label htmlFor="conv-name" className="text-xs font-semibold">
              Conversation Name
            </Label>
            <Input
              id="conv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Benchmarking"
              className="h-9 text-sm"
            />
          </div>

          {/* Mode selection */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Benchmarking Mode</Label>

            {!isCombined ? (
              <RadioGroup
                value={singleMode}
                onValueChange={(v) => setSingleMode(v as BenchmarkingMode)}
                className="gap-2"
              >
                {MODE_INFO.map((mode) => {
                  const styles = MODE_STYLES[mode.id];
                  const isSelected = singleMode === mode.id;
                  return (
                    <label
                      key={mode.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-200",
                        isSelected
                          ? cn(styles.border, styles.bg, "shadow-sm ring-1", styles.ring)
                          : "border-border hover:border-muted-foreground/20 hover:bg-muted/30"
                      )}
                    >
                      <RadioGroupItem value={mode.id} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{mode.icon}</span>
                          <span className={cn("text-xs font-semibold", isSelected ? styles.accent : "text-foreground")}>
                            {mode.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {MODE_INFO.map((mode) => {
                  const checked = multiModes.includes(mode.id);
                  const styles = MODE_STYLES[mode.id];
                  return (
                    <label
                      key={mode.id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-200",
                        checked
                          ? cn(styles.border, styles.bg, "shadow-sm ring-1", styles.ring)
                          : "border-border hover:border-muted-foreground/20 hover:bg-muted/30"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMulti(mode.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{mode.icon}</span>
                          <span className={cn("text-xs font-semibold", checked ? styles.accent : "text-foreground")}>
                            {mode.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sliding Window Size — shown when sliding-window is active */}
          {needsWindowSize && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="window-size" className="text-xs font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[hsl(var(--mode-sliding-window))]" />
                Context Window Length
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="window-size"
                  type="number"
                  min={2}
                  max={100}
                  value={windowSize}
                  onChange={(e) => setWindowSize(Math.max(2, parseInt(e.target.value) || 2))}
                  className="h-9 text-sm w-24 border-[hsl(var(--mode-sliding-window)/0.4)] focus-visible:ring-[hsl(var(--mode-sliding-window)/0.3)]"
                />
                <span className="text-[11px] text-muted-foreground">
                  Last <strong className="text-[hsl(var(--mode-sliding-window))]">{windowSize}</strong> messages will be sent as context
                </span>
              </div>
            </div>
          )}

          {/* Combined toggle */}
          <label className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 cursor-pointer transition-all hover:bg-primary/10">
            <Checkbox
              checked={isCombined}
              onCheckedChange={(v) => {
                setIsCombined(!!v);
                if (v && multiModes.length === 0) setMultiModes(["full-context"]);
              }}
              className="shrink-0"
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <GitMerge className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-xs font-semibold text-foreground">Combined Benchmarking</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Select 2–3 modes to run in parallel split panels.
                </p>
              </div>
            </div>
          </label>

          {/* Layout preview */}
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">{layoutLabel}</span>
            {isCombined && multiModes.length > 1 && (
              <div className="flex gap-0.5 ml-auto">
                {multiModes.map((m) => {
                  const styles = MODE_STYLES[m];
                  return (
                    <div
                      key={m}
                      className={cn(
                        "h-5 rounded-sm flex items-center justify-center",
                        styles.bg, styles.border, "border"
                      )}
                      style={{ width: `${60 / multiModes.length}px` }}
                    >
                      <span className={cn("text-[7px] font-bold uppercase", styles.accent)}>
                        {m === "full-context" ? "FC" : m === "sliding-window" ? "SW" : "SL"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create button */}
          <Button
            onClick={handleCreate}
            disabled={isCombined && multiModes.length === 0}
            className="w-full h-10 font-semibold"
          >
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            {isCombined && multiModes.length > 1
              ? `Create ${multiModes.length} Linked Conversations`
              : "Create Conversation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
