import express from 'express';
import {
  register,
  login,
  googleLogin,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateProfile);

// Test route to make sure auth is working
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working' });
});

// Test Google configuration
router.get('/test-google', (req, res) => {
  res.json({ 
    googleEnabled: !!process.env.GOOGLE_CLIENT_ID,
    clientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'Not configured',
    endpoints: {
      googleLogin: '/api/auth/google',
      method: 'POST',
      required: { idToken: 'string' },
      response: { token: 'string', user: { id: 'string', email: 'string', isVerified: 'boolean' } }
    }
  });
});

export default router; 