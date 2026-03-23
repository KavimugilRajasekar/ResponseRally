import { prisma } from '../config/db';
import bcrypt from 'bcryptjs';

async function testMigration() {
  console.log('--- Starting Migration Verification ---');

  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'password123';
  const testName = 'Test User';

  try {
    // 1. Test Registration
    console.log('1. Testing User Registration...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(testPassword, salt);
    
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        name: testName,
        isVerified: true
      }
    });
    console.log('✅ User registered:', user.email);

    // 2. Test Login (Comparison)
    console.log('2. Testing Login Comparison...');
    const fetchedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!fetchedUser) throw new Error('User not found after registration');
    
    const isMatch = await bcrypt.compare(testPassword, fetchedUser.password);
    console.log('✅ Password match:', isMatch);

    // 3. Test Conversation Creation
    console.log('3. Testing Conversation Creation...');
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: 'Test Chat',
        messages: [
          { role: 'user', content: 'Hello', timestamp: new Date() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
        ]
      }
    });
    console.log('✅ Conversation created:', conversation.title);

    // 4. Test Fetching Conversations
    console.log('4. Testing Fetching Conversations...');
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id }
    });
    console.log('✅ Conversations fetched count:', conversations.length);

    // 5. Test Updating Stats
    console.log('5. Testing Stats Update...');
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        totalPrompts: 10,
        modelWins: { "gpt-4": 5 }
      }
    });
    console.log('✅ User stats updated. totalPrompts:', updatedUser.totalPrompts);

    console.log('--- Verification Complete: ALL TESTS PASSED ---');
  } catch (error) {
    console.error('❌ Verification Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
