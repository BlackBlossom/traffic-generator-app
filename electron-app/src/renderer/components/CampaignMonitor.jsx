// src/renderer/components/CampaignMonitor.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  WifiIcon,
  ClockIcon,
  BugAntIcon
} from '@heroicons/react/24/outline';
import WebSocketManager from '../services/WebSocketManager';
import { useUser } from '../context/UserContext';

const LogLevel = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

const LogLevelColors = {
  [LogLevel.ERROR]: 'text-red-400',
  [LogLevel.WARN]: 'text-yellow-400',
  [LogLevel.INFO]: 'text-green-400',
  [LogLevel.DEBUG]: 'text-blue-400'
};

const LogLevelIcons = {
  [LogLevel.ERROR]: ExclamationCircleIcon,
  [LogLevel.WARN]: ExclamationTriangleIcon,
  [LogLevel.INFO]: CheckCircleIcon,
  [LogLevel.DEBUG]: BugAntIcon
};

// Parse log string into structured object
const parseLogString = (logString) => {
  if (!logString || typeof logString !== 'string') {
    return { message: logString };
  }

  // Match patterns like:
  // [2025-07-22T14:54:07.123Z] INFO: message
  // [2025-07-22T14:54:07.123Z] [sessionId] INFO: message
  
  const timestampRegex = /^\[([^\]]+)\]/;
  const sessionIdRegex = /\[([a-zA-Z0-9_-]{6,})\]/; // Session IDs are typically 6+ chars
  const levelRegex = /(ERROR|WARN|INFO|DEBUG):/;

  let timestamp = null;
  let sessionId = null;
  let level = 'info';
  let message = logString;

  // Extract timestamp
  const timestampMatch = logString.match(timestampRegex);
  if (timestampMatch) {
    timestamp = timestampMatch[1];
    // Remove timestamp from message for further parsing
    message = logString.substring(timestampMatch[0].length).trim();
  }

  // Extract session ID (look for bracketed alphanumeric string)
  const sessionIdMatch = message.match(sessionIdRegex);
  if (sessionIdMatch) {
    // Verify it's not a timestamp-like pattern
    const potentialSessionId = sessionIdMatch[1];
    if (!/^\d{4}-/.test(potentialSessionId)) { // Not a date
      sessionId = potentialSessionId;
      // Remove session ID from message
      message = message.replace(sessionIdMatch[0], '').trim();
    }
  }

  // Extract log level
  const levelMatch = message.match(levelRegex);
  if (levelMatch) {
    level = levelMatch[1].toLowerCase();
    // Remove level from message
    message = message.substring(message.indexOf(':') + 1).trim();
  }

  return {
    timestamp,
    sessionId,
    level,
    message
  };
};

