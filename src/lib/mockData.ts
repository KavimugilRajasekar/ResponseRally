import { ChatMessage, ModelResponse, Conversation, AI_PROVIDERS, BenchmarkingMode } from "./types";

const sampleResponses: Record<string, string> = {
  "Arcee Trinity": "The Arcee Trinity model leverages a specialized architecture for high-reasoning tasks. For binary search, it emphasizes the importance of the invariant condition `low <= high` and the mid-point calculation `low + (high - low) / 2` to prevent overflow in lower-level languages.",
  "StepFun 3.5": "Step-3.5-flash is optimized for speed and efficiency. Implementing binary search is straightforward: initialize range, loop while lo <= hi, bisect and compare. It's the standard O(log n) approach for sorted datasets.",
  "Mistral Large": "Here's a clean binary search implementation:\n\nThe algorithm works by maintaining a search window [lo, hi] and narrowing it based on comparisons with the middle element. Critical implementation details include proper midpoint calculation to prevent overflow.\n\nPerformance: O(log n) time, O(1) space for iterative.",
  "GLM-4.5 Air": "GLM-4.5 Air provides robust reasoning capabilities. In binary search, the recursive approach uses O(log n) stack space, while the iterative version is O(1). Always verify the input array is sorted before application.",
  "Nemotron-3": "NVIDIA's Nemotron-3 Nano is highly efficient for compact deployments. Binary search follows a divide-and-conquer strategy. It's particularly useful in GPU-accelerated sorting and searching kernels where memory latency is a factor.",
};


let idCounter = 0;
const uid = () => `msg-${++idCounter}-${Date.now()}`;

export function generateMockResponses(
  allowedModels?: string[],
  mode: BenchmarkingMode = "full-context",
  history: ChatMessage[] = [],
  windowSize?: number,
  currentPrompt: string = ""
): ModelResponse[] {
  const responses: ModelResponse[] = [];

  // Estimate history tokens: characters / 4 for "Real" feel
  let historyContent = "";

  if (mode === "full-context") {
    historyContent = history.map(m => m.content).join(" ");
  } else if (mode === "sliding-window" && windowSize) {
    const windowMessages = history.slice(-(windowSize * 2));
    historyContent = windowMessages.map(m => m.content).join(" ");
  }

  const promptHistoryTokens = historyContent.length / 4;
  const currentPromptTokens = currentPrompt.length / 4;

  AI_PROVIDERS.forEach((p) => {
    if (!allowedModels || allowedModels.includes(p.name)) {
      const mockResponseText = sampleResponses[p.name] || "Response not available.";
      const responseTokens = mockResponseText.length / 4;
      const totalTokens = Math.ceil(promptHistoryTokens + currentPromptTokens + responseTokens);
      const latency = Math.floor(Math.random() * 800) + 500;
      responses.push({
        model: p.name,
        provider: p.provider,
        color: p.color,
        response: mockResponseText,
        latency,
        tokens: totalTokens,
        duration: Number((Math.random() * 2 + 1.5).toFixed(1)),
        isStreaming: false,
        isSelected: false,
        estimatedCost: Number(((totalTokens / 1000) * p.costPer1kOutput).toFixed(5)),
        maxTokens: p.maxTokens,
      });
    }
  });

  // Handle custom models
  if (allowedModels) {
    const standardModelNames = AI_PROVIDERS.map(p => p.name) as readonly string[];
    allowedModels.forEach(modelName => {
      if (!standardModelNames.includes(modelName)) {
        const mockResponseText = `This is a mock response from your custom model: ${modelName}. API Key verified.`;
        const responseTokens = mockResponseText.length / 4;
        const totalTokens = Math.ceil(promptHistoryTokens + currentPromptTokens + responseTokens);
        const latency = Math.floor(Math.random() * 800) + 500;
        responses.push({
          model: modelName,
          provider: "Custom Provider",
          color: "hsl(280, 70%, 50%)",
          response: mockResponseText,
          latency,
          tokens: totalTokens,
          duration: Number((Math.random() * 2 + 1.5).toFixed(1)),
          isStreaming: false,
          isSelected: false,
          estimatedCost: 0,
          maxTokens: 4096,
        });
      }
    });
  }

  return responses;
}

export function simulateStreaming(
  onUpdate: (responses: ModelResponse[]) => void,
  onComplete: () => void,
  allowedModels?: string[],
  mode: BenchmarkingMode = "full-context",
  history: ChatMessage[] = [],
  windowSize?: number,
  currentPrompt: string = ""
): () => void {
  const final = generateMockResponses(allowedModels, mode, history, windowSize, currentPrompt);
  const streamState = final.map((r) => ({
    ...r,
    fullResponse: r.response,
    response: "",
    isStreaming: true,
    charIndex: 0,
    delay: Math.random() * 500 + 200,
    speed: Math.random() * 20 + 15,
  }));

  let running = true;
  const timers: number[] = [];

  streamState.forEach((state) => {
    const t = setTimeout(() => {
      if (!running) return;
      const interval = setInterval(() => {
        if (!running) { clearInterval(interval); return; }
        const chars = Math.floor(Math.random() * 4) + 1;
        state.charIndex = Math.min(state.charIndex + chars, state.fullResponse.length);
        state.response = state.fullResponse.slice(0, state.charIndex);
        if (state.charIndex >= state.fullResponse.length) {
          state.isStreaming = false;
          clearInterval(interval);
        }
        onUpdate(streamState.map((s) => ({
          model: s.model, provider: s.provider, color: s.color,
          response: s.response,
          latency: s.latency,
          tokens: Math.floor((s.charIndex / s.fullResponse.length) * s.tokens),
          duration: Number(((s.charIndex / s.fullResponse.length) * s.duration).toFixed(1)),
          isStreaming: s.isStreaming,
          isSelected: s.isSelected,
          estimatedCost: Number(((Math.floor((s.charIndex / s.fullResponse.length) * s.tokens) / 1000) * 0.03).toFixed(5)),
          maxTokens: s.maxTokens,
        })));
        if (streamState.every((s) => !s.isStreaming)) onComplete();
      }, state.speed);
      timers.push(interval as unknown as number);
    }, state.delay);
    timers.push(t as unknown as number);
  });

  return () => { running = false; timers.forEach(clearInterval); };
}

export function generateOptimizedPrompt(original: string): string {
  const words = original.split(" ");
  if (words.length <= 5) return original;
  return words.slice(0, Math.ceil(words.length * 0.7)).join(" ") + " [optimized]";
}

export function createMockConversations(): Conversation[] {
  return [
    {
      id: "conv-1",
      title: "Binary Search Implementation",
      messages: [],
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    },
    {
      id: "conv-2",
      title: "React Performance Tips",
      messages: [],
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(Date.now() - 172800000),
    },
    {
      id: "conv-3",
      title: "API Design Best Practices",
      messages: [],
      createdAt: new Date(Date.now() - 259200000),
      updatedAt: new Date(Date.now() - 259200000),
    },
  ];
}
