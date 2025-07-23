// userSockets.js
// Manages WebSocket connections for real-time communication with users

class UserSocketsManager {
  constructor() {
    this.userSockets = new Map(); // email -> WebSocket connection
    this.socketUsers = new Map(); // WebSocket -> email (for reverse lookup)
  }

  // Add a new user socket connection
  addUser(email, socket) {
    // Remove existing connection for this user if any
    this.removeUser(email);
    
    // Store the connection
    this.userSockets.set(email, socket);
    this.socketUsers.set(socket, email);
    
    console.log(`🔗 User connected: ${email}`);
  }

  // Remove a user's socket connection
  removeUser(email) {
    const existingSocket = this.userSockets.get(email);
    if (existingSocket) {
      this.socketUsers.delete(existingSocket);
      this.userSockets.delete(email);
      console.log(`🔌 User disconnected: ${email}`);
    }
  }

  // Remove socket by socket reference (for cleanup on disconnect)
  removeSocket(socket) {
    const email = this.socketUsers.get(socket);
    if (email) {
      this.userSockets.delete(email);
      this.socketUsers.delete(socket);
      console.log(`🔌 Socket disconnected for user: ${email}`);
    }
  }

  // Get socket for a specific user
  getUserSocket(email) {
    return this.userSockets.get(email);
  }

  // Get user email for a specific socket
  getSocketUser(socket) {
    return this.socketUsers.get(socket);
  }

  // Get all connected users
  getConnectedUsers() {
    return Array.from(this.userSockets.keys());
  }

  // Get count of connected users
  getConnectionCount() {
    return this.userSockets.size;
  }

  // Check if user is connected
  isUserConnected(email) {
    return this.userSockets.has(email);
  }

  // Send message to specific user
  sendToUser(email, message) {
    const socket = this.userSockets.get(email);
    if (socket && socket.readyState === socket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        socket.send(messageStr);
        return true;
      } catch (error) {
        console.error(`Failed to send message to ${email}:`, error);
        return false;
      }
    }
    return false;
  }

  // Broadcast message to all connected users
  broadcast(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    let sentCount = 0;
    
    for (const [email, socket] of this.userSockets) {
      if (socket.readyState === socket.OPEN) {
        try {
          socket.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`Failed to broadcast to ${email}:`, error);
          // Remove failed connection
          this.removeUser(email);
        }
      } else {
        // Remove closed connection
        this.removeUser(email);
      }
    }
    
    return sentCount;
  }

  // Send campaign-specific logs to user
  sendCampaignLog(email, campaignId, logMessage) {
    const logData = {
      action: 'campaign_log',
      campaignId: campaignId,
      timestamp: new Date().toISOString(),
      message: logMessage
    };
    
    return this.sendToUser(email, logData);
  }

  // Send analytics update to user
  sendAnalyticsUpdate(email, analyticsData) {
    const updateData = {
      action: 'analytics_update',
      timestamp: new Date().toISOString(),
      data: analyticsData
    };
    
    return this.sendToUser(email, updateData);
  }

  // Send campaign status update to user
  sendCampaignStatus(email, campaignId, status, details = {}) {
    const statusData = {
      action: 'campaign_status',
      campaignId: campaignId,
      status: status,
      timestamp: new Date().toISOString(),
      ...details
    };
    
    return this.sendToUser(email, statusData);
  }

  // Cleanup all connections (for server shutdown)
  cleanup() {
    console.log('🧹 Cleaning up all WebSocket connections...');
    
    for (const [email, socket] of this.userSockets) {
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({
            action: 'server_shutdown',
            message: 'Server is shutting down'
          }));
          socket.close();
        }
      } catch (error) {
        console.error(`Error closing socket for ${email}:`, error);
      }
    }
    
    this.userSockets.clear();
    this.socketUsers.clear();
    console.log('✅ All WebSocket connections cleaned up');
  }

  // Get connection statistics
  getStats() {
    return {
      connectedUsers: this.userSockets.size,
      users: Array.from(this.userSockets.keys()),
      connections: Array.from(this.userSockets.entries()).map(([email, socket]) => ({
        email,
        state: socket.readyState,
        isOpen: socket.readyState === socket.OPEN
      }))
    };
  }
}

// Create and export singleton instance
const userSocketsManager = new UserSocketsManager();

// For backward compatibility, also export the Map directly
module.exports = {
  userSockets: userSocketsManager.userSockets, // Direct access to the Map for legacy code
  manager: userSocketsManager, // New manager interface
  // Legacy methods for backward compatibility
  set: (email, socket) => userSocketsManager.addUser(email, socket),
  get: (email) => userSocketsManager.getUserSocket(email),
  delete: (email) => userSocketsManager.removeUser(email),
  has: (email) => userSocketsManager.isUserConnected(email),
  forEach: (callback) => userSocketsManager.userSockets.forEach(callback),
  entries: () => userSocketsManager.userSockets.entries(),
  keys: () => userSocketsManager.userSockets.keys(),
  values: () => userSocketsManager.userSockets.values(),
  size: () => userSocketsManager.userSockets.size
};
