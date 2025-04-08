import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import gmailEmailManager from '../sendgridEmailManager.js';
import { verifyIdToken } from '../config/googleAuth.js';
import generateToken from '../utils/generateToken.js';

// Create a Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Configure nodemailer with a different approach
// Using a transporter that logs emails to console instead of sending
// This is a good approach for development without needing real email credentials

let transporter;

if (process.env.NODE_ENV === 'production') {
  // Production email setup
  console.log('Setting up production email transport with:');
  console.log('- EMAIL_HOST:', process.env.EMAIL_HOST);
  console.log('- EMAIL_PORT:', process.env.EMAIL_PORT);
  console.log('- EMAIL_USER:', process.env.EMAIL_USER ? 'Set ✓' : 'Missing ✗');
  console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set ✓' : 'Missing ✗');
  console.log('- EMAIL_FROM:', process.env.EMAIL_FROM);
  
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: parseInt(process.env.EMAIL_PORT || '587') === 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // do not fail on invalid certs
      rejectUnauthorized: false
    }
  };
  
  console.log('Creating transport with config:', JSON.stringify({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: { user: emailConfig.auth.user ? 'CONFIGURED' : 'MISSING', pass: emailConfig.auth.pass ? 'CONFIGURED' : 'MISSING' }
  }));
  
  transporter = nodemailer.createTransport(emailConfig);
  
  // Verify the connection
  transporter.verify(function (error, success) {
    if (error) {
      console.error('SMTP server connection error:', error);
    } else {
      console.log('SMTP Server is ready to send messages');
    }
  });
} else {
  // Development email setup - logs to console
  console.log('Using development email setup - emails will be logged to console');
  transporter = {
    sendMail: (mailOptions) => {
      return new Promise((resolve) => {
        console.log('\n-------- EMAIL SENT --------');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log('HTML Content Preview:', mailOptions.html.substring(0, 50) + '...');
        
        // Extract verification link if it exists
        const linkMatch = mailOptions.html.match(/href="([^"]*verify[^"]*)"/);
        if (linkMatch) {
          console.log('Verification Link:', linkMatch[1]);
        }
        
        console.log('----------------------------\n');
        resolve({ messageId: 'test-email-id' });
      });
    }
  };
}