export default function CampaignMonitor({ 
  campaignId, 
  campaignName = 'Campaign',
  campaignStatus = 'unknown', // 'active', 'inactive', 'scheduled'
  className = '',
  maxLogs = 1000,
  autoScroll = true 
}) {
  const { user } = useUser();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    isAuthenticated: false,
    reconnectAttempts: 0
  });
  const [error, setError] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedLevels, setSelectedLevels] = useState(new Set(['error', 'warn', 'info', 'debug']));
  
  const logsContainerRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Filter logs based on search and level filters
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    // Filter by level
    if (selectedLevels.size > 0) {
      filtered = filtered.filter(log => selectedLevels.has(log.level));
    }
    
    // Filter by search term
    if (filter.trim()) {
      const searchTerm = filter.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.sessionId && log.sessionId.toLowerCase().includes(searchTerm))
      );
    }
    
    return filtered;
  }, [logs, filter, selectedLevels]);

  // Auto-scroll management - improved with smoother behavior
  useEffect(() => {
    if (autoScroll && !isUserScrolling && logsContainerRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      });
    }
  }, [filteredLogs, autoScroll, isUserScrolling]);

  // Auto-scroll when monitoring starts (for historical logs)
  useEffect(() => {
    if (isMonitoring && logs.length > 0 && !isUserScrolling && logsContainerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [isMonitoring, logs.length]);

  // Scroll detection - improved with throttling
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // Increased threshold for better UX
    setIsUserScrolling(!isAtBottom);
  };

  // WebSocket connection management
  useEffect(() => {
    const handleConnectionChange = (status) => {
      setConnectionStatus(status);
    };

    const handleRealtimeLog = (logData) => {
      if (!isMonitoring) return;
      
      const formattedLog = {
        id: `${Date.now()}_${Math.random()}`,
        sessionId: logData.sessionId || null,
        level: logData.level || 'info',
        message: logData.message || '',
        timestamp: logData.timestamp || new Date().toISOString(),
        isRealtime: true
      };
      
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, formattedLog];
        // Keep only the most recent logs
        if (newLogs.length > maxLogs) {
          return newLogs.slice(-maxLogs);
        }
        return newLogs;
      });
    };

    const handleError = (errorData) => {
      setError(`WebSocket Error: ${errorData.error?.message || 'Unknown error'}`);
    };

    const handleMaxReconnectReached = () => {
      setError('Max reconnection attempts reached. Please refresh the page.');
    };

    WebSocketManager.onConnectionChange(handleConnectionChange);
    WebSocketManager.on('realtimeLog', handleRealtimeLog);
    WebSocketManager.on('error', handleError);
    WebSocketManager.on('maxReconnectAttemptsReached', handleMaxReconnectReached);

    return () => {
      WebSocketManager.offConnectionChange(handleConnectionChange);
      WebSocketManager.off('realtimeLog', handleRealtimeLog);
      WebSocketManager.off('error', handleError);
      WebSocketManager.off('maxReconnectAttemptsReached', handleMaxReconnectReached);
    };
  }, [isMonitoring, maxLogs]);

  // Auto-start monitoring for active campaigns
  useEffect(() => {
    if (campaignId && campaignStatus === 'active' && !isMonitoring && user?.email) {
      // Small delay to ensure WebSocket connection is ready
      const timer = setTimeout(() => {
        startMonitoring();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [campaignId, campaignStatus, user?.email, isMonitoring]);

  const startMonitoring = async () => {
    if (!user?.email || !campaignId) {
      setError('User email or campaign ID missing');
      return;
    }

    setError(null);
    setIsLoadingHistory(true);

    try {
      // Connect WebSocket if not connected
      if (!connectionStatus.isConnected) {
        await WebSocketManager.connect(user.email);
      }

      // Fetch historical logs (fetch all logs by passing 0 as limit)
      const historicalLogs = await WebSocketManager.fetchHistoricalLogs(campaignId, 0);
      
      // Parse and format historical logs (reverse to get ascending chronological order)
      const formattedHistoricalLogs = historicalLogs.reverse().map((logString, index) => {
        // Parse log string format: [timestamp] LEVEL: message
        // or [timestamp] [sessionId] LEVEL: message
        const parsed = parseLogString(logString);
        return {
          id: `hist_${index}_${Date.now()}`,
          sessionId: parsed.sessionId || null,
          level: parsed.level || 'info',
          message: parsed.message || logString, // fallback to raw string
          timestamp: parsed.timestamp || new Date().toISOString(),
          isRealtime: false
        };
      });

      setLogs(formattedHistoricalLogs);
      setIsMonitoring(true);
      
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      setError(`Failed to start monitoring: ${error.message}`);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setLogs([]);
    setError(null);
  };

  const clearLogs = async () => {
    if (!campaignId) return;
    
    setIsClearingLogs(true);
    setError(null);

    try {
      await WebSocketManager.clearLogs(campaignId);
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
      setError(`Failed to clear logs: ${error.message}`);
    } finally {
      setIsClearingLogs(false);
    }
  };

  const toggleLevelFilter = (level) => {
    setSelectedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      setIsUserScrolling(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg border border-[#e5e5e5] dark:border-[#333762] ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-[#e5e5e5] dark:border-[#333762] gap-3 sm:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <h3 className="text-base sm:text-lg font-semibold text-[#260f26] dark:text-[#86cb92]">
            {campaignName}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {campaignId && (
              <span className="text-xs font-mono bg-[#eaeaff] dark:bg-[#333762] px-2 py-1 rounded text-[#404e7c] dark:text-[#86cb92]">
                {campaignId.slice(-8)}
              </span>
            )}
            {/* Campaign Status Badge */}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              campaignStatus === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
              campaignStatus === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
              'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
            }`}>
              {campaignStatus === 'active' ? '🟢 Active' :
               campaignStatus === 'scheduled' ? '🕒 Scheduled' :
               '⭕ Inactive'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          {/* Connection Status */}
          <div className="flex items-center gap-1 mb-2 sm:mb-0">
            <WifiIcon className={`w-4 h-4 ${
              connectionStatus.isAuthenticated ? 'text-green-500' : 
              connectionStatus.isConnected ? 'text-yellow-500' : 'text-red-500'
            }`} />
            <span className="text-xs text-[#404e7c] dark:text-[#86cb92]">
              {connectionStatus.isAuthenticated ? 'Connected' : 
               connectionStatus.isConnected ? 'Connecting...' : 'Disconnected'}
            </span>
            {connectionStatus.reconnectAttempts > 0 && (
              <span className="text-xs text-orange-500">
                (Retry {connectionStatus.reconnectAttempts})
              </span>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              disabled={isLoadingHistory || (!connectionStatus.isAuthenticated && !isMonitoring)}
              className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition w-full sm:w-auto ${
                isMonitoring 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50'
              }`}
            >
              {isLoadingHistory ? (
                <>
                  <ClockIcon className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : isMonitoring ? (
                <>
                  <StopIcon className="w-4 h-4" />
                  Close
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Open Logs
                </>
              )}
            </button>

            {isMonitoring && (
              <button
                onClick={clearLogs}
                disabled={isClearingLogs}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition disabled:opacity-50 w-full sm:w-auto"
              >
                {isClearingLogs ? (
                  <ClockIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <TrashIcon className="w-4 h-4" />
                )}
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {isMonitoring && (
        <div className="p-3 sm:p-4 border-b border-[#e5e5e5] dark:border-[#333762] space-y-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white/70 dark:bg-[#1c1b2f]/70 focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition"
          />

          {/* Level Filters */}
          <div className="flex flex-wrap gap-2">
            {Object.values(LogLevel).map(level => {
              const Icon = LogLevelIcons[level];
              return (
                <button
                  key={level}
                  onClick={() => toggleLevelFilter(level)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                    selectedLevels.has(level)
                      ? `${LogLevelColors[level]} bg-current/10`
                      : 'text-gray-500 bg-gray-100 dark:bg-[#333762]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{level.toUpperCase()}</span>
                  <span className="sm:hidden">{level.charAt(0).toUpperCase()}</span>
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-[#404e7c] dark:text-[#86cb92] gap-2">
            <span>{filteredLogs.length} of {logs.length} logs</span>
            {isUserScrolling && (
              <button
                onClick={scrollToBottom}
                className="text-blue-500 hover:text-blue-600 transition w-full sm:w-auto text-center"
              >
                Scroll to bottom ↓
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
          >
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign Status Info for Inactive Campaigns */}
      {campaignStatus !== 'active' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-blue-700 dark:text-blue-400">
            <InformationCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-sm">
              {campaignStatus === 'scheduled' 
                ? 'This campaign is scheduled but not currently running. You can view historical logs from previous runs.'
                : 'This campaign is inactive. You can view historical logs from when it was last active.'}
            </span>
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto rounded-b-2xl bg-[#1a1a1a] text-green-400 font-mono text-sm p-4"
      >
        {!isMonitoring ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Click "Start" to begin monitoring campaign logs
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {isLoadingHistory ? 'Loading historical logs...' : 'No logs found'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map(log => {
              const Icon = LogLevelIcons[log.level];
              return (
                <motion.div
                  key={log.id}
                  initial={log.isRealtime ? { opacity: 0, x: -10 } : false}
                  animate={log.isRealtime ? { opacity: 1, x: 0 } : false}
                  className="flex items-start gap-2 group hover:bg-white/5 px-1 py-0.5 rounded"
                >
                  <Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${LogLevelColors[log.level]}`} />
                  <span className="text-gray-400 text-xs min-w-[80px]">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  {log.sessionId && (
                    <span className="text-blue-400 text-xs min-w-[60px] font-bold">
                      [{log.sessionId.slice(-6)}]
                    </span>
                  )}
                  <span className={`flex-1 ${LogLevelColors[log.level]}`}>
                    {log.message}
                  </span>
                  {!log.isRealtime && (
                    <span className="text-xs text-gray-600">📋</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {isMonitoring && (
        <div className="p-2 border-t border-[#e5e5e5] dark:border-[#333762] bg-[#f8f9fa] dark:bg-[#333762]/30">
          <div className="flex justify-between items-center text-xs text-[#404e7c] dark:text-[#86cb92]">
            <span>
              Total: {logs.length} logs | 
              Historical: {logs.filter(l => !l.isRealtime).length} | 
              Live: {logs.filter(l => l.isRealtime).length}
              {campaignStatus !== 'active' && logs.filter(l => !l.isRealtime).length > 0 && (
                <span className="text-blue-600 dark:text-blue-400"> | 📋 All historical data loaded</span>
              )}
              {campaignStatus === 'active' && (
                <span className="text-green-600 dark:text-green-400"> | 🔄 Auto-started for active campaign</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span>Status: {campaignStatus === 'active' ? '🟢 Live' : campaignStatus === 'scheduled' ? '🕒 Scheduled' : '⭕ Historical'}</span>
              <span>ID: {campaignId?.slice(-12) || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
