# Donation Backend

Backend API for the Donation application. This server handles user authentication, email verification, and donation services.

## Features

- User authentication (Register, Login)
- Email verification
- Google OAuth integration
- Password reset functionality
- Rate limiting and security features

## Tech Stack

- Node.js
- Express.js
- MongoDB
- JWT Authentication
- Nodemailer

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=5000
NODE_ENV=production  # 'development' or 'production'

# MongoDB Configuration
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/your_database

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="Your App Name <your_email@gmail.com>"

# Frontend URL (for CORS and redirects)
FRONTEND_URL=https://your-frontend-domain.com
BACKEND_URL=https://api.your-domain.com
```

## Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm run prod
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `GET /api/auth/verify-email/:token` - Verify email with token
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Google Sign In
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

## Production Deployment

### Prerequisites

- Node.js 16+ installed
- MongoDB Atlas account (or other MongoDB hosting)
- Email service credentials (Gmail or other SMTP provider)

### Steps for Production Deployment

1. **Set Environment Variables**

   Update the `.env` file with production values, especially:
   - `NODE_ENV=production`
   - `JWT_SECRET` with a strong secret
   - `MONGODB_URI` with your production database
   - `FRONTEND_URL` with your frontend domain
   - `BACKEND_URL` with your API domain

2. **Build and Start**

   ```bash
   # Install dependencies
   npm install

   # Start the production server
   npm run prod
   ```

3. **Using Process Manager (Recommended)**

   For production, use a process manager like PM2:

   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Start the application with PM2
   pm2 start npm --name "donation-api" -- run prod

   # Save PM2 configuration
   pm2 save

   # Setup PM2 to start on system boot
   pm2 startup
   ```

4. **Setup Reverse Proxy**

   Configure Nginx or Apache as a reverse proxy:

   ```nginx
   # Example Nginx configuration
   server {
     listen 80;
     server_name api.yourdonationapp.com;

     location / {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

5. **Setup SSL (Recommended)**

   Use Let's Encrypt for free SSL:

   ```bash
   sudo certbot --nginx -d api.yourdonationapp.com
   ```

6. **Monitor the Application**

   ```bash
   # Check logs
   pm2 logs donation-api

   # Monitor application
   pm2 monit
   ```

## Security Considerations

- The app includes rate limiting to prevent abuse
- Helmet is used for secure HTTP headers
- Email verification helps prevent spam accounts
- Passwords are securely hashed with bcrypt
- JWT tokens are used for authentication

## Maintenance

- Regularly update dependencies with `npm audit fix`
- Monitor server logs for any issues
- Backup your MongoDB database regularly 