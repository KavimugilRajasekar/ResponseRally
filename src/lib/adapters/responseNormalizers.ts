import { ProviderConfig, ModelResponse } from "../types";

export function normalizeResponse(
    config: ProviderConfig,
    rawResponse: any,
    latency: number,
    startTime: number
): ModelResponse {
    const duration = (Date.now() - startTime) / 1000;
    let responseText = "";
    let tokens = 0;
    let cost = 0; // Initialize cost

    switch (config.requestFormatType) {
        case "openai":
            responseText = rawResponse.choices?.[0]?.message?.content || "";
            tokens = rawResponse.usage?.total_tokens || 0;
            if (rawResponse.usage) {
                cost = rawResponse.usage.cost || 0;
            }
            break;

        case "anthropic":
            responseText = rawResponse.content?.[0]?.text || "";
            tokens = rawResponse.usage?.input_tokens + rawResponse.usage?.output_tokens || 0;
            break;

        case "gemini":
            responseText = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
            // Gemini usage is nested differently
            tokens = rawResponse.usageMetadata?.totalTokenCount || 0;
            break;

        default:
            responseText = JSON.stringify(rawResponse);
    }

    const tokensPerSecond = duration > 0 ? tokens / duration : 0;

    return {
        model: config.id || config.modelName,
        provider: config.providerName,
        color: config.color || "hsl(280, 70%, 50%)",
        response: responseText,
        latency,
        tokens,
        tokensPerSecond: Number(tokensPerSecond.toFixed(2)),
        duration: Number(duration.toFixed(1)),
        isStreaming: false,
        estimatedCost: cost > 0 ? cost : calculateCost(config, tokens),
    };
}

function calculateCost(config: ProviderConfig, tokens: number): number {
    // Simple heuristic or config-based cost
    return 0; // Placeholder
}
