import nodemailer from 'nodemailer';

/**
 * Gmail Email Manager for sending emails using Gmail SMTP
 */
class GmailEmailManager {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Log configuration (without sensitive data)
    console.log('Gmail Email Manager configured with:');
    console.log('- Email User:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'Not configured');
    console.log('- Email Service: Gmail');
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - Email HTML content
   * @param {string} [options.text] - Email text content
   * @returns {Promise<Object>} - Result of the email sending operation
   */
  async sendEmail(options) {
    try {
      const { to, subject, html, text } = options;
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || `"Donation App" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if text not provided
      };
      
      console.log(`Sending email to ${to} with subject "${subject}"`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
  
  /**
   * Send a verification email
   * @param {string} email - Recipient email
   * @param {string} token - Verification token
   * @param {string} [name] - Recipient name
   */
  async sendVerificationEmail(email, token, name = '') {
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    const subject = 'Verify your email address';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
        <p>Hello${name ? ' ' + name : ''},</p>
        <p>Thank you for registering with our donation platform. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p>If the button doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
        <p>Thank you,<br>The Donation Team</p>
      </div>
    `;
    
    return this.sendEmail({ to: email, subject, html });
  }
  
  /**
   * Send a password reset email
   * @param {string} email - Recipient email
   * @param {string} token - Reset token
   * @param {string} [name] - Recipient name
   */
  async sendPasswordResetEmail(email, token, name = '') {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const subject = 'Reset your password';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Reset Your Password</h2>
        <p>Hello${name ? ' ' + name : ''},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If the button doesn't work, you can also click on the link below or copy and paste it into your browser:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>Thank you,<br>The Donation Team</p>
      </div>
    `;
    
    return this.sendEmail({ to: email, subject, html });
  }
}

// Export instance for use in other modules
export default new GmailEmailManager(); 