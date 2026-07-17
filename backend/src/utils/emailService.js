const nodemailer = require('nodemailer');

// Email configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'muneebwaseem78@gmail.com';
const ADMIN_EMAIL_2 = process.env.ADMIN_EMAIL_2 || 'billings.finitivegroup@gmail.com';
const ALL_ADMIN_EMAILS = [ADMIN_EMAIL, ADMIN_EMAIL_2].join(', ');

// Create transporter (using Gmail as example)
const createTransporter = () => {
  // If no SMTP credentials provided, use console logging (development mode)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  No SMTP credentials found. Emails will be logged to console.');
    return {
      sendMail: async (options) => {
        console.log('\n📧 EMAIL WOULD BE SENT:');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Text:', options.text);
        console.log('HTML:', options.html);
        return { messageId: 'development-mode' };
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send verification code email
 */
async function sendVerificationCode(code, action, userName) {
  try {
    const transporter = createTransporter();

    const actionDescriptions = {
      reset_volume: 'Reset Merchant Volume',
      reset_ticket_size: 'Reset Merchant Ticket Size',
      toggle_merchant: 'Toggle Merchant Status',
      create_brand: 'Create New Brand',
      assign_merchant: 'Assign Merchant to Brand',
    };

    const actionText = actionDescriptions[action] || action;

    const mailOptions = {
      from: `PayTerminal System <${process.env.SMTP_USER || 'noreply@payterminal.com'}>`,
      to: ALL_ADMIN_EMAILS,
      subject: `Verification Code Required: ${actionText}`,
      text: `
Verification Code Required

User: ${userName}
Action: ${actionText}
Verification Code: ${code}

This code will expire in 10 minutes.

If you did not request this action, please contact your administrator immediately.

---
PayTerminal Compliance System
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .code-box { background: white; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
    .code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: 'Courier New', monospace; }
    .info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2563eb; border-radius: 4px; }
    .warning { background: #fef3c7; padding: 15px; margin: 15px 0; border-left: 4px solid #f59e0b; border-radius: 4px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Verification Code Required</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>A verification code has been requested for a sensitive action in the PayTerminal system.</p>
      
      <div class="info">
        <p><strong>User:</strong> ${userName}</p>
        <p><strong>Action:</strong> ${actionText}</p>
      </div>

      <div class="code-box">
        <p style="margin: 0 0 10px 0; color: #6b7280;">Your Verification Code:</p>
        <div class="code">${code}</div>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">Valid for 10 minutes</p>
      </div>

      <div class="warning">
        <p style="margin: 0;"><strong>⚠️ Security Notice:</strong> If you did not request this action, please contact your administrator immediately.</p>
      </div>

      <p>This code is required to complete the requested action. Please provide it to the user who requested it.</p>
    </div>
    <div class="footer">
      <p>PayTerminal Compliance System</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendVerificationCode,
  ADMIN_EMAIL,
  ADMIN_EMAIL_2,
  ALL_ADMIN_EMAILS,
};
