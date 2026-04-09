import { ProviderConfig, ModelResponse, AI_PROVIDERS, getComputeLevel } from "../types";

/** Pricing lookup: costPer1kInput / costPer1kOutput from AI_PROVIDERS */
const PRICING_MAP: Record<string, { input: number; output: number }> = {};
AI_PROVIDERS.forEach(p => {
    PRICING_MAP[p.name] = { input: p.costPer1kInput, output: p.costPer1kOutput };
    PRICING_MAP[p.modelId] = { input: p.costPer1kInput, output: p.costPer1kOutput };
});

const USD_TO_INR = 83;

export function normalizeResponse(
    config: ProviderConfig,
    rawResponse: any,
    latency: number,
    startTime: number
): ModelResponse {
    const duration = (Date.now() - startTime) / 1000;
    let responseText = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let providerCost = 0;

    switch (config.requestFormatType) {
        case "openai":
            responseText = rawResponse.choices?.[0]?.message?.content || "";
            inputTokens = rawResponse.usage?.prompt_tokens || 0;
            outputTokens = rawResponse.usage?.completion_tokens || 0;
            totalTokens = rawResponse.usage?.total_tokens || (inputTokens + outputTokens);
            providerCost = rawResponse.usage?.cost || 0;
            break;

        case "anthropic":
            responseText = rawResponse.content?.[0]?.text || "";
            inputTokens = rawResponse.usage?.input_tokens || 0;
            outputTokens = rawResponse.usage?.output_tokens || 0;
            totalTokens = inputTokens + outputTokens;
            break;

        case "gemini":
            responseText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
            inputTokens = rawResponse.usageMetadata?.promptTokenCount || 0;
            outputTokens = rawResponse.usageMetadata?.candidatesTokenCount || 0;
            totalTokens = rawResponse.usageMetadata?.totalTokenCount || (inputTokens + outputTokens);
            break;

        default:
            responseText = JSON.stringify(rawResponse);
    }

    const tokensPerSecond = duration > 0 ? totalTokens / duration : 0;
    const costUsd = providerCost > 0 ? providerCost : calculateCostUsd(config, inputTokens, outputTokens);
    const costInr = Number((costUsd * USD_TO_INR).toFixed(4));

    return {
        model: config.id || config.modelName,
        provider: config.providerName,
        color: config.color || "hsl(280, 70%, 50%)",
        response: responseText,
        latency,
        tokens: totalTokens,
        tokensPerSecond: Number(tokensPerSecond.toFixed(2)),
        duration: Number(duration.toFixed(1)),
        isStreaming: false,
        estimatedCost: costInr,
        computeLevel: getComputeLevel(tokensPerSecond),
    };
}

function calculateCostUsd(config: ProviderConfig, inputTokens: number, outputTokens: number): number {
    const modelKey = config.id || config.modelName;
    const pricing = PRICING_MAP[modelKey] || PRICING_MAP[config.providerName];
    if (!pricing) return 0;
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return inputCost + outputCost;
}
