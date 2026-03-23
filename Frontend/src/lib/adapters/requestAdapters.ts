import { ProviderConfig, ChatMessage, BenchmarkingSettings, getModelTemperature } from "../types";

export interface UnifiedRequest {
    messages: { role: string; content: string }[];
    settings: BenchmarkingSettings;
}

export function adaptRequest(config: ProviderConfig, request: UnifiedRequest): any {
    const { requestFormatType, modelName, supportsSystemRole } = config;
    const { messages, settings } = request;
    // Resolve per-model temperature (uses override if set, else clamps global to model range)
    const effectiveTemp = getModelTemperature(config.modelName, settings);
    // Filter or adapt system messages if not supported
    let adaptedMessages = [...messages];
    if (!supportsSystemRole) {
        adaptedMessages = messages.map(m =>
            m.role === "system" ? { role: "user", content: `System Instructions: ${m.content}` } : m
        );
    }

    switch (requestFormatType) {
        case "openai":
            return {
                model: modelName,
                messages: adaptedMessages,
                temperature: effectiveTemp,
                max_tokens: settings.maxTokens,
                top_p: settings.topP,
                stream: settings.streamingEnabled,
            };

        case "anthropic":
            // Anthropic expects system as a top-level field
            const systemMsg = messages.find(m => m.role === "system")?.content;
            const filteredMessages = adaptedMessages.filter(m => m.role !== "system");
            return {
                model: modelName,
                system: systemMsg,
                messages: filteredMessages.map(m => ({
                    role: m.role === "user" ? "user" : "assistant",
                    content: m.content
                })),
                max_tokens: settings.maxTokens,
                temperature: effectiveTemp,
                top_p: settings.topP,
                stream: settings.streamingEnabled,
            };

        case "gemini":
            return {
                contents: adaptedMessages
                    .filter(m => m.role !== "system")
                    .map(m => ({
                        role: m.role === "user" ? "user" : "model",
                        parts: [{ text: m.content }]
                    })),
                generationConfig: {
                    temperature: effectiveTemp,
                    maxOutputTokens: settings.maxTokens,
                    topP: settings.topP,
                },
                // Gemini handles system instruction separately sometimes, but this is a simplified version
            };

        default:
            throw new Error(`Unsupported request format: ${requestFormatType}`);
    }
}
