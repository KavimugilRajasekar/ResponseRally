import { connectDB } from './server/config/db';
import User from './server/models/User';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function createTestUser() {
    try {
        await connectDB();

        const email = 'test@example.com';
        const existing = await User.findOne({ email });

        if (existing) {
            console.log('Test user already exists.');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password', salt);

            const user = new User({
                email,
                password: hashedPassword,
                name: 'Test User',
                isVerified: true,
                customProviders: []
            });

            await user.save();
            console.log('Test user created: test@example.com / password');
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Failed to create test user:', err);
        process.exit(1);
    }
}

createTestUser();
