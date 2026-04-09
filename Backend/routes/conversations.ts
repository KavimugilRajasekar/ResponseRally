import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const router = express.Router();

// Middleware to authenticate user
const authenticateUser = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied' });
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key') as { userId: string };
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

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

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

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

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: userId
      }
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

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: title || 'New Chat',
        messages: messages || [],
        benchmarkingMode: benchmarkingMode || 'full-context',
        groupId,
        groupLabel,
        slidingWindowSize
      }
    });

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

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (messages !== undefined) updateData.messages = messages;
    if (benchmarkingMode !== undefined) updateData.benchmarkingMode = benchmarkingMode;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (groupLabel !== undefined) updateData.groupLabel = groupLabel;
    if (slidingWindowSize !== undefined) updateData.slidingWindowSize = slidingWindowSize;

    const conversation = await prisma.conversation.update({
      where: { id: conversationId, userId: userId },
      data: updateData
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

// Delete a conversation
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const conversationId = req.params.id;

    await prisma.conversation.delete({
      where: {
        id: conversationId,
        userId: userId
      }
    });

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

    // Convert incoming modelMetrics/history for storage
    let updatedMetrics = {};
    if (req.body.modelMetrics) {
      const activePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      const now = new Date();
      
      Object.entries(req.body.modelMetrics).forEach(([model, m]: [string, any]) => {
        const activatedAt = new Date(m.activatedAt);
        const shouldDeactivate = now.getTime() - activatedAt.getTime() > activePeriod;

        (updatedMetrics as any)[model] = {
          ...m,
          activatedAt,
          deactivatedAt: shouldDeactivate ? new Date(activatedAt.getTime() + activePeriod) : m.deactivatedAt,
          isActive: shouldDeactivate ? false : m.isActive
        };
      });
    }

    let updatedHistory = [];
    if (req.body.performanceHistory) {
      updatedHistory = req.body.performanceHistory.map((h: any) => ({
        date: new Date(h.date),
        metrics: h.metrics
      }));
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalPrompts,
        totalTokensUsed,
        totalCostEstimate,
        favoriteModel,
        modelWins: modelWins || {},
        optimizerModelId: optimizerModelId || undefined,
        optimizerProvider: optimizerProvider || undefined,
        recentSelections: recentSelections || [],
        modelMetrics: updatedMetrics,
        performanceHistory: updatedHistory
      }
    });

    res.json({ message: 'Stats updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;