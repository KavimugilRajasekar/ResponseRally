import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import { sendOTP } from '../utils/email';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Helper to serialize user data consistently (converts Maps to plain objects)
function serializeUser(user: any) {
  const modelWins = user.modelWins instanceof Map
    ? Object.fromEntries(user.modelWins)
    : (user.modelWins || {});

  const modelMetrics = user.modelMetrics instanceof Map
    ? Object.fromEntries(
        Array.from((user.modelMetrics as Map<string, any>).entries()).map(([k, v]: [string, any]) => [k, {
          totalBenchmarked: v.totalBenchmarked || 0,
          totalWins: v.totalWins || 0,
          activatedAt: v.activatedAt?.toISOString?.() || v.activatedAt,
          deactivatedAt: v.deactivatedAt?.toISOString?.() || v.deactivatedAt,
          isActive: v.isActive !== false
        }])
      )
    : (user.modelMetrics || {});

  const performanceHistory = Array.isArray(user.performanceHistory)
    ? user.performanceHistory.map((h: any) => ({
        date: h.date?.toISOString?.() || h.date,
        metrics: h.metrics instanceof Map ? Object.fromEntries(h.metrics) : (h.metrics || {})
      }))
    : [];

  return {
    id: user._id,
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ email, password, name });
    console.log('Registering user:', email);
    await user.save();

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOTP(email, otp);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for OTP.',
      requiresVerification: true,
      userId: user._id
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

    const user = await User.findOne({ email, otp, otpExpires: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.json({ message: 'Email verified successfully', token, user: serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resend OTP
router.post('/resend-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOTP(email, otp);
    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id },
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
    const user = await User.findOne({ email, otp, otpExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token, user: serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ user: serializeUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, customProviders } = req.body;
    if (name) user.name = name;
    if (customProviders) user.customProviders = customProviders;
    await user.save();

    res.json({ message: 'Profile updated successfully', user: serializeUser(user) });
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
