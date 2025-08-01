// campaignScheduler.js
// Campaign scheduling service using node-cron for automated traffic generation

const cron = require('node-cron');
const Campaign = require('../models/Campaigns');
const redisLogger = require('./redisLogger');

class CampaignScheduler {
  constructor() {
    this.scheduledTasks = new Map(); // Store active cron tasks
    this.isInitialized = false;
  }

  // Initialize the scheduler and load existing scheduled campaigns
  async initialize() {
    try {
      console.log('🕐 Initializing Campaign Scheduler...');
      
      // Load all scheduled campaigns from database
      const scheduledCampaigns = await Campaign.find({ 
        scheduling: true, 
        isActive: false,
        status: 'scheduled'
      });

      console.log(`📅 Found ${scheduledCampaigns.length} scheduled campaigns`);

      // Set up cron jobs for each scheduled campaign
      for (const campaign of scheduledCampaigns) {
        await this.scheduleCampaign(campaign);
      }

      // Set up periodic check for campaigns that need to start/stop
      this.schedulePeriodicCheck();

      // Clean up completed campaigns every hour
      this.scheduleCleanup();

      this.isInitialized = true;
      console.log('✅ Campaign Scheduler initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Campaign Scheduler:', error);
    }
  }

  // Schedule a new campaign
  async scheduleCampaign(campaign) {
    try {
      // Use the virtual startDateTime property
      const scheduledTime = campaign.startDateTime;
      
      if (!scheduledTime) {
        throw new Error('Campaign must have valid startDate and startTime');
      }

      const now = new Date();

      // Check if scheduled time is in the future
      if (scheduledTime <= now) {
        console.log(`⚠️ Campaign ${campaign._id} scheduled time has passed, marking as expired`);
        await Campaign.findByIdAndUpdate(campaign._id, { 
          status: 'expired',
          isActive: false
        });
        return;
      }

      // Create cron expression for the scheduled time
      const cronExpression = this.createCronExpression(scheduledTime);
      
      console.log(`📅 Scheduling campaign ${campaign._id} for ${scheduledTime.toLocaleString()}`);
      
      // Create and start the cron job
      const task = cron.schedule(cronExpression, async () => {
        await this.executeCampaign(campaign._id);
      }, {
        scheduled: true,
        timezone: "UTC"
      });

      // Store the task reference
      this.scheduledTasks.set(campaign._id.toString(), {
        task,
        scheduledAt: scheduledTime,
        campaignId: campaign._id
      });

      // Log the scheduling
      await redisLogger.logCampaign(
        campaign._id,
        `📅 Campaign scheduled for ${scheduledTime.toLocaleString()}`
      );

    } catch (error) {
      console.error(`❌ Failed to schedule campaign ${campaign._id}:`, error);
      await redisLogger.logCampaign(
        campaign._id,
        `❌ Scheduling failed: ${error.message}`
      );
    }
  }

  // Schedule a newly created campaign
  async scheduleNewCampaign(campaign) {
    return this.scheduleCampaign(campaign);
  }

