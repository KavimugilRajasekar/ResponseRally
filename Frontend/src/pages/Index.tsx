import { useState, useCallback, useRef, useEffect } from "react";
import { Menu, User, TrendingUp, GitBranch } from "lucide-react";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { ChatThread } from "@/components/ChatThread";
import { ChatInput } from "@/components/ChatInput";
import { AuthModal } from "@/components/AuthModal";
import { ProfilePanel } from "@/components/ProfilePanel";
import { ConversationFlowDialog } from "@/components/ConversationFlowDialog";
import { NewChatDialog } from "@/components/NewChatDialog";
import { ChatMessage, Conversation, ModelResponse, UserProfile, ProviderConfig, AI_PROVIDERS, BenchmarkingSettings, BenchmarkingMode } from "@/lib/types";
import { simulateStreaming, generateMockResponses } from "@/lib/mockData";
import { executeBenchmark, executeProxyBenchmark, optimizePromptWithAI } from "@/lib/aiClient";
import { cn } from "@/lib/utils";

const Index = () => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(AI_PROVIDERS.map(p => p.name));

  // Persistence: Check for token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const { user } = await response.json();
          setIsLoggedIn(true);

          // Normalize metrics from MongoDB Map to plain object
          const modelWins = user.modelWins instanceof Map
            ? Object.fromEntries(user.modelWins)
            : (user.modelWins || {});

          const modelMetrics = user.modelMetrics instanceof Map
            ? Object.fromEntries(user.modelMetrics)
            : (user.modelMetrics || {});

          const performanceHistory = Array.isArray(user.performanceHistory)
            ? user.performanceHistory.map((h: any) => ({
              date: h.date,
              metrics: h.metrics instanceof Map ? Object.fromEntries(h.metrics) : (h.metrics || {})
            }))
            : [];

          setProfile({
            id: user.id || user._id || "",
            email: user.email || "",
            name: user.name || "",
            customProviders: user.customProviders || [],
            totalPrompts: user.totalPrompts || 0,
            totalTokensUsed: user.totalTokensUsed || 0,
            totalCostEstimate: user.totalCostEstimate || 0,
            favoriteModel: user.favoriteModel || "",
            modelWins,
            modelMetrics,
            performanceHistory,
            optimizerModelId: user.optimizerModelId || "arcee-ai/trinity-large-preview:free",
            optimizerProvider: user.optimizerProvider || "OpenRouter",
            recentSelections: user.recentSelections || [],
          });

          // Initialize selected models with standard + custom active ones
          // Initialize selected models with standard + custom active ones (filtering out deactivated)
          const customModelNames = user.customProviders
            ?.filter((k: any) => k.isActive)
            .map((k: any) => k.providerName) || [];

          const allPotentialModels = [...AI_PROVIDERS.map(p => p.name), ...customModelNames];
          const activeModels = allPotentialModels.filter(name => {
            const metrics = modelMetrics[name];
            return metrics ? metrics.isActive !== false : true; // Default to true if no metrics yet
          });

          setSelectedModels(activeModels);

          loadConversations();
        } else if (response.status === 401) {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Initial auth check failed:', error);
      }
    };
    checkAuth();
  }, []);

  const [showProfile, setShowProfile] = useState(false);
  const [showFlowDialog, setShowFlowDialog] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    id: "",
    email: "",
    name: "",
    customProviders: [],
    totalPrompts: 0,
    totalTokensUsed: 0,
    totalCostEstimate: 0,
    favoriteModel: "",
    modelWins: {},
    modelMetrics: {},
    performanceHistory: [],
    optimizerModelId: "arcee-ai/trinity-large-preview:free",
    optimizerProvider: "OpenRouter",
  });

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  // Benchmarking state
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponses, setStreamingResponses] = useState<ModelResponse[]>([]);
  const [benchmarkingSettings, setBenchmarkingSettings] = useState<BenchmarkingSettings>({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
    streamingEnabled: true,
  });
  const cancelRef = useRef<(() => void) | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Helper to normalize conversation data from MongoDB
  const normalizeConv = (c: any): Conversation => ({
    ...c,
    id: c._id || c.id,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    benchmarkingMode: c.benchmarkingMode,
    groupId: c.groupId,
    groupLabel: c.groupLabel,
    slidingWindowSize: c.slidingWindowSize,
    messages: (c.messages || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  });

  const activeConv = conversations.find((c) => c.id === activeConvId || c._id === activeConvId);

  // Load conversations from backend on login
  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const { conversations: convs } = await response.json();
        setConversations(convs.map(normalizeConv));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleToggleModel = (modelName: string) => {
    setSelectedModels(prev =>
      prev.includes(modelName)
        ? prev.filter(m => m !== modelName)
        : [...prev, modelName]
    );
  };

  const handleAddCustomModel = async (provider: ProviderConfig) => {
    // Add to profile locally
    const updatedProviders = [...profile.customProviders, provider];
    setProfile(prev => ({
      ...prev,
      customProviders: updatedProviders
    }));

    // Update selected models to include the new one
    setSelectedModels(prev => [...prev, provider.providerName]);

    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            customProviders: updatedProviders
          })
        });
      } catch (error) {
        console.error('Failed to persist custom provider:', error);
      }
    }
  };

  const handleUpdateCustomProviders = async (providers: ProviderConfig[]) => {
    setProfile(prev => ({ ...prev, customProviders: providers }));

    // Update selected models to filter out removed ones
    setSelectedModels(prev => {
      const standardNames = AI_PROVIDERS.map(p => p.name as string);
      const activeCustomNames = providers.filter(p => p.isActive).map(p => p.providerName);
      return prev.filter(name => standardNames.includes(name) || activeCustomNames.includes(name));
    });

    const token = localStorage.getItem('token');
    if (token) {
      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customProviders: providers })
        });
      } catch (error) {
        console.error('Failed to update custom providers:', error);
      }
    }
  };

  const handleLogin = (userData: any) => {
    setIsLoggedIn(true);
    setShowAuth(false);

    // Normalize metrics from MongoDB Map to plain object
    const modelWins = userData.modelWins instanceof Map
      ? Object.fromEntries(userData.modelWins)
      : (userData.modelWins || {});

    const modelMetrics = userData.modelMetrics instanceof Map
      ? Object.fromEntries(userData.modelMetrics)
      : (userData.modelMetrics || {});

    const performanceHistory = Array.isArray(userData.performanceHistory)
      ? userData.performanceHistory.map((h: any) => ({
        date: h.date,
        metrics: h.metrics instanceof Map ? Object.fromEntries(h.metrics) : (h.metrics || {})
      }))
      : [];

    setProfile({
      id: userData.id || userData._id || "",
      email: userData.email || userData.email || "",
      name: userData.name || "",
      customProviders: userData.customProviders || [],
      totalPrompts: userData.totalPrompts || 0,
      totalTokensUsed: userData.totalTokensUsed || 0,
      totalCostEstimate: userData.totalCostEstimate || 0,
      favoriteModel: userData.favoriteModel || "",
      modelWins,
      modelMetrics,
      performanceHistory,
      optimizerModelId: userData.optimizerModelId || "arcee-ai/trinity-large-preview:free",
      optimizerProvider: userData.optimizerProvider || "OpenRouter",
    });

    const customModelNames = userData.customProviders
      ? userData.customProviders.filter((p: any) => p.isActive).map((p: any) => p.providerName)
      : [];

    const allPotentialModels = [...AI_PROVIDERS.map((p: any) => p.name), ...customModelNames];
    const activeModels = allPotentialModels.filter(name => {
      const metrics = modelMetrics[name];
      return metrics ? metrics.isActive !== false : true;
    });

    setSelectedModels(activeModels);

    // Save JWT token for session persistence
    if (userData.token) {
      localStorage.setItem('token', userData.token);
    }
    loadConversations();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setShowAuth(false);
    setActiveConvId(null);
    setConversations([]);
    setProfile({
      id: "",
      email: "",
      name: "",
      customProviders: [],
      totalPrompts: 0,
      totalTokensUsed: 0,
      totalCostEstimate: 0,
      favoriteModel: "",
      modelWins: {},
      modelMetrics: {},
      performanceHistory: [],
      optimizerModelId: "arcee-ai/trinity-large-preview:free",
      optimizerProvider: "OpenRouter",
      recentSelections: [],
    });
  };

  const handleNewChat = useCallback(() => {
    setShowNewChatDialog(true);
  }, []);

  const handleCreateChat = useCallback(async (name: string, modes: BenchmarkingMode[], slidingWindowSize?: number) => {
    setShowNewChatDialog(false);
    const token = localStorage.getItem('token');
    if (!token) return;

    const groupId = modes.length > 1 ? `group-${Date.now()}` : undefined;
    const modeLabels: Record<BenchmarkingMode, string> = {
      "full-context": "Full Context",
      "sliding-window": "Sliding Window",
      "stateless": "Stateless",
    };

    const createdConvs: Conversation[] = [];

    for (const mode of modes) {
      const title = modes.length > 1 ? `${name} — ${modeLabels[mode]}` : name;
      try {
        console.log('Sending creation request:', { mode, title, groupId, slidingWindowSize });
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            title,
            messages: [],
            benchmarkingMode: mode,
            groupId,
            groupLabel: modeLabels[mode],
            slidingWindowSize: mode === "sliding-window" ? slidingWindowSize : undefined
          })
        });
        if (response.ok) {
          const { conversation } = await response.json();
          const norm = normalizeConv(conversation);
          createdConvs.push(norm);
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        const fallback: Conversation = {
          id: `conv-${Date.now()}-${mode}`,
          title: modes.length > 1 ? `${name} — ${modeLabels[mode]}` : name,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          benchmarkingMode: mode,
          groupId,
          groupLabel: modeLabels[mode],
          slidingWindowSize: mode === "sliding-window" ? slidingWindowSize : undefined,
        };
        createdConvs.push(fallback);
      }
    }

    setConversations(prev => [...createdConvs, ...prev]);
    setActiveConvId(createdConvs[0]?.id ?? null);
  }, []);

  const handleRenameConv = useCallback(async (id: string, title: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });

      if (response.ok) {
        const { conversation } = await response.json();
        const norm = normalizeConv(conversation);
        setConversations((prev) =>
          prev.map((c) => (c.id === id || c._id === id ? norm : c))
        );
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      setConversations((prev) =>
        prev.map((c) => (c.id === id || c._id === id ? { ...c, title } : c))
      );
    }
  }, []);

  const handleDeleteConv = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id && c._id !== id));
        if (activeConvId === id) setActiveConvId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setConversations((prev) => prev.filter((c) => c.id !== id && c._id !== id));
      if (activeConvId === id) setActiveConvId(null);
    }
  }, [activeConvId]);

  const handleSubmit = useCallback(async (prompt: string, targetId?: string, skipLoading?: boolean) => {
    if (cancelRef.current) cancelRef.current();

    let convId = targetId || activeConvId;
    const token = localStorage.getItem('token');

    // Start by showing the user's message immediately for responsiveness
    let currentConversation: Conversation | undefined;
    let currentMessages: ChatMessage[] = [];

    // We need to know who we are talking to BEFORE we start the benchmark
    // If it's a new conversation, we create it first
    if (!convId) {
      const newConvTitle = prompt.slice(0, 40) + (prompt.length > 40 ? "..." : "");
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: newConvTitle,
            messages: [],
            benchmarkingMode: 'full-context'
          })
        });

        if (response.ok) {
          const { conversation } = await response.json();
          const norm = normalizeConv(conversation);
          setConversations((prev) => [norm, ...prev]);
          convId = norm.id;
          if (!targetId) setActiveConvId(convId);
          currentConversation = norm;
          currentMessages = norm.messages || [];
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        const fallbackConv: Conversation = {
          id: `conv-${Date.now()}`,
          title: newConvTitle,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          benchmarkingMode: 'full-context'
        };
        setConversations((prev) => [fallbackConv, ...prev]);
        convId = fallbackConv.id;
        if (!targetId) setActiveConvId(convId);
        currentConversation = fallbackConv;
        currentMessages = [];
      }
    } else {
      // Find the conversation in the CURRENT array if possible
      // Note: This still uses the 'conversations' from the closure,
      // but we'll double-check it against the latest state inside updateActiveMessages if needed.
      currentConversation = conversations.find(c => (c.id === convId || c._id === convId));
      currentMessages = currentConversation?.messages || [];
    }

    if (!currentConversation) {
      console.error("Could not find conversation context for", convId);
      setIsLoading(false);
      return;
    }

    const mode = currentConversation.benchmarkingMode || "full-context";
    const windowSize = currentConversation.slidingWindowSize;
    console.log(`Starting benchmark for ${convId} in mode: ${mode}`);

    // Start by showing the user's message immediately for responsiveness
    const tempUserMsgId = `msg-${Date.now()}-temp-${convId}`;
    const initialUserMsg: ChatMessage = {
      id: tempUserMsgId,
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };

    // Helper to update messages in state
    const updateActiveMessages = (updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          (c.id === convId || c._id === convId)
            ? { ...c, messages: updater(c.messages), updatedAt: new Date() }
            : c
        )
      );
    };

    updateActiveMessages(msgs => [...msgs, initialUserMsg]);

    if (!skipLoading) {
      setIsLoading(true);
      setStreamingResponses([]);
    }

    // 1. Perform AI Prompt Optimization
    const optimizedPrompt = await optimizePromptWithAI(
      prompt,
      token,
      profile.optimizerModelId,
      profile.optimizerProvider
    );

    // Update the user message once optimized
    const finalUserMsg: ChatMessage = { ...initialUserMsg, optimizedPrompt: optimizedPrompt !== prompt ? optimizedPrompt : undefined };

    // 2. Prepare Assistant Response with results
    const assistantMsgId = `msg-${Date.now()}-resp-${convId}`;
    const newAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      responses: [],
      benchmarkingSettings: { ...benchmarkingSettings },
      pendingModels: [...selectedModels],
    };

    // Update state to include optimized user message and assistant message
    updateActiveMessages(msgs => msgs.map(m => m.id === tempUserMsgId ? finalUserMsg : m).concat(newAssistantMsg));

    // Filter to selected models
    const activeModels = selectedModels.map(name => {
      const standard = AI_PROVIDERS.find(p => p.name === name);
      const custom = profile.customProviders.find(p => p.providerName === name);
      return { name, standard, custom };
    });

    // Determine history based on benchmarking mode
    let historyToUse = currentMessages;

    if (mode === "stateless") {
      console.log("Stateless mode: Clearing history");
      historyToUse = [];
    } else if (mode === "sliding-window" && windowSize) {
      console.log(`Sliding window mode: Using last ${windowSize} turns`);
      // Each "turn" is 2 messages (user + assistant)
      const messageCount = windowSize * 2;
      historyToUse = currentMessages.slice(-messageCount);
    }

    // Execute benchmarks in parallel
    const benchmarkPromises = activeModels.map(async (model) => {
      let result: ModelResponse;
      const contextMessages = [...historyToUse, { role: "user", content: optimizedPrompt }].map(m => ({ role: m.role, content: m.content }));

      if (model.custom) {
        // Route custom models through the server proxy to avoid CORS issues
        result = await executeProxyBenchmark(
          model.custom.providerName,
          model.custom.modelName,
          model.custom.color || "hsl(0, 0%, 50%)",
          model.custom.providerName,
          contextMessages,
          benchmarkingSettings,
          token,
          {
            baseUrl: model.custom.baseUrl,
            endpoint: model.custom.chatEndpointPath,
            apiKey: model.custom.apiKey,
          }
        );
      } else if (model.standard) {
        try {
          result = await executeProxyBenchmark(
            model.standard.provider,
            model.standard.modelId,
            model.standard.color,
            model.standard.name,
            contextMessages,
            benchmarkingSettings,
            token
          );

          if (model.standard.costPer1kOutput) {
            result.estimatedCost = ((result.tokens || 0) / 1000) * model.standard.costPer1kOutput;
          }
        } catch (error: any) {
          console.warn(`Falling back to mock for ${model.standard.name} due to:`, error.message);
          result = await new Promise<ModelResponse>((resolve) => {
            simulateStreaming(
              (updated) => setStreamingResponses(updated),
              () => {
                const finalMocks = generateMockResponses([model.name]);
                resolve(finalMocks[0] || {
                  model: model.name,
                  provider: model.standard?.provider || "AI",
                  color: model.standard?.color || "#ccc",
                  response: "Response unavailable for " + model.name,
                  latency: 0,
                  tokens: 0,
                  duration: 0,
                  isStreaming: false,
                });
              },
              [model.name],
              mode,
              currentMessages,
              windowSize,
              prompt
            );
          });
        }
      } else {
        result = {
          model: model.name,
          provider: "Unknown",
          color: "#ccc",
          response: "Provider configuration not found.",
          latency: 0,
          tokens: 0,
          duration: 0,
          isStreaming: false,
        };
      }

      // Update the message's responses in state as they arrive
      updateActiveMessages(msgs => msgs.map(m =>
        m.id === assistantMsgId ? { ...m, responses: [...(m.responses || []), result] } : m
      ));

      return result;
    });

    try {
      const finalResults = await Promise.all(benchmarkPromises);
      if (!skipLoading) setIsLoading(false);

      // Final persistence
      if (token && convId) {
        // We'll fetch the most current metadata fields just before saving
        // This avoids race conditions where state might be stale
        fetch(`/api/conversations/${convId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            messages: [...currentMessages, finalUserMsg, { ...newAssistantMsg, responses: finalResults }],
            benchmarkingMode: mode,
            groupId: currentConversation.groupId,
            groupLabel: currentConversation.groupLabel,
            slidingWindowSize: windowSize
          })
        }).catch(e => console.error('Failed to update conversation:', e));
      }

      // Update profile stats
      const totalTokens = finalResults.reduce((s, r) => s + (r.tokens || 0), 0);
      const totalCost = finalResults.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);

      setProfile((prevProfile) => {
        const today = new Date().toISOString().split('T')[0];
        const newModelMetrics = { ...prevProfile.modelMetrics };
        const newHistory = [...prevProfile.performanceHistory];

        // Find or create today's snapshot
        let dailyIdx = newHistory.findIndex(h => h.date === today);
        if (dailyIdx === -1) {
          newHistory.push({ date: today, metrics: {} });
          dailyIdx = newHistory.length - 1;
        }

        finalResults.forEach(r => {
          // Update model metrics
          const m = newModelMetrics[r.model] || {
            totalBenchmarked: 0,
            totalWins: 0,
            activatedAt: new Date().toISOString(),
            isActive: true
          };
          m.totalBenchmarked += 1;
          newModelMetrics[r.model] = m;

          // Update daily usage
          const daily = { ...newHistory[dailyIdx].metrics };
          const modelDaily = daily[r.model] || { wins: 0, usages: 0 };
          modelDaily.usages += 1;
          daily[r.model] = modelDaily;
          newHistory[dailyIdx].metrics = daily;
        });

        const updatedProfile = {
          ...prevProfile,
          totalPrompts: prevProfile.totalPrompts + 1,
          totalTokensUsed: prevProfile.totalTokensUsed + totalTokens,
          totalCostEstimate: prevProfile.totalCostEstimate + totalCost,
          modelMetrics: newModelMetrics,
          performanceHistory: newHistory
        };

        if (token && updatedProfile.id) {
          fetch(`/api/conversations/update-stats/${updatedProfile.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              totalPrompts: updatedProfile.totalPrompts,
              totalTokensUsed: updatedProfile.totalTokensUsed,
              totalCostEstimate: updatedProfile.totalCostEstimate,
              modelWins: updatedProfile.modelWins,
              favoriteModel: updatedProfile.favoriteModel,
              modelMetrics: updatedProfile.modelMetrics,
              performanceHistory: updatedProfile.performanceHistory,
              recentSelections: updatedProfile.recentSelections
            })
          }).catch(e => console.error('Failed to update stats:', e));
        }

        return updatedProfile;
      });
    } catch (error) {
      console.error("Benchmark failed:", error);
      if (!skipLoading) setIsLoading(false);
    }
  }, [activeConvId, conversations, profile, selectedModels, benchmarkingSettings]);

  const handleSelectBest = useCallback(async (messageId: string, modelIndex: number) => {
    // In combined mode, the messageId may belong to any conversation in the group — find the right one
    const targetConv = conversations.find(c => c.messages.some(m => m.id === messageId));
    if (!targetConv) return;
    const targetConvId = targetConv.id || targetConv._id;

    let selectedModelName = "";
    const updatedMessages = targetConv.messages.map((m) => {
      if (m.id !== messageId || !m.responses) return m;
      const updated = m.responses.map((r, i) => ({ ...r, isSelected: i === modelIndex }));
      selectedModelName = updated[modelIndex].model;
      return { ...m, responses: updated, selectedModel: selectedModelName };
    });

    if (selectedModelName) {
      setProfile((p) => {
        const today = new Date().toISOString().split('T')[0];
        const newMetrics = { ...p.modelMetrics };
        const newHistory = [...p.performanceHistory];

        // Update total wins
        const winCount = (newMetrics[selectedModelName]?.totalWins || 0) + 1;
        newMetrics[selectedModelName] = {
          ...(newMetrics[selectedModelName] || {
            totalBenchmarked: 0,
            activatedAt: new Date().toISOString(),
            isActive: true
          }),
          totalWins: winCount
        };

        // Update daily wins
        let dailyIdx = newHistory.findIndex(h => h.date === today);
        if (dailyIdx === -1) {
          newHistory.push({ date: today, metrics: {} });
          dailyIdx = newHistory.length - 1;
        }
        const daily = { ...newHistory[dailyIdx].metrics };
        const modelDaily = daily[selectedModelName] || { wins: 0, usages: 0 };
        modelDaily.wins += 1;
        daily[selectedModelName] = modelDaily;
        newHistory[dailyIdx].metrics = daily;

        const newRecent = [
          {
            conversationId: activeConvId || "",
            modelName: selectedModelName,
            timestamp: new Date().toISOString()
          },
          ...(p.recentSelections || [])
        ].slice(0, 10);

        // Recalculate favorite model based on total wins across all models
        const topModel = Object.entries(newMetrics)
          .sort(([, a], [, b]) => b.totalWins - a.totalWins)[0]?.[0] || selectedModelName;

        const updatedProfile = {
          ...p,
          favoriteModel: topModel,
          modelWins: { ...p.modelWins, [selectedModelName]: (p.modelWins[selectedModelName] || 0) + 1 },
          modelMetrics: newMetrics,
          performanceHistory: newHistory,
          recentSelections: newRecent
        };

        // Persist stats update
        const token = localStorage.getItem('token');
        if (token && updatedProfile.id) {
          fetch(`/api/conversations/update-stats/${updatedProfile.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              totalPrompts: updatedProfile.totalPrompts,
              totalTokensUsed: updatedProfile.totalTokensUsed,
              totalCostEstimate: updatedProfile.totalCostEstimate,
              modelWins: updatedProfile.modelWins,
              favoriteModel: updatedProfile.favoriteModel,
              modelMetrics: updatedProfile.modelMetrics,
              performanceHistory: updatedProfile.performanceHistory,
              recentSelections: updatedProfile.recentSelections
            })
          }).catch(e => console.error('Failed to update stats:', e));
        }

        return updatedProfile;
      });
    }

    setConversations((prev) =>
      prev.map((c) =>
        (c.id === targetConvId || c._id === targetConvId)
          ? { ...c, messages: updatedMessages }
          : c
      )
    );

    try {
      const token = localStorage.getItem('token');
      if (token && targetConvId) {
        await fetch(`/api/conversations/${targetConvId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            messages: updatedMessages
          })
        });
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  }, [conversations]);

  const handleReselectResponse = useCallback(async (messageId: string) => {
    const targetConv = conversations.find(c => c.messages.some(m => m.id === messageId));
    if (!targetConv) return;
    const targetConvId = targetConv.id || targetConv._id;

    const updatedMessages = targetConv.messages.map((m) => {
      if (m.id !== messageId || !m.responses) return m;
      return { ...m, responses: m.responses.map((r) => ({ ...r, isSelected: false })), selectedModel: undefined };
    });

    setConversations((prev) =>
      prev.map((c) =>
        (c.id === targetConvId || c._id === targetConvId)
          ? { ...c, messages: updatedMessages }
          : c
      )
    );

    try {
      const token = localStorage.getItem('token');
      if (token && targetConvId) {
        await fetch(`/api/conversations/${targetConvId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            messages: updatedMessages
          })
        });
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  }, [conversations]);

  // Retry a single failed model for a specific message
  const handleRetryModel = useCallback(async (messageId: string, modelName: string) => {
    const targetConv = conversations.find(c => c.messages.some(m => m.id === messageId));
    if (!targetConv) return;

    const targetMsg = targetConv.messages.find(m => m.id === messageId);
    if (!targetMsg) return;

    // Find the model config
    const standard = AI_PROVIDERS.find(p => p.name === modelName);
    const custom = profile.customProviders.find(p => p.providerName === modelName);
    const token = localStorage.getItem('token');

    // Build the message history up to (but not including) the assistant message we're retrying
    const userMessages = targetConv.messages
      .filter(m => m.id !== messageId)
      .map(m => ({ role: m.role, content: m.content }));

    // The user prompt for this turn is the message just before the assistant message
    const mode = targetConv.benchmarkingMode || "full-context";
    const windowSize = targetConv.slidingWindowSize;

    let historyToUse = targetConv.messages.filter(m => m.id !== messageId);
    if (mode === "stateless") {
      historyToUse = [];
    } else if (mode === "sliding-window" && windowSize) {
      historyToUse = historyToUse.slice(-(windowSize * 2));
    }

    const userPrompt = [...targetConv.messages]
      .reverse()
      .find(m => m.role === 'user' && m.id !== messageId);
    const contextMessages = userPrompt
      ? [...historyToUse.filter(m => m.id !== userPrompt.id), { role: 'user', content: userPrompt.content }]
      : historyToUse.map(m => ({ role: m.role, content: m.content }));

    let result: ModelResponse;
    try {
      if (standard) {
        result = await executeProxyBenchmark(
          standard.provider,
          standard.modelId,
          standard.color,
          standard.name,
          contextMessages,
          targetMsg.benchmarkingSettings || benchmarkingSettings,
          token
        );
      } else if (custom) {
        result = await executeProxyBenchmark(
          custom.providerName,
          custom.modelName,
          custom.color || "hsl(0, 0%, 50%)",
          custom.providerName,
          contextMessages,
          targetMsg.benchmarkingSettings || benchmarkingSettings,
          token,
          {
            baseUrl: custom.baseUrl,
            endpoint: custom.chatEndpointPath,
            apiKey: custom.apiKey,
          }
        );
      } else {
        return;
      }
    } catch (err: any) {
      result = {
        model: modelName,
        provider: standard?.provider || custom?.providerName || 'Unknown',
        color: standard?.color || custom?.color || '#ccc',
        response: `Error: ${err.message}`,
        latency: 0,
        tokens: 0,
        duration: 0,
        isStreaming: false,
      };
    }

    const retryConvId = targetConv.id || targetConv._id;
    // Replace the error response in state
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== retryConvId && c._id !== retryConvId) return c;
        return {
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== messageId || !m.responses) return m;
            return {
              ...m,
              responses: m.responses.map(r => r.model === modelName ? result : r),
            };
          }),
        };
      })
    );
  }, [conversations, profile, benchmarkingSettings]);

  // Scroll to bottom
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length, streamingResponses.length]);

  // Determine if active conv is part of a combined group
  const activeGroup = activeConv?.groupId
    ? conversations.filter(c => c.groupId === activeConv.groupId)
    : activeConv ? [activeConv] : [];
  const isCombinedView = activeGroup.length > 1;

  // Combined submit: sends to all conversations in the group
  const handleCombinedSubmit = useCallback(async (prompt: string) => {
    if (!isCombinedView) {
      return handleSubmit(prompt);
    }
    // Submit to each conversation in the group simultaneously
    setIsLoading(true);
    setStreamingResponses([]);
    await Promise.all(activeGroup.map(conv => handleSubmit(prompt, conv.id, true)));
    setIsLoading(false);
  }, [isCombinedView, activeGroup, handleSubmit]);

  return (
    <div className="flex h-screen w-full bg-background">
      <AuthModal isOpen={showAuth && !isLoggedIn} onClose={() => setShowAuth(false)} onLogin={handleLogin} />
      <ConversationFlowDialog
        isOpen={showFlowDialog}
        onClose={() => setShowFlowDialog(false)}
        messages={activeConv?.messages ?? []}
        groupedConversations={isCombinedView ? activeGroup : undefined}
      />
      <NewChatDialog
        isOpen={showNewChatDialog}
        onClose={() => setShowNewChatDialog(false)}
        onCreate={handleCreateChat}
      />

      <ProfilePanel
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        profile={profile}
        onUpdateProviders={handleUpdateCustomProviders}
        onUpdateProfile={async (updates) => {
          const updatedProfile = { ...profile, ...updates };
          setProfile(updatedProfile);

          const token = localStorage.getItem('token');
          if (token && profile.id) {
            try {
              await fetch(`/api/conversations/update-stats/${profile.id}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  ...updatedProfile,
                  // Map fields are handled by backend conversion logic
                })
              });
            } catch (e) {
              console.error('Failed to update profile:', e);
            }
          }
        }}
      />

      {isLoggedIn && (
        <ChatHistorySidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => {
            // If selecting a grouped conv, activate the first in the group
            const conv = conversations.find(c => (c.id === id || c._id === id));
            if (conv?.groupId) {
              const group = conversations.filter(c => c.groupId === conv.groupId);
              setActiveConvId(group[0]?.id ?? id);
            } else {
              setActiveConvId(id);
            }
          }}
          onNew={handleNewChat}
          onRename={handleRenameConv}
          onDelete={handleDeleteConv}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          profileName={profile.name || profile.email}
          onOpenProfile={() => setShowProfile(true)}
          onLogout={handleLogout}
        />
      )}

      <div className={cn("flex flex-1 flex-col min-w-0 transition-all duration-200", isLoggedIn && sidebarOpen && "ml-[280px]")}>
        <header className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-border bg-card/90 backdrop-blur-md px-5">
          <div className="flex items-center gap-3">
            {isLoggedIn && !sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
                <Menu className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground tracking-tight">ResponseRally</span>
                <span className="text-[8px] font-bold text-primary uppercase tracking-[0.15em] bg-primary/10 px-1.5 py-0.5 rounded">Bench</span>
              </div>
            </div>
            {/* Combined mode indicator */}
            {isCombinedView && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                  {activeGroup.length}× Combined
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                {activeConvId && (activeConv?.messages?.length ?? 0) > 0 && (
                  <button
                    onClick={() => setShowFlowDialog(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    title="View conversation flow"
                  >
                    <GitBranch className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-base shadow-sm"
              >
                <User className="h-3.5 w-3.5" /> Sign In
              </button>
            )}
          </div>
        </header>

        {/* Split view for combined benchmarking */}
        {isCombinedView ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              {activeGroup.map((conv, idx) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex-1 flex flex-col min-w-0 min-h-0",
                    idx < activeGroup.length - 1 && "border-r border-border"
                  )}
                >
                  {/* Panel header */}
                  <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/30">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          conv.benchmarkingMode === "full-context" ? "hsl(var(--mode-full-context))" :
                            conv.benchmarkingMode === "sliding-window" ? "hsl(var(--mode-sliding-window))" :
                              "hsl(var(--mode-stateless))"
                      }}
                    />
                    <span className="text-[9px] font-bold text-foreground uppercase tracking-wider truncate">
                      {conv.groupLabel || conv.benchmarkingMode}
                    </span>
                    <span className="text-[8px] text-muted-foreground ml-auto shrink-0">
                      {conv.messages.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ChatThread
                      messages={conv.messages}
                      onSelectBest={(msgId, idx) => handleSelectBest(msgId, idx)}
                      onReselectResponse={(msgId) => handleReselectResponse(msgId)}
                      onRetryModel={(msgId, model) => handleRetryModel(msgId, model)}
                      isStreaming={isLoading}
                      streamingResponses={streamingResponses}
                      selectedModels={selectedModels}
                      isLoading={isLoading}
                      mode={conv.benchmarkingMode}
                      windowSize={conv.slidingWindowSize}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div ref={threadEndRef} />
            <ChatInput
              onSubmit={handleCombinedSubmit}
              isLoading={isLoading}
              isLoggedIn={isLoggedIn}
              selectedModels={selectedModels}
              onToggleModel={handleToggleModel}
              customModels={profile.customProviders.map(p => p.providerName)}
              onAddCustomModel={handleAddCustomModel}
              onRemoveCustomModel={handleUpdateCustomProviders}
              settings={benchmarkingSettings}
              onUpdateSettings={setBenchmarkingSettings}
            />
          </div>
        ) : (
          <>
            <ChatThread
              messages={activeConv?.messages ?? []}
              onSelectBest={handleSelectBest}
              onReselectResponse={handleReselectResponse}
              onRetryModel={handleRetryModel}
              isStreaming={isLoading}
              streamingResponses={streamingResponses}
              selectedModels={selectedModels}
              isLoading={isLoading}
              mode={activeConv?.benchmarkingMode}
              windowSize={activeConv?.slidingWindowSize}
            />
            <div ref={threadEndRef} />
            <ChatInput
              onSubmit={handleCombinedSubmit}
              isLoading={isLoading}
              isLoggedIn={isLoggedIn}
              selectedModels={selectedModels}
              onToggleModel={handleToggleModel}
              customModels={profile.customProviders.map(p => p.providerName)}
              onAddCustomModel={handleAddCustomModel}
              onRemoveCustomModel={handleUpdateCustomProviders}
              settings={benchmarkingSettings}
              onUpdateSettings={setBenchmarkingSettings}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
