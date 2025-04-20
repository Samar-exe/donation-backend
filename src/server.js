import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import referralRoutes from './routes/referralRoutes.js';

// Load environment variables early
dotenv.config();

// Print loaded environment variables (without sensitive values)
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Set ✓' : 'Missing ✗');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set ✓' : 'Missing ✗');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set ✓' : 'Missing ✗');
console.log('- EMAIL_CONFIG:', process.env.EMAIL_USER && process.env.EMAIL_PASS ? 'Set ✓' : 'Missing ✗');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL ? 'Set ✓' : 'Missing ✗');

// Detect environment
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Running in ${isProduction ? 'production' : 'development'} mode`);

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// Compression for better performance
app.use(compression());

// Basic rate limiting - more strict in production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 60 : 1000, // stricter limit in production
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Middleware
app.use(express.json({ limit: '1mb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: false, limit: '1mb' })); // Limit URL-encoded body size
app.use(cookieParser());

// Before CORS config, log environment variables for debugging
console.log('Environment configuration:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- BACKEND_URL:', process.env.BACKEND_URL);
console.log('- PORT:', process.env.PORT);

// CORS configuration - more restrictive in production
app.use(cors({
  origin: function(origin, callback) {
    // Always log the origin for debugging
    console.log('CORS origin check:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
      'http://192.168.134.168:5173',
      'http://192.168.134.168:4173',
      'https://nurnexus.netlify.app',
      'https://donation-zakah.netlify.app'
    ];
    
    console.log('Allowed origins:', allowedOrigins);
    
    if(allowedOrigins.indexOf(origin) !== -1 || !origin) {
      console.log('CORS: Origin allowed -', origin);
      callback(null, true);
    } else {
      console.log('CORS: Origin blocked -', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));

// Add pre-flight OPTIONS response for all routes
app.options('*', cors());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/referral', referralRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API documentation route
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Donation API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        googleAuth: 'POST /api/auth/google',
        verifyEmail: 'GET /api/auth/verify-email/:token',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password',
        getCurrentUser: 'GET /api/auth/me',
        updateProfile: 'PUT /api/auth/profile',
      },
      referral: {
        getReferralInfo: 'GET /api/referral',
        applyReferralCode: 'POST /api/referral/apply',
        shareReferralLink: 'POST /api/referral/share',
        getSawabPoints: 'GET /api/referral/points'
      }
    }
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Log the error
  console.error(`[ERROR] ${statusCode} - ${err.message}`);
  console.error(err.stack);
  
  // Send response without exposing error details in production
  res.status(statusCode).json({ 
    message: statusCode === 500 ? 'Server error' : err.message, 
    error: isProduction ? null : {
      stack: err.stack,
      details: err.details || null
    }
  });
});

// Process error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  // Give server a chance to finish current requests before shutting down
  server.close(() => {
    process.exit(1);
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to database after server starts
  connectDB().catch(err => {
    console.error('Failed to connect to MongoDB. Server will continue to run but database features will not work.');
    console.error(err);
  });
});

export default app; 