import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../config/db.js';

const API_URL = 'http://localhost:5000/api';

describe('Auth API Integration', { timeout: 30000 }, () => {
    const testUser = {
        email: `test_${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test User'
    };

    it('should register a new user', async () => {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.message).toContain('User registered successfully');
    });

    it('should login the registered user after verification (mocked)', async () => {
        // Since OTP is sent via email, we manually verify the user for testing
        await prisma.user.update({
            where: { email: testUser.email },
            data: { isVerified: true, otp: null, otpExpires: null }
        });

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.token).toBeDefined();
        expect(data.user.email).toBe(testUser.email);
    });

    afterAll(async () => {
        // Cleanup test user
        if (testUser.email) {
            await prisma.user.delete({ where: { email: testUser.email } }).catch(() => {});
        }
        await prisma.$disconnect();
    });
});
