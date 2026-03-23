import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const testEmail = async () => {
    console.log('Testing email with:', process.env.EMAIL_USER);
    // Log the password length and if it has quotes
    const pass = process.env.EMAIL_PASS || '';
    console.log('Password length:', pass.length);
    console.log('Starts with quote:', pass.startsWith('"'));
    console.log('Ends with quote:', pass.endsWith('"'));

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: pass.replace(/^"|"$/g, '') // Clean quotes for the test
        }
    });

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email',
            text: 'This is a test email'
        });
        console.log('Email sent successfully!');
    } catch (error) {
        console.error('Email failed:', error);
    }
};

testEmail();
