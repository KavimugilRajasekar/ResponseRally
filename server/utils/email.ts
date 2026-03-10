import nodemailer from 'nodemailer';

export const sendOTP = async (email: string, otp: string): Promise<void> => {
  // If no email credentials are set, mock the email send for development
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n=========================================`);
    console.log(`[MOCK EMAIL] OTP for ${email}: ${otp}`);
    console.log(`=========================================\n`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"ResponseRally" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code - ResponseRally',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a;">
        <div style="max-width: 480px; margin: 40px auto; padding: 40px; border: 2px solid #000000; background-color: #ffffff;">
          <div style="margin-bottom: 30px;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #666666;">ResponseRally</p>
          </div>
          
          <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700;">Verification Code</h1>
          
          <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.5; color: #444444;">
            Please use the code below to complete your authentication.
          </p>

          <div style="padding: 30px; background-color: #f5f5f5; border: 1px solid #e5e5e5; text-align: center; margin-bottom: 30px;">
            <span style="display: block; font-size: 32px; font-weight: 700; letter-spacing: 12px; color: #000000; margin-left: 12px;">${otp}</span>
          </div>

          <p style="margin: 0 0 10px; font-size: 13px; color: #999999;">
            Valid for 10 minutes. If you didn't request this, please ignore this email.
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <p style="margin: 0; font-size: 12px; color: #999999;">
              &copy; 2024 ResponseRally
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Nodemailer Error:', error);
    throw new Error('Failed to send verification email');
  }
};