import { useState } from "react";
import { Send, Plus, X, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INPUT_CHAR_LIMIT, AI_PROVIDERS, ProviderConfig, BenchmarkingSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (prompt: string) => void | Promise<void>;
  isLoading: boolean;
  isLoggedIn: boolean;
  selectedModels: string[];
  onToggleModel: (modelName: string) => void;
  customModels?: string[];
  onAddCustomModel?: (config: ProviderConfig) => void | Promise<void>;
  onRemoveCustomModel?: (providers: ProviderConfig[]) => void | Promise<void>;
  settings: BenchmarkingSettings;
  onUpdateSettings: (settings: BenchmarkingSettings) => void;
}

export function ChatInput({
  onSubmit,
  isLoading,
  isLoggedIn,
  selectedModels,
  onToggleModel,
  customModels = [],
  onAddCustomModel,
  onRemoveCustomModel,
  settings,
  onUpdateSettings,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const handleSubmit = () => {
    if (prompt.trim() && !isLoading && isLoggedIn) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  const handleAddModel = () => {
    if (newModelName.trim() && newApiKey.trim() && onAddCustomModel) {
      const config: ProviderConfig = {
        id: `prov-${Date.now()}`,
        providerName: newModelName.trim(),
        baseUrl: "https://api.openai.com",
        chatEndpointPath: "/v1/chat/completions",
        apiKey: newApiKey.trim(),
        authHeaderName: "Authorization",
        authPrefix: "Bearer",
        modelName: newModelName.trim(),
        modelType: "chat",
        requestFormatType: "openai",
        supportsStreaming: true,
        supportsSystemRole: true,
        returnsUsage: true,
        returnsCost: false,
        isActive: true,
        color: "hsl(280, 70%, 50%)"
      };
      onAddCustomModel(config);
      setNewModelName("");
      setNewApiKey("");
      setShowAddModal(false);
    }
  };

  const charCount = prompt.length;
  const isOverLimit = charCount > INPUT_CHAR_LIMIT;

  const allModels = [
    ...AI_PROVIDERS.map(p => ({ name: p.name, color: p.color, isCustom: false })),
    ...customModels.map(name => ({ name, color: "hsl(280, 70%, 50%)", isCustom: true }))
  ];

  return (
    <div className="border-t border-border bg-card/90 backdrop-blur-sm p-4">
      <div className="mx-auto max-w-[920px]">
        {/* Model selector bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 flex-1">
            <span className="text-[9px] text-muted-foreground whitespace-nowrap font-semibold uppercase tracking-wider">Models:</span>
            {allModels.map((model) => {
              const isSelected = selectedModels.includes(model.name);
              return (
                <button
                  key={model.name}
                  onClick={() => onToggleModel(model.name)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap",
                    isSelected
                      ? "border-primary/40 text-foreground shadow-sm"
                      : "bg-transparent border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                  style={isSelected ? { backgroundColor: `${model.color}15`, borderColor: model.color } : {}}
                >
                  {isSelected && (
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: model.color }} />
                  )}
                  {model.name}
                </button>
              );
            })}
          </div>

          <span className={cn(
            "text-[10px] font-mono whitespace-nowrap",
            isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground"
          )}>
            {charCount.toLocaleString()}/{INPUT_CHAR_LIMIT.toLocaleString()}
          </span>
        </div>

        {/* Input area */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={isLoggedIn ? "Enter a prompt to benchmark across all selected AI models..." : "Sign in to start benchmarking..."}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-base scrollbar-thin"
            rows={3}
            maxLength={INPUT_CHAR_LIMIT}
            disabled={!isLoggedIn}
          />
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading || isOverLimit || !isLoggedIn}
            size="icon"
            className={cn(
              "absolute right-2.5 bottom-2.5 h-9 w-9 rounded-lg transition-all duration-200",
              !isLoggedIn && "bg-muted text-muted-foreground opacity-50 cursor-not-allowed hover:bg-muted"
            )}
            title={!isLoggedIn ? "Sign in to send" : "Run benchmark"}
          >
            {isLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-4">
            <span className="text-[9px] text-muted-foreground">
              <strong>{selectedModels.length}</strong> model{selectedModels.length !== 1 ? 's' : ''} selected
            </span>
            <div className="h-3 w-[1px] bg-border" />
            <div className="flex items-center gap-3">
              {/* Temperature control */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                  {settings.temperature <= 0.3 ? "🎯 Precise" : settings.temperature <= 0.8 ? "⚖️ Balanced" : "🎨 Creative"}
                </span>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={settings.temperature}
                  onChange={e => onUpdateSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-20 h-1 mt-0.5 accent-primary cursor-pointer"
                  title={`Temperature: ${settings.temperature} — controls randomness. Low = predictable, High = creative`}
                />
                <span className="text-[9px] font-mono text-primary w-5">{settings.temperature.toFixed(1)}</span>
              </div>
              <div className="h-3 w-[1px] bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Tokens:</span>
                <select
                  value={settings.maxTokens}
                  onChange={e => onUpdateSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
                  className="bg-transparent text-[9px] font-mono border-none p-0 focus:ring-0 cursor-pointer"
                >
                  <option value="512">512</option>
                  <option value="1024">1k</option>
                  <option value="2048">2k</option>
                  <option value="4096">4k</option>
                </select>
              </div>
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground">
            Shift+Enter for new line
          </span>
        </div>
      </div>

      {/* Add Custom Model Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl animate-slide-in">
            <button onClick={() => setShowAddModal(false)} className="absolute right-4 top-4 p-1 rounded-control text-muted-foreground hover:text-foreground transition-base">
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Key className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold text-foreground">Quick Add Provider</span>
            </div>
            <p className="text-xs text-muted-foreground mb-5">Quickly add an OpenAI-compatible provider. Use the Profile Panel for advanced config.</p>

            {/* Add new model form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Model Name</label>
                <input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="e.g. GPT-4o"
                  className="w-full rounded-control border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">API Key</label>
                <input
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-••••••••••••"
                  type="password"
                  className="w-full rounded-control border border-input bg-background px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button onClick={handleAddModel} disabled={!newModelName.trim() || !newApiKey.trim()} className="w-full h-10 rounded-control font-semibold">
                <Plus className="h-4 w-4 mr-1.5" /> Add Provider
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
