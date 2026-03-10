import { connectDB } from './server/config/db';
import User from './server/models/User';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    try {
        console.log('Connecting to DB...');
        await connectDB();
        console.log('Connected.');

        console.log('Finding a user...');
        const user = await User.findOne({});
        console.log('Found user:', user ? user.email : 'No user found');

        if (user) {
            console.log('Testing customProviders field access...');
            console.log('customProviders:', user.customProviders);
        }

        await mongoose.connection.close();
        console.log('Closed connection.');
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

test();
