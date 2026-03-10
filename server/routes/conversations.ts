import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Conversation from '../models/Conversation';
import User from '../models/User';

const router = express.Router();

// Middleware to authenticate user
const authenticateUser = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    (req as any).userId = decoded.userId;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all conversations for a user
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const conversations = await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50); // Limit to last 50 conversations

    res.json({ conversations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific conversation
router.get('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new conversation
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title, messages, benchmarkingMode, groupId, groupLabel, slidingWindowSize } = req.body;

    console.log('Creating conversation:', { title, benchmarkingMode, groupId, slidingWindowSize });

    const conversation = new Conversation({
      userId,
      title: title || 'New Chat',
      messages: messages || [],
      benchmarkingMode: benchmarkingMode || 'full-context',
      groupId,
      groupLabel,
      slidingWindowSize
    });

    await conversation.save();

    res.status(201).json({ conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a conversation
router.put('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id;
    const { title, messages, benchmarkingMode, groupId, groupLabel, slidingWindowSize } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (messages !== undefined) updateData.messages = messages;
    if (benchmarkingMode !== undefined) updateData.benchmarkingMode = benchmarkingMode;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (groupLabel !== undefined) updateData.groupLabel = groupLabel;
    if (slidingWindowSize !== undefined) updateData.slidingWindowSize = slidingWindowSize;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId: userId },
      { $set: updateData },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a conversation
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id;

    const conversation = await Conversation.findOneAndDelete({
      _id: conversationId,
      userId: userId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user stats after a conversation
router.post('/update-stats/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { totalPrompts, totalTokensUsed, totalCostEstimate, modelWins, favoriteModel, optimizerModelId, optimizerProvider, recentSelections } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user stats
    user.totalPrompts = totalPrompts;
    user.totalTokensUsed = totalTokensUsed;
    user.totalCostEstimate = totalCostEstimate;
    user.favoriteModel = favoriteModel;
    user.modelWins = modelWins;
    if (optimizerModelId) user.optimizerModelId = optimizerModelId;
    if (optimizerProvider) user.optimizerProvider = optimizerProvider;
    if (recentSelections) user.recentSelections = recentSelections;

    // Convert incoming modelMetrics/history for storage
    if (req.body.modelMetrics) {
      const activePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = new Date();
      const updatedMetrics = new Map();

      Object.entries(req.body.modelMetrics).forEach(([model, m]: [string, any]) => {
        const activatedAt = new Date(m.activatedAt);
        const shouldDeactivate = now.getTime() - activatedAt.getTime() > activePeriod;

        updatedMetrics.set(model, {
          ...m,
          activatedAt,
          deactivatedAt: shouldDeactivate ? new Date(activatedAt.getTime() + activePeriod) : m.deactivatedAt,
          isActive: shouldDeactivate ? false : m.isActive
        });
      });
      user.modelMetrics = updatedMetrics;
    }

    if (req.body.performanceHistory) {
      user.performanceHistory = req.body.performanceHistory.map((h: any) => ({
        date: new Date(h.date),
        metrics: new Map(Object.entries(h.metrics))
      }));
    }

    await user.save();

    res.json({ message: 'Stats updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;