import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Key, Eye, EyeOff, Plus, Trash2, BarChart3, TrendingUp, DollarSign, Zap, Trophy, Cpu, ChevronLeft, ChevronRight, Award, Activity, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_PROVIDERS, UserProfile, ProviderConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid, Area, AreaChart
} from "recharts";

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProviders: (providers: ProviderConfig[]) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

const slides = [
  { id: "overview" as const, label: "Performance", icon: BarChart3 },
  { id: "apikeys" as const, label: "AI Providers", icon: Key },
  { id: "limits" as const, label: "Standard Specs", icon: Cpu },
];

export function ProfilePanel({ isOpen, onClose, profile, onUpdateProviders, onUpdateProfile }: ProfilePanelProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<Partial<ProviderConfig>>({
    providerName: "",
    baseUrl: "",
    chatEndpointPath: "/v1/chat/completions",
    apiKey: "",
    authHeaderName: "Authorization",
    authPrefix: "Bearer",
    modelName: "",
    modelType: "chat",
    requestFormatType: "openai",
    supportsStreaming: true,
    supportsSystemRole: true,
    returnsUsage: true,
    returnsCost: false,
    isActive: true,
    color: "hsl(280, 70%, 50%)"
  });

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: activeSlide * trackRef.current.clientWidth, behavior: "smooth" });
    }
  }, [activeSlide]);

  const goTo = useCallback((idx: number) => {
    setActiveSlide(Math.max(0, Math.min(slides.length - 1, idx)));
  }, []);

  // Derived benchmarking data
  const modelEntries = useMemo(() => {
    return Object.entries(profile.modelMetrics)
      .map(([name, m]) => {
        const providerInfo = AI_PROVIDERS.find(p => p.name === name);
        const customProvider = profile.customProviders.find(p => p.providerName === name);
        const color = providerInfo?.color || customProvider?.color || "hsl(280, 70%, 50%)";
        const winRate = m.totalBenchmarked > 0 ? (m.totalWins / m.totalBenchmarked) * 100 : 0;
        return { name, ...m, color, winRate };
      })
      .sort((a, b) => b.totalWins - a.totalWins);
  }, [profile.modelMetrics, profile.customProviders]);

  const winDistributionData = useMemo(() => {
    return modelEntries
      .filter(m => m.totalWins > 0)
      .map(m => ({ name: m.name, value: m.totalWins, color: m.color }));
  }, [modelEntries]);

  const performanceTrendData = useMemo(() => {
    return profile.performanceHistory.slice(-14).map(day => {
      const entry: Record<string, any> = {
        date: new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      };
      Object.entries(day.metrics).forEach(([model, m]) => {
        entry[`${model}_wins`] = m.wins;
        entry[`${model}_uses`] = m.usages;
      });
      return entry;
    });
  }, [profile.performanceHistory]);

  const allModelsInHistory = useMemo(() => {
    const set = new Set<string>();
    profile.performanceHistory.forEach(d => {
      Object.keys(d.metrics).forEach(k => set.add(k));
    });
    return Array.from(set);
  }, [profile.performanceHistory]);

  const totalWins = useMemo(() => modelEntries.reduce((s, m) => s + m.totalWins, 0), [modelEntries]);
  const totalBenchmarks = useMemo(() => modelEntries.reduce((s, m) => s + m.totalBenchmarked, 0), [modelEntries]);

  if (!isOpen) return null;

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addProvider = () => {
    if (config.providerName && config.apiKey && config.modelName) {
      const newProvider: ProviderConfig = {
        ...config as ProviderConfig,
        id: `prov-${Date.now()}`,
      };
      onUpdateProviders([...profile.customProviders, newProvider]);
      setConfig({
        ...config,
        providerName: "",
        apiKey: "",
        modelName: "",
        baseUrl: "",
        chatEndpointPath: "/v1/chat/completions"
      });
    }
  };

  const removeProvider = (id: string) => {
    onUpdateProviders(profile.customProviders.filter((p) => p.id !== id));
  };

  const getModelColor = (name: string) => {
    return AI_PROVIDERS.find(p => p.name === name)?.color
      || profile.customProviders.find(p => p.providerName === name)?.color
      || "hsl(280, 70%, 50%)";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card/90 backdrop-blur-md px-6 py-4 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-sm">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{profile.name}</p>
            <p className="text-[11px] text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">

          {/* ── Slide indicators + nav ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all",
                    activeSlide === i
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                  )}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => goTo(activeSlide - 1)} disabled={activeSlide === 0} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">{activeSlide + 1}/{slides.length}</span>
              <button onClick={() => goTo(activeSlide + 1)} disabled={activeSlide === slides.length - 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Slider track ── */}
          <div ref={trackRef} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex" style={{ width: `${slides.length * 100}%` }}>

              {/* ═══ Slide 1: Performance Dashboard ═══ */}
              <div className="w-full shrink-0 p-6 space-y-6" style={{ width: `${100 / slides.length}%` }}>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={BarChart3} label="Total Benchmarks" value={profile.totalPrompts.toString()} color="text-primary" />
                  <StatCard icon={Trophy} label="Best Selections" value={totalWins.toString()} color="text-metric-positive" />
                  <StatCard icon={Zap} label="Tokens Used" value={profile.totalTokensUsed.toLocaleString()} color="text-metric-warning" />
                  <StatCard icon={DollarSign} label="Total Cost" value={`$${profile.totalCostEstimate.toFixed(2)}`} color="text-accent" />
                </div>

                {/* ── Prompt Optimizer Settings ── */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Prompt Optimizer Settings</h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Choose the AI model used to refine and optimize your prompts before benchmarking.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Optimizer Model</label>
                    <select
                      value={`${profile.optimizerProvider}:${profile.optimizerModelId}`}
                      onChange={(e) => {
                        const [provider, modelId] = e.target.value.split(":");
                        onUpdateProfile({ optimizerProvider: provider, optimizerModelId: modelId });
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                    >
                      <optgroup label="Standard Models">
                        {AI_PROVIDERS.map(p => (
                          <option key={p.modelId} value={`${p.provider}:${p.modelId}`}>
                            {p.name} ({p.provider})
                          </option>
                        ))}
                      </optgroup>
                      {profile.customProviders.length > 0 && (
                        <optgroup label="Custom Providers">
                          {profile.customProviders.map(p => (
                            <option key={p.id} value={`${p.providerName}:${p.modelName}`}>
                              {p.providerName} ({p.modelName})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {/* ── Win Distribution Pie Chart ── */}
                {winDistributionData.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Win Distribution</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-[180px] h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={winDistributionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                              stroke="none"
                            >
                              {winDistributionData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                              formatter={(value: number, name: string) => [`${value} wins (${totalWins > 0 ? ((value / totalWins) * 100).toFixed(1) : 0}%)`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {winDistributionData.map(d => (
                          <div key={d.name} className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-[11px] font-semibold text-foreground truncate flex-1">{d.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{d.value} wins</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Model Win-Rate Comparison Bar Chart ── */}
                {modelEntries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Model Win Rate Comparison</h4>
                    </div>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={modelEntries.map(m => ({
                            name: m.name.length > 12 ? m.name.slice(0, 12) + '…' : m.name,
                            fullName: m.name,
                            winRate: Number(m.winRate.toFixed(1)),
                            wins: m.totalWins,
                            benchmarks: m.totalBenchmarked,
                            fill: m.color
                          }))}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} width={100} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                            formatter={(value: number, _: string, props: any) => [
                              `${value}% (${props.payload.wins}/${props.payload.benchmarks})`,
                              'Win Rate'
                            ]}
                            labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
                          />
                          <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                            {modelEntries.map((m, idx) => (
                              <Cell key={idx} fill={m.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* ── Performance Trend (Area Chart) ── */}
                {performanceTrendData.length > 1 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Usage Trends (Last 14 Days)</h4>
                    </div>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                          />
                          {allModelsInHistory.map(model => (
                            <Area
                              key={model}
                              type="monotone"
                              dataKey={`${model}_uses`}
                              name={`${model} (uses)`}
                              stackId="uses"
                              stroke={getModelColor(model)}
                              fill={getModelColor(model)}
                              fillOpacity={0.3}
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* ── Model Status & Active Period ── */}
                {modelEntries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Model Status & Active Period</h4>
                    </div>
                    <div className="space-y-2.5">
                      {modelEntries.map(m => (
                        <div key={m.name} className="rounded-lg border border-border/50 p-3 bg-muted/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                              <span className="text-xs font-bold text-foreground">{m.name}</span>
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                m.isActive ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                              )}>
                                {m.isActive ? "Active" : "Deactivated"}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {m.totalWins} W / {m.totalBenchmarked} B
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                              <span>Win Ratio</span>
                              <span>{m.winRate.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${m.winRate}%`, backgroundColor: m.color }} />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-[9px] text-muted-foreground font-mono">
                            <span>Active: {new Date(m.activatedAt).toLocaleDateString()}{m.deactivatedAt ? ` → ${new Date(m.deactivatedAt).toLocaleDateString()}` : " (Current)"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recent Best Selections ── */}
                {profile.recentSelections && profile.recentSelections.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Recent Best Selections</h4>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Last {Math.min(profile.recentSelections.length, 10)}</span>
                    </div>
                    <div className="space-y-2">
                      {profile.recentSelections.slice(0, 10).map((sel, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1 rounded bg-metric-positive/10">
                              <Trophy className="h-3 w-3 text-metric-positive" />
                            </div>
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getModelColor(sel.modelName) }} />
                            <span className="text-[11px] font-bold text-foreground truncate max-w-[160px]">{sel.modelName}</span>
                          </div>
                          <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                            {new Date(sel.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Empty state ── */}
                {modelEntries.length === 0 && totalWins === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No benchmarking data yet.</p>
                    <p className="text-xs text-muted-foreground/60">Start a conversation and select "Best Response" to see performance stats here.</p>
                  </div>
                )}
              </div>

              {/* ═══ Slide 2: AI Providers ═══ */}
              <div className="w-full shrink-0 p-6 space-y-6" style={{ width: `${100 / slides.length}%` }}>
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Configured Custom Providers</h4>
                  <div className="space-y-2">
                    {profile.customProviders.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/10 group">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-foreground">{p.providerName}</p>
                            <span className="text-[9px] bg-primary/10 text-primary px-1 rounded uppercase font-bold">{p.requestFormatType}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{p.modelName} @ {p.baseUrl}</p>
                        </div>
                        <button onClick={() => toggleKeyVisibility(p.id)} className="p-1 text-muted-foreground hover:text-foreground">
                          {showKeys[p.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => removeProvider(p.id)} className="p-1 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {profile.customProviders.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-lg">No custom providers configured yet.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-6 text-foreground">
                  <h4 className="text-xs font-bold mb-4 uppercase tracking-wider">Add New Provider Configuration</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 md:col-span-1 space-y-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Basic Information</p>
                      <div className="space-y-2">
                        <input placeholder="Friendly Provider Name" value={config.providerName} onChange={e => setConfig({ ...config, providerName: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs" />
                        <input placeholder="Exact Model Name" value={config.modelName} onChange={e => setConfig({ ...config, modelName: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs" />
                      </div>
                    </div>
                    <div className="col-span-2 md:col-span-1 space-y-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Authentication</p>
                      <div className="space-y-2">
                        <input type="password" placeholder="API Key" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono" />
                        <div className="flex gap-2">
                          <select value={config.authHeaderName} onChange={e => setConfig({ ...config, authHeaderName: e.target.value as any })} className="flex-1 rounded-md border border-input bg-background px-2 py-2 text-[10px]">
                            <option value="Authorization">Header: Authorization</option>
                            <option value="x-api-key">Header: x-api-key</option>
                          </select>
                          <select value={config.authPrefix} onChange={e => setConfig({ ...config, authPrefix: e.target.value as any })} className="w-24 rounded-md border border-input bg-background px-2 py-2 text-[10px]">
                            <option value="Bearer">Prefix: Bearer</option>
                            <option value="None">No Prefix</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Endpoint Information</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Base URL" value={config.baseUrl} onChange={e => setConfig({ ...config, baseUrl: e.target.value })} className="col-span-2 rounded-md border border-input bg-background px-3 py-2 text-xs" />
                        <select value={config.requestFormatType} onChange={e => setConfig({ ...config, requestFormatType: e.target.value as any })} className="rounded-md border border-input bg-background px-2 py-2 text-[10px]">
                          <option value="openai">Format: OpenAI</option>
                          <option value="anthropic">Format: Anthropic</option>
                          <option value="gemini">Format: Gemini</option>
                        </select>
                        <input placeholder="Endpoint Path" value={config.chatEndpointPath} onChange={e => setConfig({ ...config, chatEndpointPath: e.target.value })} className="col-span-3 rounded-md border border-input bg-background px-3 py-2 text-xs" />
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-4 py-2 border-y border-border/50">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.supportsStreaming} onChange={e => setConfig({ ...config, supportsStreaming: e.target.checked })} className="rounded border-input text-primary" />
                        <span className="text-[10px] font-medium">Supports Streaming</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.supportsSystemRole} onChange={e => setConfig({ ...config, supportsSystemRole: e.target.checked })} className="rounded border-input text-primary" />
                        <span className="text-[10px] font-medium">System Role Support</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.returnsUsage} onChange={e => setConfig({ ...config, returnsUsage: e.target.checked })} className="rounded border-input text-primary" />
                        <span className="text-[10px] font-medium">Returns Usage</span>
                      </label>
                    </div>
                    <Button onClick={addProvider} disabled={!config.providerName || !config.apiKey || !config.modelName} className="col-span-2 h-10 font-bold tracking-tight">
                      Save Provider Configuration
                    </Button>
                  </div>
                </div>
              </div>

              {/* ═══ Slide 3: Standard Specs ═══ */}
              <div className="w-full shrink-0 p-6" style={{ width: `${100 / slides.length}%` }}>
                <h4 className="text-xs font-bold text-foreground mb-4 uppercase tracking-wider">Built-in Provider Specifications</h4>
                <div className="space-y-2">
                  {AI_PROVIDERS.map((p) => (
                    <div key={p.modelId} className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/10">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{p.modelId}</p>
                      </div>
                      <div className="flex gap-4 text-[9px] font-mono text-muted-foreground shrink-0">
                        <span>{(p.maxTokens / 1000).toFixed(0)}k ctx</span>
                        <span className="text-primary">{p.provider}</span>
                        <span>{p.costPer1kOutput === 0 ? "Free" : `$${p.costPer1kOutput}/1k`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Dot indicators ── */}
          <div className="flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeSlide === i ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-muted/10">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground font-mono">{value}</p>
    </div>
  );
}
