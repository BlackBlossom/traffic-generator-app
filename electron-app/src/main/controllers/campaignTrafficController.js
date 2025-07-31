// campaignTrafficController.js

const { runTraffic } = require('../traffic-worker/traffic'); // Enhanced unified traffic worker
const Campaigns = require('../models/Campaigns'); // <-- Adjust path as needed
const sqliteLogger = require('../services/sqliteLogger');
const logEventHub = require('../services/logEventHub'); // SQLite logging service

const activeControllers = new Map(); // campaignId -> Promise

/**
 * Starts traffic for a campaign in a controller loop.
 * Auto-stops when the campaign's isActive becomes false in the DB.
 */

function logToWebsocket(ws, level, message, campaignId = null, userEmail = null) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString()
  };

  // Send to WebSocket if available
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(logEntry));
  }

  // Store in SQLite and broadcast live via logEventHub
  if (campaignId && userEmail) {
    logEventHub.logAndBroadcast(campaignId, userEmail, logEntry);
  }
}


async function campaignTrafficController(campaign, ws, userEmail, options = {}) {
  const campaignId = campaign._id.toString();
  if (activeControllers.has(campaignId)) {
    logToWebsocket(ws, 'warn', `Campaign ${campaignId}: Controller already running.`, campaignId, userEmail);
    return;
  }

  // Determine traffic mode
  const trafficMode = 'python'; // 'puppeteer' or 'python'
  const usePython = trafficMode === 'python' || options.usePython === true;

  logToWebsocket(ws, 'info', `Campaign ${campaignId}: Controller started with ${usePython ? 'Python humanized' : 'Puppeteer'} traffic worker.`, campaignId, userEmail);
  activeControllers.set(campaignId, true);

  let sessionsCompleted = 0;
  const totalSessionsLimit = campaign.totalSessions;

  try {
    while (true) {
      // Always fetch the latest campaign status
      const latest = await Campaigns.findById(campaignId).lean();
      if (!latest || !latest.isActive) {
        logToWebsocket(ws, 'info', `Campaign ${campaignId}: No longer active, controller will stop.`, campaignId, userEmail);
        break;
      }

      // Check if we've reached the session limit
      if (totalSessionsLimit && sessionsCompleted >= totalSessionsLimit) {
        logToWebsocket(ws, 'info', `Campaign ${campaignId}: Reached session limit of ${totalSessionsLimit}, controller will stop.`, campaignId, userEmail);
        // Mark campaign as inactive when limit is reached
        await Campaigns.findByIdAndUpdate(campaignId, { isActive: false });
        break;
      }

      // Calculate remaining sessions for this batch
      let sessionsForThisBatch = latest.concurrent;
      if (totalSessionsLimit) {
        const remainingSessions = totalSessionsLimit - sessionsCompleted;
        sessionsForThisBatch = Math.min(latest.concurrent, remainingSessions);
        
        if (sessionsForThisBatch <= 0) {
          logToWebsocket(ws, 'info', `Campaign ${campaignId}: All ${totalSessionsLimit} sessions completed.`, campaignId, userEmail);
          await Campaigns.findByIdAndUpdate(campaignId, { isActive: false });
          break;
        }
      }

      // Create a modified campaign object for this batch
      const batchCampaign = { ...latest, concurrent: sessionsForThisBatch };
      
      // Run unified traffic method with mode selection
      await runTraffic(batchCampaign, campaignId, userEmail, {
        trafficMode: trafficMode,
        usePython: usePython,
        headless: options.headless !== false,
        browser: options.browser || 'chromium'
      });
      
      // Update session count
      sessionsCompleted += sessionsForThisBatch;
      
      logToWebsocket(ws, 'info', `Campaign ${campaignId}: Completed ${sessionsCompleted}${totalSessionsLimit ? `/${totalSessionsLimit}` : ''} sessions.`, campaignId, userEmail);

      // If we have unlimited sessions, add a small delay between batches
      if (!totalSessionsLimit) {
        await new Promise(res => setTimeout(res, 5000)); // 5 second delay between batches
      }
    }
  } catch (err) {
    logToWebsocket(ws, 'error', `Campaign ${campaignId}: Error in controller loop: ${err.stack || err.message}`, campaignId, userEmail);
  } finally {
    activeControllers.delete(campaignId);
    logToWebsocket(ws, 'info', `Campaign ${campaignId}: Controller fully stopped.`, campaignId, userEmail);
  }
}

module.exports = { 
  campaignTrafficController
};
