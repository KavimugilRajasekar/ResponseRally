import { describe, it, expect } from "vitest";
import { generateMockResponses } from "../lib/mockData";
import { ChatMessage } from "../lib/types";

describe("generateMockResponses token calculation", () => {
    const history: ChatMessage[] = [
        { id: "1", role: "user", content: "Hello", timestamp: new Date() },
        { id: "2", role: "assistant", content: "Hi there! How can I help you today?", timestamp: new Date() },
        { id: "3", role: "user", content: "Tell me about React.", timestamp: new Date() },
        { id: "4", role: "assistant", content: "React is a JavaScript library for building user interfaces.", timestamp: new Date() },
    ];

    it("should calculate tokens for full-context mode with history and prompt", () => {
        const prompt = "What is the capital of France?";
        const responses = generateMockResponses(["Arcee Trinity"], "full-context", history, undefined, prompt);

        const historyLen = history.map(m => m.content).join(" ").length;
        const promptLen = prompt.length;
        const responseLen = (responses[0].response as string).length;
        const expectedMin = Math.ceil((historyLen + promptLen + responseLen) / 4);

        expect(responses[0].tokens).toBeGreaterThanOrEqual(expectedMin);
    });

    it("should calculate fewer tokens for stateless mode with same history", () => {
        const prompt = "What is the capital of France?";
        const fullContextResponses = generateMockResponses(["Arcee Trinity"], "full-context", history, undefined, prompt);
        const statelessResponses = generateMockResponses(["Arcee Trinity"], "stateless", history, undefined, prompt);

        expect(statelessResponses[0].tokens).toBeLessThan(fullContextResponses[0].tokens);

        const promptLen = prompt.length;
        const responseLen = (statelessResponses[0].response as string).length;
        const expectedStateless = Math.ceil((promptLen + responseLen) / 4);
        expect(statelessResponses[0].tokens).toBeGreaterThanOrEqual(expectedStateless);
    });

    it("should calculate tokens for sliding-window mode", () => {
        const prompt = "What is the capital of France?";
        const windowResponses = generateMockResponses(["Arcee Trinity"], "sliding-window", history, 1, prompt);
        const fullContextResponses = generateMockResponses(["Arcee Trinity"], "full-context", history, undefined, prompt);

        expect(windowResponses[0].tokens).toBeLessThan(fullContextResponses[0].tokens);
        expect(windowResponses[0].tokens).toBeGreaterThan(Math.ceil(prompt.length / 4));
    });
});
