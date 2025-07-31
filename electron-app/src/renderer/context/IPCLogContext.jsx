// IPCLogContext.jsx
// New IPC-based logging context for real-time session tracking
import React, { createContext, useState, useEffect, useContext } from "react";
import { useUser } from "./UserContext";

// 1. Create and export context
const IPCLogContext = createContext(null);

// 2. Provider component
export function IPCLogProvider({ children }) {
  const { user } = useUser();
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    // Register for IPC log updates
    window.electronAPI.registerForLogs();
    setIsConnected(true);

    // Listen for log updates
    const unsubscribe = window.electronAPI.onLogUpdate((logData) => {
      // Only add campaign session logs to the context (not live-only logs)
      if (!logData.isLiveOnly && logData.campaignId && logData.campaignId !== 'SYSTEM' && logData.campaignId !== 'LIVE') {
        setLogs(prev => {
          // Keep only recent logs for performance (last 200)
          const newLogs = [logData, ...prev.slice(0, 199)];
          return newLogs;
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      setIsConnected(false);
    };
  }, [user?.email]);

  const contextValue = {
    logs,
    isConnected,
    clearLogs: () => setLogs([])
  };

  return (
    <IPCLogContext.Provider value={contextValue}>
      {children}
    </IPCLogContext.Provider>
  );
}

// 3. Custom hook for consuming IPC logs
export function useIPCLogs() {
  const context = useContext(IPCLogContext);
  if (!context) {
    throw new Error('useIPCLogs must be used within an IPCLogProvider');
  }
  return context;
}

// 4. Custom hook for session tracking (backward compatibility with WebSocket interface)
export function useWebSocketLogs() {
  const context = useContext(IPCLogContext);
  if (!context) {
    return { logs: [], isConnected: false };
  }
  
  // Convert IPC logs to WebSocket-compatible format for backward compatibility
  const formattedLogs = context.logs.map(log => {
    if (typeof log === 'string') return log;
    
    const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const levelText = log.level ? (log.level[0].toUpperCase() + log.level.slice(1)) : "Info";
    const sessionText = log.sessionId ? `[${log.sessionId.slice(-6)}]` : "";
    
    return `[${timestamp}] ${levelText}: ${sessionText} ${log.message}`;
  });

  return {
    logs: formattedLogs,
    isConnected: context.isConnected
  };
}
