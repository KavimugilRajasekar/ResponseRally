import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  benchmarkingMode?: 'full-context' | 'sliding-window' | 'stateless';
  groupId?: string;
  groupLabel?: string;
  slidingWindowSize?: number;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    responses?: Array<{
      model: string;
      provider: string;
      color: string;
      response: string;
      latency: number;
      tokens: number;
      duration: number;
      isStreaming: boolean;
      isSelected?: boolean;
      estimatedCost?: number;
      maxTokens?: number;
      tokensPerSecond?: number;
      modelType?: string;
    }>;
    selectedModel?: string;
    optimizedPrompt?: string;
    benchmarkingSettings?: {
      temperature: number;
      maxTokens: number;
      topP: number;
      streamingEnabled: boolean;
    };
    attachments?: Array<{
      id: string;
      type: 'image' | 'document' | 'link';
      name: string;
      url: string;
      size?: number;
    }>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  benchmarkingMode: {
    type: String,
    enum: ['full-context', 'sliding-window', 'stateless'],
    default: 'full-context'
  },
  groupId: String,
  groupLabel: String,
  slidingWindowSize: Number,
  messages: [{
    id: String,
    role: {
      type: String,
      enum: ['user', 'assistant']
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    responses: [{
      model: String,
      provider: String,
      color: String,
      response: String,
      latency: Number,
      tokens: Number,
      duration: Number,
      isStreaming: Boolean,
      isSelected: Boolean,
      estimatedCost: Number,
      maxTokens: Number,
      tokensPerSecond: Number,
      modelType: String
    }],
    selectedModel: String,
    optimizedPrompt: String,
    benchmarkingSettings: {
      temperature: Number,
      maxTokens: Number,
      topP: Number,
      streamingEnabled: Boolean
    },
    attachments: [{
      id: String,
      type: {
        type: String,
        enum: ['image', 'document', 'link']
      },
      name: String,
      url: String,
      size: Number
    }]
  }]
}, {
  timestamps: true
});

// Indices for performance
conversationSchema.index({ userId: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ createdAt: -1 });

export default mongoose.model<IConversation>('Conversation', conversationSchema);