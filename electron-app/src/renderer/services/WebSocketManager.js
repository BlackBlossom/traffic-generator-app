// src/renderer/services/WebSocketManager.js

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // Start with 1 second
    this.maxReconnectInterval = 30000; // Max 30 seconds
    this.userEmail = null;
    this.listeners = new Map();
    this.connectionListeners = new Set();
    this.autoReconnect = true;
    this.url = 'ws://localhost:5000';
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Connection status listeners
  onConnectionChange(callback) {
    this.connectionListeners.add(callback);
    // Immediately call with current status
    callback({
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts
    });
  }

  offConnectionChange(callback) {
    this.connectionListeners.delete(callback);
  }

  emitConnectionChange() {
    const status = {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts
    };
    this.connectionListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  connect(userEmail) {
    if (this.isConnected) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }

    this.userEmail = userEmail;
    
    return new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket:', this.url);
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000; // Reset interval
          this.emitConnectionChange();
          this.authenticate(userEmail).then(resolve).catch(reject);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.isAuthenticated = false;
          this.emitConnectionChange();
          
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('maxReconnectAttemptsReached', { attempts: this.reconnectAttempts });
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { error, type: 'connection' });
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
    
    setTimeout(() => {
      if (this.autoReconnect && !this.isConnected && this.userEmail) {
        this.connect(this.userEmail).catch(error => {
          console.error('Reconnect failed:', error);
        });
      }
    }, this.reconnectInterval);
    
    // Exponential backoff with jitter
    this.reconnectInterval = Math.min(
      this.reconnectInterval * 2 + Math.random() * 1000,
      this.maxReconnectInterval
    );
    this.emitConnectionChange();
  }

  authenticate(email) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const authMessage = {
        action: 'auth',
        email: email
      };

      // Set up one-time listener for auth response
      const authHandler = (data) => {
        if (data.level === 'info' && data.message && data.message.includes('Authenticated successfully')) {
          this.isAuthenticated = true;
          this.emitConnectionChange();
          this.off('message', authHandler);
          resolve();
        } else if (data.level === 'error') {
          this.off('message', authHandler);
          reject(new Error(data.message || 'Authentication failed'));
        }
      };

      this.on('message', authHandler);
      
      // Set timeout for auth
      setTimeout(() => {
        if (!this.isAuthenticated) {
          this.off('message', authHandler);
          reject(new Error('Authentication timeout'));
        }
      }, 10000);

      this.send(authMessage);
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Route different message types
      switch (message.action) {
        case 'historical_logs':
          this.emit('historicalLogs', message);
          break;
        case 'logs_cleared':
          this.emit('logsCleared', message);
          break;
        default:
          // Handle real-time logs and other messages
          if (message.level && message.message) {
            this.emit('realtimeLog', message);
          }
          this.emit('message', message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.emit('error', { error, type: 'message_parse', data });
    }
  }

  send(data) {
    if (!this.isConnected || !this.ws) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.emit('error', { error, type: 'send', data });
      return false;
    }
  }

  // Campaign logging methods
  fetchHistoricalLogs(campaignId, limit = 0) {
    return new Promise((resolve, reject) => {
      if (!this.isAuthenticated) {
        reject(new Error('Not authenticated'));
        return;
      }

      const requestMessage = {
        action: 'fetch_logs',
        campaignId: campaignId,
        limit: limit
      };

      // Set up one-time listener for response
      const responseHandler = (data) => {
        if (data.action === 'historical_logs' && data.campaignId === campaignId) {
          this.off('historicalLogs', responseHandler);
          resolve(data.logs || []);
        }
      };

      const errorHandler = (data) => {
        if (data.level === 'error') {
          this.off('historicalLogs', responseHandler);
          this.off('message', errorHandler);
          reject(new Error(data.message || 'Failed to fetch logs'));
        }
      };

      this.on('historicalLogs', responseHandler);
      this.on('message', errorHandler);

      // Set timeout
      setTimeout(() => {
        this.off('historicalLogs', responseHandler);
        this.off('message', errorHandler);
        reject(new Error('Fetch logs timeout'));
      }, 15000);

      if (!this.send(requestMessage)) {
        this.off('historicalLogs', responseHandler);
        this.off('message', errorHandler);
        reject(new Error('Failed to send request'));
      }
    });
  }

  clearLogs(campaignId) {
    return new Promise((resolve, reject) => {
      if (!this.isAuthenticated) {
        reject(new Error('Not authenticated'));
        return;
      }

      const requestMessage = {
        action: 'clear_logs',
        campaignId: campaignId
      };

      // Set up one-time listener for response
      const responseHandler = (data) => {
        if (data.action === 'logs_cleared' && data.campaignId === campaignId) {
          this.off('logsCleared', responseHandler);
          resolve(data.message || 'Logs cleared successfully');
        }
      };

      const errorHandler = (data) => {
        if (data.level === 'error') {
          this.off('logsCleared', responseHandler);
          this.off('message', errorHandler);
          reject(new Error(data.message || 'Failed to clear logs'));
        }
      };

      this.on('logsCleared', responseHandler);
      this.on('message', errorHandler);

      // Set timeout
      setTimeout(() => {
        this.off('logsCleared', responseHandler);
        this.off('message', errorHandler);
        reject(new Error('Clear logs timeout'));
      }, 10000);

      if (!this.send(requestMessage)) {
        this.off('logsCleared', responseHandler);
        this.off('message', errorHandler);
        reject(new Error('Failed to send request'));
      }
    });
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.emitConnectionChange();
  }

  // Get current status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      userEmail: this.userEmail
    };
  }
}

// Export singleton instance
export default new WebSocketManager();