// @desc    Register a new user
// @route   POST /auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      console.log('Registration failed: User already exists -', email);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    console.log('Generated verification token for:', email);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with isVerified set to false initially
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      verificationToken,
      verificationTokenExpiry,
      isVerified: false
    });

    console.log('User created successfully:', user._id);

    // Generate verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    console.log('Verification URL:', verificationUrl);

    // Send verification email with enhanced template
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Donation App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4CAF50;">Email Verification</h1>
            </div>
            
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${name || 'there'},</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Thank you for registering with our Donation App! To complete your registration, please verify your email address.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
            
            <p style="font-size: 14px; color: #1a73e8; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              If you didn't request this email, you can safely ignore it.
            </p>
          </div>
        `
      });
      console.log('Verification email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't return error to client, just log it
      // The user is still created, they just didn't receive the email
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify email with token
// @route   GET /auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user by verification token
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }
    
    // Update user to verified and remove token
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    // Generate JWT token for auto login
    const jwtToken = generateToken(user._id);
    
    res.status(200).json({
      message: 'Email verified successfully',
      _id: user._id,
      email: user.email,
      name: user.name || '',
      isVerified: user.isVerified,
      token: jwtToken
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    console.log('Login attempt:', req.body.email);
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (!user) {
      console.log('Login failed: User not found -', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Track login attempts for security
    if (user.accountLocked) {
      console.log('Login failed: Account locked -', email);
      return res.status(401).json({ message: 'Your account has been locked due to too many failed login attempts. Please reset your password or contact support.' });
    }

    // Check if the user is verified (except for OAuth users who are auto-verified)
    if (!user.isVerified && !user.googleId && !user.facebookId) {
      console.log('Login failed: Email not verified -', email);
      
      // Generate a new verification token to resend
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      
      user.verificationToken = verificationToken;
      user.verificationTokenExpiry = verificationTokenExpiry;
      await user.save();
      
      // Generate verification URL
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      // Resend verification email
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || `"Donation App" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Verify your email address',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4CAF50;">Email Verification</h1>
              </div>
              
              <p style="font-size: 16px; line-height: 1.5; color: #333;">Please verify your email address to login to the Donation App.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email</a>
              </div>
              
              <p style="font-size: 14px; color: #666;">If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
              
              <p style="font-size: 14px; color: #1a73e8; word-break: break-all;">
                ${verificationUrl}
              </p>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
            </div>
          `
        });
        console.log('Verification email resent to:', email);
      } catch (emailError) {
        console.error('Failed to resend verification email:', emailError);
      }
      
      return res.status(401).json({ 
        message: 'Please verify your email before logging in. A new verification email has been sent.' 
      });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('Login failed: Invalid password -', email);
      
      // Increment login attempts for security
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.accountLocked = true;
        console.log('Account locked due to too many failed attempts:', email);
      }
      
      await user.save();
      
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLogin = Date.now();
    await user.save();
    
    console.log('Login successful:', email);

    // Create token
    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Google Sign In
// @route   POST /auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      console.error('No ID token provided');
      return res.status(400).json({ message: 'ID Token is required' });
    }

    console.log('Processing Google login with token (first 20 chars):', idToken.substring(0, 20) + '...');

    // Verify Google token
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (!payload) {
        console.error('Invalid Google token - no payload');
        return res.status(400).json({ message: 'Invalid Google token' });
      }

      console.log('Google payload received for:', payload.email);
      const { email, name, picture, sub: googleId } = payload;

      // Find or create user
      let user = await User.findOne({ email });

      if (user) {
        console.log('Existing user found:', user._id);
        // Update the user's Google ID if not already set
        if (!user.googleId) {
          user.googleId = googleId;
          await user.save();
          console.log('Updated user with Google ID');
        }
        
        // Check if email is verified in our system
        if (!user.isVerified && payload.email_verified) {
          user.isVerified = true;
          await user.save();
          console.log('Updated user verification status');
        }
      } else {
        console.log('Creating new user from Google login');
        // Create a new user with Google information
        const randomPassword = crypto.randomBytes(20).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        user = await User.create({
          email,
          password: hashedPassword,
          name: name || '',
          profilePicture: picture || '',
          googleId,
          isVerified: payload.email_verified // Google already verified the email
        });
        console.log('New user created:', user._id);
      }

      // Create token
      const token = generateToken(user._id);
      console.log('Generated JWT token for user');

      res.status(200).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name || '',
          profilePicture: user.profilePicture || '',
          isVerified: user.isVerified
        }
      });
    } catch (verifyError) {
      console.error('Google token verification error:', verifyError);
      return res.status(401).json({ 
        message: 'Failed to verify Google token', 
        error: verifyError.message 
      });
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
};

// @desc    Get current user
// @route   GET /auth/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request password reset
// @route   POST /auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Generate reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send reset email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Donation App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #4CAF50;">Password Reset</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; color: #333;">You requested a password reset. Please click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          
          <p style="font-size: 14px; color: #666;">If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
          
          <p style="font-size: 14px; color: #1a73e8; word-break: break-all;">
            ${resetUrl}
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 1 hour.</p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
      `
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset password
// @route   POST /auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Find user with matching reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user password
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Resend verification email
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();
    
    try {
      // Construct the verification link
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const emailSubject = 'Verify your email address';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
          <p>Hello,</p>
          <p>We received a request to resend your verification email. Please verify your email address by clicking the button below:</p>
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

      if (process.env.NODE_ENV === 'production') {
        // Use Gmail Email Manager for production
        await gmailEmailManager.sendVerificationEmail(email, verificationToken);
        console.log(`Production: Verification email sent to ${email}`);
      } else {
        // Use development logger in non-production
        await transporter.sendMail({
          to: email,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log(`Development: Verification email logged for ${email}`);
      }
      
      res.status(200).json({ message: 'Verification email sent successfully' });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      res.status(500).json({ message: 'Failed to send verification email', error: emailError.message });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Export all controllers in one place - fixes duplicate exports
export {
  register,
  loginUser as login,
  googleLogin,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser
}; 