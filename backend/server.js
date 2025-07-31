require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
// const redisLogger = require('./services/redisLogger'); // Initialize Redis logger
const trafficAnalytics = require('./services/trafficAnalytics'); // Initialize traffic analytics
const campaignScheduler = require('./services/campaignScheduler'); // Import campaign scheduler

const http = require('http');
const WebSocket = require('ws');

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'Connected',
      redis: 'Connected',
      server: 'Running'
    }
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
// app.use('/api/analytics', require('./routes/analytics'));
// app.use('/api/dashboard', require('./routes/dashboard'));

// Global error handler (after all routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// // Create the HTTP server
const server = http.createServer(app);

// // User-to-socket map for real-time dashboard targeting
// const userSockets = require('./services/userSockets');

// // Attach WebSocket server to the same HTTP server
// const wss = new WebSocket.Server({ server });

// wss.on('connection', (ws) => {
//   console.log('New WebSocket client connected');
//   ws.send(JSON.stringify({
//     level: 'info',
//     message: 'Connected to WebSocket server. Please authenticate.'
//   }));

//   ws.on('message', async (msg) => {
//     try {
//       const data = JSON.parse(msg);

//       // Handle authentication
//       if (data.action === "auth" && data.email) {
//         userSockets.set(data.email, ws);
//         ws.send(JSON.stringify({ level: 'info', message: 'Authenticated successfully.' }));
//         return;
//       }

//       // Handle request for historical logs
//       if (data.action === "fetch_logs" && data.campaignId) {
//         try {
//           // Find the user email for this WebSocket connection
//           const userEmail = [...userSockets.entries()].find(([email, socket]) => socket === ws)?.[0];
          
//           console.log(`🔍 Fetch logs request: campaignId=${data.campaignId}, userEmail=${userEmail}, limit=${data.limit}`);
          
//           if (!userEmail) {
//             ws.send(JSON.stringify({ 
//               level: 'error', 
//               message: 'User not authenticated for log access' 
//             }));
//             return;
//           }
          
//           const logs = await redisLogger.fetchLogs(data.campaignId, userEmail, data.limit || 0);
//           console.log(`📋 Fetched ${logs.length} logs for campaign ${data.campaignId}`);
          
//           ws.send(JSON.stringify({
//             action: 'historical_logs',
//             campaignId: data.campaignId,
//             logs: logs
//           }));
//         } catch (error) {
//           ws.send(JSON.stringify({ 
//             level: 'error', 
//             message: `Failed to fetch logs: ${error.message}` 
//           }));
//         }
//         return;
//       }

//       // Handle request to clear logs
//       if (data.action === "clear_logs" && data.campaignId) {
//         try {
//           await redisLogger.clearLogs(data.campaignId);
//           ws.send(JSON.stringify({
//             action: 'logs_cleared',
//             campaignId: data.campaignId,
//             message: 'Campaign logs cleared successfully'
//           }));
//         } catch (error) {
//           ws.send(JSON.stringify({ 
//             level: 'error', 
//             message: `Failed to clear logs: ${error.message}` 
//           }));
//         }
//         return;
//       }

//       // Handle analytics data requests
//       if (data.action === "get_analytics") {
//         try {
//           // Find the user email for this WebSocket connection
//           const userEmail = [...userSockets.entries()].find(([email, socket]) => socket === ws)?.[0];
          
//           const analyticsData = await trafficAnalytics.getAnalyticsData(null, userEmail);
//           ws.send(JSON.stringify({
//             action: 'analytics_data',
//             data: analyticsData
//           }));
//         } catch (error) {
//           ws.send(JSON.stringify({ 
//             level: 'error', 
//             message: `Failed to get analytics: ${error.message}` 
//           }));
//         }
//         return;
//       }

//       // Handle live sessions request
//       if (data.action === "get_live_sessions") {
//         try {
//           // Find the user email for this WebSocket connection
//           const userEmail = [...userSockets.entries()].find(([email, socket]) => socket === ws)?.[0];
          
//           const liveSessions = await trafficAnalytics.getLiveSessionActivity(data.limit || 10, userEmail);
//           ws.send(JSON.stringify({
//             action: 'live_sessions',
//             data: liveSessions
//           }));
//         } catch (error) {
//           ws.send(JSON.stringify({ 
//             level: 'error', 
//             message: `Failed to get live sessions: ${error.message}` 
//           }));
//         }
//         return;
//       }

//       // Handle other actions/messages as needed:
//       // e.g., start campaigns, receive commands, etc.

//     } catch (err) {
//       ws.send(JSON.stringify({ level: 'error', message: 'Invalid message format.' }));
//     }
//   });

//   ws.on('close', () => {
//     // Clean up: remove the socket when it disconnects
//     for (const [email, socket] of userSockets.entries()) {
//       if (socket === ws) {
//         userSockets.delete(email);
//         console.log(`🔌 User disconnected: ${email}`);
//         break;
//       }
//     }
//     console.log('WebSocket client disconnected');
//   });

//   ws.on('error', (error) => {
//     console.error('❌ WebSocket error:', error);
//     // Clean up socket on error
//     for (const [email, socket] of userSockets.entries()) {
//       if (socket === ws) {
//         userSockets.delete(email);
//         console.log(`🚨 User disconnected due to error: ${email}`);
//         break;
//       }
//     }
//   });

//   // Send periodic ping to keep connection alive
//   const pingInterval = setInterval(() => {
//     if (ws.readyState === ws.OPEN) {
//       ws.ping();
//     } else {
//       clearInterval(pingInterval);
//     }
//   }, 30000); // Ping every 30 seconds

//   ws.on('pong', () => {
//     // Connection is alive
//   });
// });

// Only start listening when MongoDB is connected
mongoose.connection.once('open', async () => {
  console.log('Connected to MongoDB');
  
  // Initialize campaign scheduler
  // await campaignScheduler.initialize();
  
  server.listen(PORT, () => {
    console.log(`🚀 Backend listening on port ${PORT}`);
    
    // Start periodic analytics broadcasting
    // startAnalyticsBroadcast();
  });
});
/*
// Function to broadcast analytics data to all connected clients
function broadcastAnalytics() {
  // Broadcast user-specific analytics to each connected client
  userSockets.forEach(async (ws, email) => {
    if (ws.readyState === ws.OPEN) {
      try {
        const data = await trafficAnalytics.getAnalyticsData(null, email);
        const message = JSON.stringify({
          action: 'analytics_update',
          data: data
        });
        ws.send(message);
      } catch (error) {
        console.error(`Failed to broadcast analytics to user ${email}:`, error.message);
      }
    }
  });
}

// Start periodic analytics broadcasting
function startAnalyticsBroadcast() {
  // Broadcast analytics every 30 seconds
  setInterval(broadcastAnalytics, 30000);
  
  // Initial broadcast after 5 seconds
  setTimeout(broadcastAnalytics, 5000);
  
  console.log('📊 Analytics broadcasting started (every 30 seconds)');
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  await campaignScheduler.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  await campaignScheduler.shutdown();
  process.exit(0);
});

// Optionally export userSockets map for use in controllers/services
*/