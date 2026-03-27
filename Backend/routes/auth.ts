import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { sendOTP } from '../utils/email.js';
import rateLimit from 'express-rate-limit';
import { validateSSO } from '../utils/sso.js';

const router = express.Router();

// Helper to serialize user data consistently (converts Maps to plain objects)
function serializeUser(user: any) {
  const modelWins = user.modelWins || {};
  const modelMetrics = user.modelMetrics || {};
  const performanceHistory = user.performanceHistory || [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    totalPrompts: user.totalPrompts || 0,
    totalTokensUsed: user.totalTokensUsed || 0,
    totalCostEstimate: user.totalCostEstimate || 0,
    favoriteModel: user.favoriteModel || '',
    modelWins,
    modelMetrics,
    performanceHistory,
    customProviders: user.customProviders || [],
    optimizerModelId: user.optimizerModelId,
    optimizerProvider: user.optimizerProvider,
    recentSelections: user.recentSelections || []
  };
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register user
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log('Registering user:', email);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        otp,
        otpExpires
      }
    });

    await sendOTP(email, otp);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for OTP.',
      requiresVerification: true,
      userId: user.id
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        email,
        otp,
        otpExpires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpires: null
      }
    });

    const token = jwt.sign(
      { userId: updatedUser.id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.json({ message: 'Email verified successfully', token, user: serializeUser(updatedUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resend OTP
router.post('/resend-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpires }
    });

    await sendOTP(email, otp);
    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  if (process.env.ALLOW_LOCAL_LOGIN === 'false') {
    return res.status(403).json({ message: 'Local login is disabled. Please log in via NiFo.' });
  }
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    console.log(`User ${email} logged in successfully`);
    return res.status(200).json({ message: 'Login successful', token, user: serializeUser(user) });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify OTP for login
router.post('/verify-login-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        email,
        otp,
        otpExpires: { gt: new Date() }
      }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpires: null
      }
    });

    const token = jwt.sign(
      { userId: updatedUser.id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token, user: serializeUser(updatedUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user — SSO cookie (when SSO_ENABLED=true) or JWT Bearer fallback
router.get('/me', async (req: Request, res: Response) => {
  // SSO path
  if (process.env.SSO_ENABLED === 'true') {
    try {
      const result = await validateSSO(req.headers.cookie || '');
      if (result.status === 'not_onboarded') {
        return res.status(403).json({ message: 'You are not onboarded in ResponseRally' });
      }
      if (result.status === 'unauthorized') {
        return res.status(401).json({ message: 'Session invalid or expired' });
      }
      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ user: serializeUser(user) });
    } catch (error) {
      console.error('SSO /me error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }

  // JWT Bearer fallback (local login mode)
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: 'Invalid token' });
  }
});

// Update user profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    
    const { name, customProviders } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (customProviders) updateData.customProviders = customProviders;

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData
    });

    res.json({ message: 'Profile updated successfully', user: serializeUser(updatedUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get environment keys for standard models
router.get('/env-keys', async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

    res.json({
      mistralKey: process.env.MISTRAL_API_KEY || '',
      openRouterKey: process.env.OPENROUTER_API_KEY || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
