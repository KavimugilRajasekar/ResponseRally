import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry, executeBenchmark } from "../lib/aiClient";
import { ProviderConfig, BenchmarkingSettings } from "../lib/types";

// We need to mock fetch
global.fetch = vi.fn();

describe("fetchWithRetry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should succeed on the first attempt", async () => {
        (fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
        });

        const response = await fetchWithRetry("http://test.com", {}, 5, 0);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(response.ok).toBe(true);
    });

    it("should retry on 500 error and eventually succeed", async () => {
        (fetch as any)
            .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })
            .mockResolvedValueOnce({ ok: true, status: 200 });

        const response = await fetchWithRetry("http://test.com", {}, 5, 0);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(response.ok).toBe(true);
    });

    it("should retry up to 5 times and then return the error", async () => {
        (fetch as any).mockResolvedValue({
            ok: false,
            status: 502,
            statusText: "Bad Gateway",
        });

        const response = await fetchWithRetry("http://test.com", {}, 5, 0);

        expect(fetch).toHaveBeenCalledTimes(5);
        expect(response.status).toBe(502);
    });

    it("should NOT retry on 400 error", async () => {
        (fetch as any).mockResolvedValue({
            ok: false,
            status: 400,
            statusText: "Bad Request",
        });

        const response = await fetchWithRetry("http://test.com", {}, 5, 0);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(400);
    });

    it("should retry on 429 (Rate Limit)", async () => {
        (fetch as any)
            .mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" })
            .mockResolvedValueOnce({ ok: true, status: 200 });

        const response = await fetchWithRetry("http://test.com", {}, 5, 0);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(response.ok).toBe(true);
    });
});

describe("executeBenchmark integration", () => {
    const mockConfig: ProviderConfig = {
        id: "test-model",
        providerName: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        chatEndpointPath: "/chat/completions",
        apiKey: "test-key",
        authHeaderName: "Authorization",
        authPrefix: "Bearer",
        modelName: "test-model",
        modelType: "chat",
        requestFormatType: "openai",
        supportsStreaming: false,
        supportsSystemRole: true,
        returnsUsage: true,
        returnsCost: false,
        isActive: true,
    };

    const mockSettings: BenchmarkingSettings = {
        temperature: 0.7,
        maxTokens: 100,
        topP: 1,
        streamingEnabled: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should succeed via executeBenchmark", async () => {
        (fetch as any).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ choices: [{ message: { content: "Integration Success" } }] }),
        });

        const result = await executeBenchmark(mockConfig, [{ role: "user", content: "hi" }], mockSettings);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.response).toBe("Integration Success");
    });
});