  // Execute a scheduled campaign
  async executeCampaign(campaignId) {
    try {
      console.log(`🚀 Executing scheduled campaign: ${campaignId}`);
      
      // Find the campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        console.error(`❌ Campaign ${campaignId} not found`);
        return;
      }

      // Update campaign status to active
      await Campaign.findByIdAndUpdate(campaignId, {
        isActive: true,
        status: 'running',
        'analytics.startedAt': new Date()
      });

      // Log the execution start
      await redisLogger.logCampaign(
        campaignId,
        `🚀 Scheduled campaign execution started at ${new Date().toLocaleString()}`
      );

      // Import and start the traffic generation
      const { campaignTrafficController } = require('../controllers/campaignTrafficController');
      
      // Get campaign details for traffic generation
      const updatedCampaign = await Campaign.findById(campaignId);
      
      // Start traffic generation
      // Note: For scheduled campaigns, we don't have WebSocket connection
      // Consider implementing a different approach for scheduled campaigns
      campaignTrafficController(updatedCampaign.toObject(), null, null);

      // Remove from scheduled tasks
      this.removeScheduledTask(campaignId.toString());

      console.log(`✅ Campaign ${campaignId} execution initiated successfully`);

    } catch (error) {
      console.error(`❌ Failed to execute campaign ${campaignId}:`, error);
      
      // Update campaign status to error
      await Campaign.findByIdAndUpdate(campaignId, {
        isActive: false,
        isScheduled: false,
        status: 'error',
        error: error.message
      });

      await redisLogger.logCampaign(
        campaignId,
        `❌ Scheduled execution failed: ${error.message}`
      );
    }
  }

  // Cancel a scheduled campaign
  async cancelScheduledCampaign(campaignId) {
    try {
      const taskInfo = this.scheduledTasks.get(campaignId.toString());
      
      if (taskInfo) {
        // Stop the cron job
        taskInfo.task.stop();
        taskInfo.task.destroy();
        
        // Remove from our tracking
        this.scheduledTasks.delete(campaignId.toString());
        
        // Update database
        await Campaign.findByIdAndUpdate(campaignId, {
          isScheduled: false,
          status: 'cancelled'
        });

        await redisLogger.logCampaign(
          campaignId,
          `🚫 Scheduled campaign cancelled`
        );

        console.log(`🚫 Cancelled scheduled campaign: ${campaignId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to cancel scheduled campaign ${campaignId}:`, error);
      return false;
    }
  }

  // Remove a scheduled task from memory
  removeScheduledTask(campaignId) {
    const taskInfo = this.scheduledTasks.get(campaignId);
    if (taskInfo) {
      taskInfo.task.stop();
      taskInfo.task.destroy();
      this.scheduledTasks.delete(campaignId);
    }
  }

  // Create cron expression from date
  createCronExpression(date) {
    const minutes = date.getUTCMinutes();
    const hours = date.getUTCHours();
    const dayOfMonth = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    
    // One-time execution: specific minute, hour, day, month
    return `${minutes} ${hours} ${dayOfMonth} ${month} *`;
  }

  // Set up periodic check for campaigns that need to start or stop
  schedulePeriodicCheck() {
    // Check every minute for campaigns that need to start or stop
    cron.schedule('* * * * *', async () => {
      await this.checkCampaigns();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log('⏰ Scheduled periodic campaign checks (every minute)');
  }

  // Check for campaigns that need to start or stop
  async checkCampaigns() {
    try {
      // Check for campaigns that should start
      const campaignsToStart = await Campaign.findCampaignsToStart();
      for (const campaign of campaignsToStart) {
        console.log(`🚀 Auto-starting scheduled campaign: ${campaign._id}`);
        await this.executeCampaign(campaign._id);
      }

      // Check for campaigns that should stop
      const campaignsToStop = await Campaign.findCampaignsToStop();
      for (const campaign of campaignsToStop) {
        console.log(`⏹️ Auto-stopping scheduled campaign: ${campaign._id}`);
        await Campaign.findByIdAndUpdate(campaign._id, {
          isActive: false,
          status: 'completed',
          'analytics.completedAt': new Date()
        });
      }

    } catch (error) {
      console.error('❌ Error during periodic campaign check:', error);
    }
  }

  // Schedule cleanup of completed/expired campaigns
  scheduleCleanup() {
    // Run cleanup every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredCampaigns();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log('🧹 Scheduled hourly cleanup of expired campaigns');
  }

  // Clean up expired or completed scheduled campaigns
  async cleanupExpiredCampaigns() {
    try {
      const now = new Date();
      
      // Find expired scheduled campaigns (where start time has passed but never started)
      const expiredCampaigns = await Campaign.find({
        scheduling: true,
        isActive: false,
        status: 'scheduled',
        $expr: {
          $and: [
            { $ne: ['$startDate', ''] },
            { $ne: ['$startTime', ''] },
            { $lt: [{ $dateFromString: { dateString: { $concat: ['$startDate', 'T', '$startTime', ':00'] } } }, now] }
          ]
        }
      });

      for (const campaign of expiredCampaigns) {
        console.log(`🧹 Cleaning up expired campaign: ${campaign._id}`);
        
        // Cancel the scheduled task
        this.removeScheduledTask(campaign._id.toString());
        
        // Mark as expired
        await Campaign.findByIdAndUpdate(campaign._id, {
          status: 'expired'
        });
      }

      if (expiredCampaigns.length > 0) {
        console.log(`🧹 Cleaned up ${expiredCampaigns.length} expired campaigns`);
      }

    } catch (error) {
      console.error('❌ Error during campaign cleanup:', error);
    }
  }

  // Get status of all scheduled campaigns
  getScheduledCampaigns() {
    const scheduled = [];
    
    for (const [campaignId, taskInfo] of this.scheduledTasks) {
      scheduled.push({
        campaignId,
        scheduledAt: taskInfo.scheduledAt,
        isRunning: taskInfo.task.running
      });
    }
    
    return scheduled;
  }

  // Stop all scheduled tasks (for graceful shutdown)
  async shutdown() {
    console.log('🛑 Shutting down Campaign Scheduler...');
    
    for (const [campaignId, taskInfo] of this.scheduledTasks) {
      taskInfo.task.stop();
      taskInfo.task.destroy();
    }
    
    this.scheduledTasks.clear();
    console.log('✅ Campaign Scheduler shutdown complete');
  }
}

// Create and export a singleton instance
const campaignScheduler = new CampaignScheduler();

module.exports = campaignScheduler;
