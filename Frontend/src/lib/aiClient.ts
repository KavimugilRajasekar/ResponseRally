import { ProviderConfig, BenchmarkingSettings, ModelResponse, getModelTemperature } from "./types";
import { adaptRequest } from "./adapters/requestAdapters";
import { normalizeResponse } from "./adapters/responseNormalizers";
import { API_URL } from "./config";

/**
 * fetchWithRetry - A wrapper around fetch that retries up to maxRetries times
 * for network errors or 5xx server errors.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 5,
    delayMs: number = 1000
): Promise<Response> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // If success or a client error (4xx besides 429), don't retry
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
                return response;
            }

            // If we're here, it's a 5xx or 429
            console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed with status ${response.status}.`);

            if (attempt === maxRetries) return response;
        } catch (error: any) {
            lastError = error;
            console.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed with error: ${error.message}`);

            if (attempt === maxRetries) throw error;
        }

        // Wait before next attempt (exponential backoff could be added here, but simple delay for now)
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }

    throw lastError || new Error("Max retries reached");
}

export async function executeBenchmark(
    config: ProviderConfig,
    messages: { role: string; content: string }[],
    settings: BenchmarkingSettings,
    onStream?: (chunk: string) => void
): Promise<ModelResponse> {
    const startTime = Date.now();
    const requestBody = adaptRequest(config, { messages, settings });

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        [config.authHeaderName]: config.authPrefix === "Bearer"
            ? `Bearer ${config.apiKey}`
            : config.apiKey,
    };

    if (config.organizationId) headers["OpenAI-Organization"] = config.organizationId;
    if (config.projectId) headers["OpenAI-Project"] = config.projectId;
    if (config.apiVersion) headers["anthropic-version"] = config.apiVersion;

    // OpenRouter specific headers
    if (config.providerName === "OpenRouter") {
        headers["HTTP-Referer"] = "http://localhost:5173";
        headers["X-Title"] = "ResponseRally";
    }

    try {
        const response = await fetchWithRetry(`${config.baseUrl}${config.chatEndpointPath}`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        if (settings.streamingEnabled && onStream) {
            const reader = response.body?.getReader();
            if (!reader) throw new Error("Stream not available");

            let fullText = "";
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                fullText += chunk;
                onStream(chunk);
            }

            return normalizeResponse(config, { choices: [{ message: { content: fullText } }] }, Date.now() - startTime, startTime);
        } else {
            const rawData = await response.json();
            return normalizeResponse(config, rawData, Date.now() - startTime, startTime);
        }
    } catch (error: any) {
        console.error(`Benchmark failed for ${config.providerName}:`, error);
        return {
            model: config.id || config.modelName,
            provider: config.providerName,
            color: config.color || "hsl(0, 0%, 50%)",
            response: `Error: ${error.message}`,
            latency: Date.now() - startTime,
            tokens: 0,
            duration: (Date.now() - startTime) / 1000,
            isStreaming: false,
        };
    }
}

/**
 * executeProxyBenchmark - Routes AI API calls through our own backend proxy.
 *
 * This avoids CORS issues because the server (not the browser) makes the
 * actual request to Mistral / OpenRouter. The API keys stay securely on
 * the server and are never sent to the browser.
 */
export async function executeProxyBenchmark(
    config: ProviderConfig,
    messages: { role: string; content: string }[],
    settings: BenchmarkingSettings,
    jwtToken: string | null,
    options?: {
        baseUrl?: string;
        endpoint?: string;
        apiKey?: string;
        authPrefix?: string;
    }
): Promise<ModelResponse> {
    const startTime = Date.now();
    const effectiveTemp = getModelTemperature(config.modelName, settings);

    const requestBody = {
        model: config.id || config.modelName,
        messages,
        temperature: effectiveTemp,
        max_tokens: settings.maxTokens,
        top_p: settings.topP,
        stream: false,
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (jwtToken) headers["Authorization"] = `Bearer ${jwtToken}`;

    try {
        const proxyBaseUrl = options?.baseUrl || (config.providerName === "Mistral AI"
            ? "https://api.mistral.ai/v1"
            : "https://openrouter.ai/api/v1");
        const proxyEndpoint = options?.endpoint || "/chat/completions";

        const response = await fetchWithRetry(`${API_URL}/api/proxy/chat`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                provider: config.providerName,
                baseUrl: proxyBaseUrl,
                endpoint: proxyEndpoint,
                body: requestBody,
                ...(options?.apiKey ? { apiKey: options.apiKey } : {}),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error?.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }

        const rawData = await response.json();
        return normalizeResponse(config, rawData, Date.now() - startTime, startTime);
    } catch (error: any) {
        console.error(`Proxy benchmark failed for ${config.providerName}:`, error);
        return {
            model: config.id || config.modelName,
            provider: config.providerName,
            color: config.color || "hsl(0, 0%, 50%)",
            response: `Error: ${error.message}`,
            latency: Date.now() - startTime,
            tokens: 0,
            duration: (Date.now() - startTime) / 1000,
            isStreaming: false,
        };
    }
}

/**
 * optimizePromptWithAI - Uses a fast model (Arcee Trinity) to optimize the user's prompt
 * for better efficiency and effectiveness before benchmarking.
 */
export async function optimizePromptWithAI(
    prompt: string,
    jwtToken: string | null,
    modelId: string = "arcee-ai/trinity-large-preview:free",
    providerName: string = "OpenRouter"
): Promise<string> {
    const startTime = Date.now();

    const requestBody = {
        model: modelId,
        messages: [
            {
                role: "system",
                content: "You are a Prompt Optimizer. Rewrite the user's prompt to be more token-efficient, clear, and effective for LLMs while strictly preserving the original intent. Return ONLY the rewritten prompt text without any preamble, quotes, or explanation."
            },
            { role: "user", content: prompt }
        ],
        temperature: 0.3, // Low temperature for consistent optimization
        max_tokens: 500,
        stream: false,
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (jwtToken) headers["Authorization"] = `Bearer ${jwtToken}`;

    try {
        const response = await fetchWithRetry(`${API_URL}/api/proxy/chat`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                provider: providerName,
                baseUrl: "https://openrouter.ai/api/v1",
                endpoint: "/chat/completions",
                body: requestBody,
            }),
        });

        if (!response.ok) throw new Error("Optimization request failed");

        const rawData = await response.json();
        const optimizedText = rawData.choices?.[0]?.message?.content?.trim() || prompt;

        console.log(`[Optimizer] Prompt optimized in ${Date.now() - startTime}ms`);
        return optimizedText;
    } catch (error) {
        console.error("[Optimizer] Error optimizing prompt:", error);
        return prompt; // Fallback to original prompt if optimization fails
    }
}
