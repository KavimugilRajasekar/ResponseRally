export type ComputeLevel = "High" | "Medium" | "Low";

export interface ModelResponse {
  model: string;
  provider: string;
  color: string;
  response: string;
  latency: number;
  tokens: number;
  tokensPerSecond?: number;
  duration: number;
  isStreaming: boolean;
  isSelected?: boolean;
  estimatedCost?: number;
  maxTokens?: number;
  computeLevel?: ComputeLevel;
}

/** Determine compute level from tokens/second */
export function getComputeLevel(tokensPerSecond: number): ComputeLevel {
  if (tokensPerSecond >= 80) return "High";
  if (tokensPerSecond >= 30) return "Medium";
  return "Low";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responses?: ModelResponse[];
  selectedModel?: string;
  optimizedPrompt?: string;
  attachments?: Attachment[];
  benchmarkingSettings?: BenchmarkingSettings;
  /** Models locked-in at submission time — used for skeleton rendering, unaffected by later deselects */
  pendingModels?: string[];
}

export interface BenchmarkingSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  streamingEnabled: boolean;
  systemPrompt?: string;
  /** Per-model temperature overrides keyed by model display name */
  modelTemperatures?: Record<string, number>;
}

/** Temperature range constraints per model/provider */
export interface TemperatureRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Known temperature ranges for built-in models */
export const MODEL_TEMPERATURE_RANGES: Record<string, TemperatureRange> = {
  "Arcee Trinity": { min: 0, max: 2, step: 0.1, default: 0.7 },
  "StepFun 3.5": { min: 0, max: 2, step: 0.1, default: 0.7 },
  "Mistral Large": { min: 0, max: 1, step: 0.05, default: 0.7 },
  "GLM-4.5 Air": { min: 0, max: 2, step: 0.1, default: 0.7 },
  "Nemotron-3": { min: 0, max: 2, step: 0.1, default: 0.7 },
};

export const DEFAULT_TEMPERATURE_RANGE: TemperatureRange = { min: 0, max: 2, step: 0.1, default: 0.7 };

/** Get temperature range for a model (falls back to default) */
export function getTemperatureRange(modelName: string): TemperatureRange {
  return MODEL_TEMPERATURE_RANGES[modelName] || DEFAULT_TEMPERATURE_RANGE;
}

/** Get effective temperature for a model from settings */
export function getModelTemperature(modelName: string, settings: BenchmarkingSettings): number {
  const override = settings.modelTemperatures?.[modelName];
  if (override !== undefined) return override;
  const range = getTemperatureRange(modelName);
  // Clamp the global temperature to the model's range
  return Math.min(Math.max(settings.temperature, range.min), range.max);
}

export interface Attachment {
  id: string;
  type: "image" | "document" | "link";
  name: string;
  url: string;
  size?: number;
}

export type BenchmarkingMode = "full-context" | "sliding-window" | "stateless";

export interface Conversation {
  id: string;
  _id?: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  benchmarkingMode?: BenchmarkingMode;
  /** For combined benchmarking: IDs of sibling conversations in the group */
  groupId?: string;
  /** Label for this conversation within a combined group */
  groupLabel?: string;
  /** Sliding window context length */
  slidingWindowSize?: number;
}

export type RequestFormatType = "openai" | "anthropic" | "gemini";
export type ModelType = "chat" | "completion" | "embedding" | "image";
export type AuthPrefix = "Bearer" | "None";

export interface ProviderConfig {
  id: string;
  providerName: string;
  baseUrl: string;
  chatEndpointPath: string;
  apiKey: string;
  organizationId?: string;
  projectId?: string;
  region?: string;
  apiVersion?: string;
  authHeaderName: "Authorization" | "x-api-key";
  authPrefix: AuthPrefix;
  modelName: string;
  modelType: ModelType;
  requestFormatType: RequestFormatType;
  supportsStreaming: boolean;
  supportsSystemRole: boolean;
  returnsUsage: boolean;
  returnsCost: boolean;
  isActive: boolean;
  color?: string;
}

export interface ModelMetric {
  totalBenchmarked: number;
  totalWins: number;
  activatedAt: string;
  deactivatedAt?: string;
  isActive: boolean;
}

export interface DailySnapshot {
  date: string;
  metrics: Record<string, { wins: number; usages: number }>;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  customProviders: ProviderConfig[];
  totalPrompts: number;
  totalTokensUsed: number;
  totalCostEstimate: number;
  favoriteModel: string;
  modelWins: Record<string, number>;
  modelMetrics: Record<string, ModelMetric>;
  performanceHistory: DailySnapshot[];
  optimizerModelId?: string;
  optimizerProvider?: string;
  recentSelections?: RecentSelection[];
}

export interface RecentSelection {
  conversationId: string;
  modelName: string;
  timestamp: string;
}

export const AI_PROVIDERS = [
  { name: "Arcee Trinity", modelId: "arcee-ai/trinity-large-preview:free", provider: "OpenRouter", color: "hsl(280, 70%, 50%)", maxTokens: 4096, costPer1kInput: 0, costPer1kOutput: 0 },
  { name: "StepFun 3.5", modelId: "stepfun/step-3.5-flash:free", provider: "OpenRouter", color: "hsl(142, 50%, 45%)", maxTokens: 128000, costPer1kInput: 0, costPer1kOutput: 0 },
  { name: "Mistral Large", modelId: "mistral-large-latest", provider: "Mistral AI", color: "hsl(24, 80%, 55%)", maxTokens: 32000, costPer1kInput: 0.008, costPer1kOutput: 0.024 },
  { name: "GLM-4.5 Air", modelId: "z-ai/glm-4.5-air:free", provider: "OpenRouter", color: "hsl(48, 85%, 55%)", maxTokens: 128000, costPer1kInput: 0, costPer1kOutput: 0 },
  { name: "Nemotron-3", modelId: "nvidia/nemotron-3-nano-30b-a3b:free", provider: "OpenRouter", color: "hsl(200, 70%, 50%)", maxTokens: 32000, costPer1kInput: 0, costPer1kOutput: 0 },
] as const;

export const INPUT_CHAR_LIMIT = 10000;
