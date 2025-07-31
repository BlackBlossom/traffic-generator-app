# RST - Advance Website Seo Tool - Setup Guide

A comprehensive web traffic generation tool with Electron frontend and Node.js backend.

## 📋 Prerequisites

Before setting up the application, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Docker** (recommended for databases) - [Download here](https://www.docker.com/get-started)
- **MongoDB** (for campaign data storage) - [Download here](https://www.mongodb.com/try/download/community) **OR use Docker**
- **Redis** (for logging and real-time data) - [Download here](https://redis.io/download) **OR use Docker**
- **Git** (for version control) - [Download here](https://git-scm.com/)

## 🗂️ Project Structure

```
traffic-generator-app/
├── backend/                    # Node.js backend server
│   ├── controllers/           # API route controllers
│   ├── models/               # MongoDB schemas
│   ├── routes/               # Express routes
│   ├── services/             # Business logic services
│   ├── traffic-worker/       # Puppeteer traffic generation
│   ├── middleware/           # Custom middleware
│   ├── config/               # Database configuration
│   ├── package.json          # Backend dependencies
│   └── server.js             # Main server file
├── electron-app/              # Electron frontend application
│   ├── src/                  # React source code
│   ├── public/               # Static assets
│   ├── forge.config.js       # Electron Forge configuration
│   └── package.json          # Frontend dependencies
└── SETUP.md                  # This file
```

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd traffic-generator-app
```

## 🐳 Docker Setup (Recommended for Redis)

Using Docker is the easiest way to set up Redis without complex local installation.

### Quick Docker Commands

**Start Redis:**
```bash
# Start Redis
docker run --name redis-traffic-gen -p 6379:6379 -d redis:alpine

# Verify container is running
docker ps
```

**Using Docker Compose (Alternative):**

Create a `docker-compose.yml` file in the project root:
```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    container_name: redis-traffic-gen
    ports:
      - "6379:6379"
    restart: unless-stopped
```

Then run:
```bash
# Start Redis service
docker-compose up -d

# Stop Redis service
docker-compose down

# View logs
docker-compose logs
```

### 2. Setup Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

#### Environment Configuration

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database Configuration
MONGODB_URI=your-mongodb-atlas-uri-here
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secure-jwt-secret-key-here

# Proxy Configuration (if using custom proxy)
PROXY_HOST=gw.dataimpulse.com
PROXY_PORT=823
PROXY_USER=your-proxy-username
PROXY_PASS=your-proxy-password

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

#### Start Required Services

**Redis with Docker (Recommended):**
```bash
# Pull Redis Docker image
docker pull redis:alpine

# Run Redis container
docker run --name redis-traffic-gen -p 6379:6379 -d redis:alpine

# Verify Redis is running
docker ps

# Test Redis connection
docker exec -it redis-traffic-gen redis-cli ping

# Stop Redis container
docker stop redis-traffic-gen

# Start existing Redis container
docker start redis-traffic-gen

# Remove Redis container (if needed)
docker rm redis-traffic-gen
```

**Alternative: Native Redis Installation**
```bash
# On Windows (if Redis is installed)
redis-server

# On macOS
brew services start redis

# On Linux
sudo systemctl start redis-server
```

**MongoDB Configuration:**
Since you're using your own MongoDB URI, ensure your connection string is properly configured in the `.env` file:
```env
MONGODB_URI=your-mongodb-atlas-uri-here
```

#### Test Backend Services

Before starting the backend, verify that your services are working:

**Test Redis Connection:**
```bash
# Test Redis with the included test script
node test-redis.js

# Or test manually with Redis CLI
redis-cli ping
# Should return: PONG

# Test via Docker
docker exec -it redis-traffic-gen redis-cli ping
```

**Test MongoDB Connection:**
Your MongoDB connection will be tested automatically when the backend starts. Make sure your `MONGODB_URI` in the `.env` file is correct.

#### Start Backend Development Server

```bash
npm run dev
```

The backend server will start on `http://localhost:3001`

**Note**: Make sure your frontend API configuration points to port 3001, not 5000.

### 3. Setup Electron App

Open a new terminal and navigate to the electron-app directory:

```bash
cd electron-app
npm install
```

#### Start Electron Application

```bash
npm run start
```

The Electron app will launch with the React frontend.

## 📝 Available Scripts

### Backend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend in development mode with nodemon |
| `npm start` | Start backend in production mode |
| `npm test` | Run backend tests (if configured) |
| `npm run lint` | Run ESLint on backend code |

### Electron App Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start Electron app in development mode |
| `npm run package` | Package the app for current platform |
| `npm run make` | Build distributable packages |
| `npm run publish` | Publish the app (requires configuration) |
| `npm run lint` | Run ESLint on frontend code |

## 🔧 Configuration

### Backend Configuration

The backend uses the following key configuration files:

- **`server.js`** - Main Express server setup
- **`config/db.js`** - MongoDB connection configuration
- **`services/redisLogger.js`** - Redis logging service
- **`traffic-worker/traffic.js`** - Puppeteer automation engine

### Frontend Configuration

The Electron app configuration:

- **`forge.config.js`** - Electron Forge build configuration
- **`src/main.js`** - Electron main process
- **`src/preload.js`** - Preload script for security
- **`src/renderer/`** - React frontend components

## 🎯 Features

### Traffic Generation
- **Multi-device Support**: Desktop and mobile traffic simulation
- **Smart Ad Targeting**: CSS selectors and X-Path support for ad clicking
- **Geographic Targeting**: Country-specific traffic simulation
- **Referral Sources**: Social media, organic, and custom referrers
- **Session Duration Ranges**: Realistic visit duration simulation
- **Proxy Support**: Built-in proxy rotation capabilities

### Analytics & Monitoring
- **Real-time Monitoring**: Live session tracking via WebSocket
- **Campaign Analytics**: Detailed performance metrics
- **Debug Logging**: Comprehensive logging with 10k logs per campaign
- **Traffic Sources**: Breakdown by organic, social, direct, and referral
- **Device Analytics**: Desktop vs mobile traffic analysis

### User Interface
- **Modern React UI**: Responsive design with dark/light themes
- **Campaign Management**: Create, schedule, and manage campaigns
- **Real-time Logs**: Live traffic session monitoring
- **Analytics Dashboard**: Visual charts and statistics
- **User Authentication**: Secure API key-based access

## 🐛 Troubleshooting

### Common Issues

#### Backend Won't Start

1. **Check MongoDB Connection:**
   ```bash
   # Verify your MongoDB URI is correct in .env file
   # The backend will show MongoDB connection errors in console
   ```

2. **Check Redis Connection:**
   ```bash
   # Test Redis connection
   redis-cli ping
   ```

3. **Port Already in Use:**
   ```bash
   # Kill process on port 3001
   npx kill-port 3001
   ```

#### Electron App Issues

1. **Clear Electron Cache:**
   ```bash
   # Clear Electron cache
   npm run start -- --clear-cache
   ```

2. **Rebuild Native Dependencies:**
   ```bash
   # Rebuild native modules
   npm rebuild
   ```

#### Puppeteer Issues

1. **Install Chromium Dependencies (Linux):**
   ```bash
   # Install required libraries
   sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2
   ```

2. **Headless Mode Problems:**
   - Ensure you have sufficient headful percentage for ad targeting
   - Ad targeting only works in headful mode

### Performance Optimization

1. **Adjust Concurrent Sessions:**
   - Reduce concurrent sessions if experiencing high CPU/memory usage
   - Default chunk size is 50 browsers per batch

2. **Memory Management:**
   - Monitor Redis memory usage for logging
   - Campaign logs are limited to 10k entries per campaign

3. **Proxy Configuration:**
   - Ensure proxy credentials are correct
   - Test proxy connectivity before running campaigns

## 📊 Logging & Debugging

### Backend Logs
- Server logs are output to console in development mode
- Use `npm run dev` for detailed logging
- Redis logs store session data for debugging

### Frontend Logs
- Electron main process logs in terminal
- Renderer process logs in DevTools (Ctrl+Shift+I)
- Network logs available in browser DevTools

### Traffic Session Logs
- Real-time WebSocket logging
- Persistent Redis storage
- Debug logs include:
  - Ad targeting success/failure
  - Element detection results
  - Mouse movement and clicking
  - Redirect handling
  - Session completion statistics

## 🔐 Security Considerations

1. **API Keys**: Store API keys securely, regenerate regularly
2. **CORS**: Configure CORS_ORIGIN for production deployment
3. **Environment Variables**: Never commit `.env` files to version control
4. **Proxy Credentials**: Secure proxy authentication details
5. **Database Access**: Secure MongoDB and Redis with authentication

## 📈 Production Deployment

### Backend Deployment
1. Set `NODE_ENV=production` in environment
2. Use process manager like PM2
3. Configure reverse proxy (nginx)
4. Set up SSL certificates
5. Configure database replicas for high availability

### Electron App Distribution
1. Build distributable packages: `npm run make`
2. Sign applications for security
3. Set up auto-updater for seamless updates
4. Configure crash reporting

## 🤝 Support

For issues and questions:
1. Check this setup guide first
2. Review error logs for specific issues
3. Test individual components (MongoDB, Redis, proxy)
4. Verify environment configuration

## 📋 System Requirements

### Minimum Requirements
- **RAM**: 4GB (8GB recommended for multiple campaigns)
- **CPU**: Dual-core processor
- **Storage**: 2GB free space
- **Network**: Stable internet connection

### Recommended Specifications
- **RAM**: 16GB or higher
- **CPU**: Quad-core processor or better
- **Storage**: SSD with 10GB+ free space
- **Network**: High-speed broadband connection

---

✅ **Ready to Start**: Once both backend and frontend are running, you can access RST - Advance Website Seo Tool through the Electron app and begin creating SEO campaigns!
