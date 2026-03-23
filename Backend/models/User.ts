import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  otp?: string;
  otpExpires?: Date;
  isVerified: boolean;
  totalPrompts: number;
  totalTokensUsed: number;
  totalCostEstimate: number;
  favoriteModel?: string;
  modelWins: Map<string, number>;
  modelMetrics: Map<string, {
    totalBenchmarked: number;
    totalWins: number;
    activatedAt: Date;
    deactivatedAt?: Date;
    isActive: boolean;
  }>;
  performanceHistory: {
    date: Date;
    metrics: Map<string, { wins: number; usages: number }>;
  }[];
  customProviders: {
    id: string;
    providerName: string;
    baseUrl: string;
    chatEndpointPath: string;
    apiKey: string;
    organizationId?: string;
    projectId?: string;
    region?: string;
    apiVersion?: string;
    authHeaderName: 'Authorization' | 'x-api-key';
    authPrefix: 'Bearer' | 'None';
    modelName: string;
    modelType: 'chat' | 'completion' | 'embedding' | 'image';
    requestFormatType: 'openai' | 'anthropic' | 'gemini';
    supportsStreaming: boolean;
    supportsSystemRole: boolean;
    returnsUsage: boolean;
    returnsCost: boolean;
    isActive: boolean;
    color: string;
  }[];
  optimizerModelId?: string;
  optimizerProvider?: string;
}

const userSchema: Schema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  otp: String,
  otpExpires: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  totalPrompts: {
    type: Number,
    default: 0
  },
  totalTokensUsed: {
    type: Number,
    default: 0
  },
  totalCostEstimate: {
    type: Number,
    default: 0
  },
  favoriteModel: String,
  modelWins: {
    type: Map,
    of: Number,
    default: {}
  },
  modelMetrics: {
    type: Map,
    of: {
      totalBenchmarked: Number,
      totalWins: Number,
      activatedAt: Date,
      deactivatedAt: Date,
      isActive: Boolean
    },
    default: {}
  },
  performanceHistory: [{
    date: Date,
    metrics: {
      type: Map,
      of: {
        wins: Number,
        usages: Number
      }
    }
  }],
  customProviders: [{
    id: String,
    providerName: String,
    baseUrl: String,
    chatEndpointPath: String,
    apiKey: String,
    organizationId: String,
    projectId: String,
    region: String,
    apiVersion: String,
    authHeaderName: {
      type: String,
      enum: ['Authorization', 'x-api-key']
    },
    authPrefix: {
      type: String,
      enum: ['Bearer', 'None']
    },
    modelName: String,
    modelType: {
      type: String,
      enum: ['chat', 'completion', 'embedding', 'image']
    },
    requestFormatType: {
      type: String,
      enum: ['openai', 'anthropic', 'gemini']
    },
    supportsStreaming: {
      type: Boolean,
      default: true
    },
    supportsSystemRole: {
      type: Boolean,
      default: true
    },
    returnsUsage: {
      type: Boolean,
      default: true
    },
    returnsCost: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    color: String
  }],
  recentSelections: [{
    conversationId: String,
    modelName: String,
    timestamp: { type: Date, default: Date.now }
  }],
  optimizerModelId: {
    type: String,
    default: "arcee-ai/trinity-large-preview:free"
  },
  optimizerProvider: {
    type: String,
    default: "OpenRouter"
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function () {
  const user = this as any;
  if (!user.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

export default mongoose.model<IUser>('User', userSchema);