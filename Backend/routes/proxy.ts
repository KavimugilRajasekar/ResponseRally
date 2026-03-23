import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Proxy endpoint for AI API calls
// Accepts requests from the frontend and proxies them to the actual AI providers
// This avoids CORS issues and keeps API keys secure on the server
router.post('/chat', async (req: Request, res: Response) => {
    try {
        // Optional: require auth token to use the proxy
        const authHeader = req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
            } catch {
                return res.status(401).json({ message: 'Invalid token' });
            }
        }

        const { provider, baseUrl, endpoint, body, authPrefix, apiKey: clientApiKey } = req.body;

        // Determine the actual API key from the server environment
        let apiKey = '';
        if (provider === 'Mistral AI') {
            apiKey = process.env.MISTRAL_API_KEY || '';
        } else if (provider === 'OpenRouter') {
            apiKey = process.env.OPENROUTER_API_KEY || '';
        } else if (clientApiKey) {
            // For custom providers, the user provides their own key
            apiKey = clientApiKey;
        }

        if (!apiKey) {
            return res.status(400).json({ error: `No API key configured for provider: ${provider}` });
        }

        const url = `${baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };

        // OpenRouter-specific headers
        if (provider === 'OpenRouter') {
            headers['HTTP-Referer'] = process.env.CLIENT_URL || 'http://localhost:5173';
            headers['X-Title'] = 'ResponseRally';
        }

        const upstreamResponse = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const contentType = upstreamResponse.headers.get('content-type') || '';

        if (!upstreamResponse.ok) {
            const errorBody = contentType.includes('application/json')
                ? await upstreamResponse.json()
                : await upstreamResponse.text();
            console.error(`[Proxy] Upstream error from ${provider}:`, errorBody);
            return res.status(upstreamResponse.status).json({
                error: typeof errorBody === 'object' ? errorBody : { message: errorBody },
            });
        }

        // Stream or JSON response passthrough
        if (contentType.includes('text/event-stream')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const reader = (upstreamResponse.body as any)?.getReader();
            if (!reader) return res.status(500).json({ error: 'No stream available' });
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                res.end();
            } catch (streamError) {
                console.error('[Proxy] Stream error:', streamError);
                res.end();
            }
        } else {
            const data = await upstreamResponse.json();
            return res.json(data);
        }
    } catch (error: any) {
        console.error('[Proxy] Error:', error);
        return res.status(500).json({ error: error.message || 'Proxy error' });
    }
});

export default router;
