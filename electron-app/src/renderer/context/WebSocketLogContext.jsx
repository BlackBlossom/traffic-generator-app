// WebSocketLogContext.js
import React, { createContext, useState, useEffect, useContext } from "react";
import { useUser } from "./UserContext";
import WebSocketManager from "../services/WebSocketManager";

// 1. Create and export context
const WebSocketContext = createContext(null);

// 2. Provider component
export function WebSocketProvider({ children }) {
  const { user } = useUser();
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isAuthenticated: false,
    reconnectAttempts: 0
  });

  useEffect(() => {
    if (!user?.email) return;

    // Auto-connect when user is available
    WebSocketManager.connect(user.email).catch(error => {
      console.error('Failed to connect WebSocket:', error);
    });

    // Listen to connection changes
    const handleConnectionChange = (status) => {
      setConnectionStatus(status);
    };

    WebSocketManager.onConnectionChange(handleConnectionChange);

    return () => {
      WebSocketManager.offConnectionChange(handleConnectionChange);
      // Don't disconnect here - let components manage their own lifecycle
    };
  }, [user?.email]);

  const contextValue = {
    manager: WebSocketManager,
    connectionStatus,
    isConnected: connectionStatus.isConnected,
    isAuthenticated: connectionStatus.isAuthenticated
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// 3. Custom hook for consuming all logs (backward compatibility)
export function useWebSocketLogs() {
  const context = useContext(WebSocketContext);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!context?.manager) return;

    const handleRealtimeLog = (data) => {
      if (data.message) {
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const levelText = data.level ? (data.level[0].toUpperCase() + data.level.slice(1)) : "Info";
        const sessionText = data.sessionId ? `[${data.sessionId.slice(-6)}]` : "";
        
        const formattedLog = `[${timestamp}] ${levelText}: ${sessionText} ${data.message}`;
        
        setLogs((prev) => [
          ...prev.slice(-199), // Keep last 200
          formattedLog
        ]);
      }
    };

    const handleMessage = (data) => {
      // Handle non-realtime log messages
      if (data.level && data.message && !data.action) {
        handleRealtimeLog(data);
      }
    };

    context.manager.on('realtimeLog', handleRealtimeLog);
    context.manager.on('message', handleMessage);

    return () => {
      context.manager.off('realtimeLog', handleRealtimeLog);
      context.manager.off('message', handleMessage);
    };
  }, [context]);

  return logs;
}

// 4. New hook for WebSocket manager access
export function useWebSocketManager() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketManager must be used within a WebSocketProvider');
  }
  return context;
}
