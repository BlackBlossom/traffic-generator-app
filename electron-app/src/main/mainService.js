// mainService.js - Main application service for database and business logic
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const trafficAnalytics = require('./services/trafficAnalytics');
const campaignScheduler = require('./services/campaignScheduler');
const logEventHub = require('./services/logEventHub');

/**
 * Main application service class
 * Manages database connections, services initialization, and lifecycle
 */
class MainService {
  constructor() {
    this.isInitialized = false;
    this.analyticsInterval = null;
  }

  /**
   * Initialize all main process services
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ MainService already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing MainService...');

      // Connect to MongoDB (non-blocking)
      const dbConnected = await connectDB();
      if (dbConnected) {
        console.log('✅ Database connection established');
        // Wait for MongoDB connection to be ready
        await this.waitForMongoConnection();
        
        // Initialize campaign scheduler only if DB is connected
        await campaignScheduler.initialize();
        console.log('✅ Campaign scheduler initialized');
      } else {
        console.log('⚠️ Continuing without database...');
      }

      // Initialize traffic analytics (works without DB)
      try {
        trafficAnalytics.initialize?.();
        console.log('✅ Traffic analytics initialized');
      } catch (analyticsError) {
        console.error('❌ Traffic analytics initialization failed:', analyticsError.message);
      }

      // Start analytics broadcasting
      try {
        this.startAnalyticsBroadcast();
      } catch (broadcastError) {
        console.error('❌ Analytics broadcast initialization failed:', broadcastError.message);
      }

      this.isInitialized = true;
      console.log('✅ MainService initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize MainService:', error.message);
      console.log('⚠️ MainService will continue with limited functionality');
      this.isInitialized = true; // Mark as initialized even with errors
    }
  }

  /**
   * Wait for MongoDB connection to be established
   */
  async waitForMongoConnection() {
    return new Promise((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('MongoDB connection timeout'));
      }, 30000); // 30 second timeout

      mongoose.connection.once('open', () => {
        clearTimeout(timeout);
        console.log('✅ MongoDB connection established');
        resolve();
      });

      mongoose.connection.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Start periodic analytics broadcasting
   */
  startAnalyticsBroadcast() {
    if (this.analyticsInterval) {
      console.log('⚠️ Analytics broadcasting already started');
      return;
    }

    // Broadcast analytics every 30 seconds
    this.analyticsInterval = setInterval(() => {
      this.broadcastAnalytics();
    }, 30000);

    // Initial broadcast after 5 seconds
    setTimeout(() => {
      this.broadcastAnalytics();
    }, 5000);

    console.log('📊 Analytics broadcasting started (every 30 seconds)');
  }

  /**
   * Broadcast analytics data to all connected windows
   */
  async broadcastAnalytics() {
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();

      for (const window of windows) {
        if (!window.isDestroyed()) {
          // Broadcast general analytics update event
          window.webContents.send('analytics-broadcast', {
            timestamp: new Date().toISOString(),
            type: 'periodic_update'
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to broadcast analytics:', error);
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      status: this.isInitialized ? 'OK' : 'INITIALIZING',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        campaignScheduler: campaignScheduler.isInitialized ? 'Running' : 'Stopped',
        analyticsService: 'Running',
        logEventHub: 'Running'
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Gracefully shutdown all services
   */
  async shutdown() {
    console.log('🛑 Shutting down MainService...');

    try {
      // Stop analytics broadcasting
      if (this.analyticsInterval) {
        clearInterval(this.analyticsInterval);
        this.analyticsInterval = null;
        console.log('✅ Analytics broadcasting stopped');
      }

      // Shutdown campaign scheduler
      if (campaignScheduler.shutdown) {
        await campaignScheduler.shutdown();
        console.log('✅ Campaign scheduler shutdown');
      }

      // Close MongoDB connection
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
      }

      this.isInitialized = false;
      console.log('✅ MainService shutdown complete');

    } catch (error) {
      console.error('❌ Error during MainService shutdown:', error);
      throw error;
    }
  }

  /**
   * Restart services (useful for development)
   */
  async restart() {
    console.log('🔄 Restarting MainService...');
    await this.shutdown();
    await this.initialize();
    console.log('✅ MainService restarted');
  }
}

// Create singleton instance
const mainService = new MainService();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await mainService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  try {
    await mainService.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = mainService;
