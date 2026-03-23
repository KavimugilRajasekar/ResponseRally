-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "otp" TEXT,
    "otpExpires" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "totalPrompts" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "totalCostEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "favoriteModel" TEXT,
    "modelWins" JSONB NOT NULL DEFAULT '{}',
    "modelMetrics" JSONB NOT NULL DEFAULT '{}',
    "performanceHistory" JSONB NOT NULL DEFAULT '[]',
    "customProviders" JSONB NOT NULL DEFAULT '[]',
    "recentSelections" JSONB NOT NULL DEFAULT '[]',
    "optimizerModelId" TEXT NOT NULL DEFAULT 'arcee-ai/trinity-large-preview:free',
    "optimizerProvider" TEXT NOT NULL DEFAULT 'OpenRouter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "benchmarkingMode" TEXT NOT NULL DEFAULT 'full-context',
    "groupId" TEXT,
    "groupLabel" TEXT,
    "slidingWindowSize" INTEGER,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
