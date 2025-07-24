// DebugPage.jsx

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useWebSocketLogs, useWebSocketManager } from "../context/WebSocketLogContext";
import { useUser } from "../context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  WifiIcon,
  SignalIcon,
  CommandLineIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import CampaignMonitor from "../components/CampaignMonitor";
import { getUserCampaigns } from "../api/auth";
import { useLocation } from "react-router-dom";

const stats = [
  { label: "Errors", value: 12, icon: ExclamationTriangleIcon, accent: "bg-[#d32f2f]/10 text-[#d32f2f] dark:bg-[#ef5350]/10 dark:text-[#ef5350]", description: "Active system errors" },
  { label: "Warnings", value: 5, icon: InformationCircleIcon, accent: "bg-[#f39c12]/10 text-[#f39c12] dark:bg-[#f7d774]/10 dark:text-[#f7d774]", description: "Issues that might impact stability" },
  { label: "Sessions", value: 31, icon: CheckCircleIcon, accent: "bg-[#71b48d]/10 text-[#71b48d] dark:bg-[#86cb92]/10 dark:text-[#86cb92]", description: "Active user sessions" },
  { label: "Uptime", value: "99.96%", icon: CheckCircleIcon, accent: "bg-[#598185]/10 text-[#598185] dark:bg-[#d0d2e5]/10 dark:text-[#d0d2e5]", description: "Uptime in the last 24h" }
];

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: i => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.09, type: "spring", stiffness: 120 }
  })
};

export default function DebugPage() {
  const location = useLocation();
  const logs = useWebSocketLogs();
  const { connectionStatus } = useWebSocketManager();
  const { user } = useUser();
  const [filter, setFilter] = useState("");
  const [showTips, setShowTips] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [isUserScrollingLiveLogs, setIsUserScrollingLiveLogs] = useState(false);
  
  const liveLogsContainerRef = useRef(null);

  
  // Scroll to top on mount
  useEffect(() => {
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  // Load user campaigns
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user?.email || !user?.apiKeys?.[0]?.key) return;
      
      setLoadingCampaigns(true);
      try {
        const result = await getUserCampaigns(user.email, user.apiKeys[0].key);
        setCampaigns(result || []);
        // Auto-select first active campaign, or most recently updated campaign if no active ones
        if (!selectedCampaignId && result && result.length > 0) {
          const activeCampaign = result.find(c => c.isActive);
          const lastActiveCampaign = activeCampaign || [...result].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
          setSelectedCampaignId(lastActiveCampaign._id);
        }
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchCampaigns();
  }, [user]);

  const filteredLogs = useMemo(
    () =>
      !filter ? logs : logs.filter(l => l.toLowerCase().includes(filter.toLowerCase())),
    [logs, filter]
  );

  // Auto-scroll for live logs
  useEffect(() => {
    if (!isUserScrollingLiveLogs && liveLogsContainerRef.current) {
      liveLogsContainerRef.current.scrollTop = liveLogsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, isUserScrollingLiveLogs]);

  // Scroll detection for live logs
  const handleLiveLogsScroll = () => {
    if (!liveLogsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = liveLogsContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // Increased threshold for better UX
    setIsUserScrollingLiveLogs(!isAtBottom);
  };

  const scrollLiveLogsToBottom = () => {
    if (liveLogsContainerRef.current) {
      liveLogsContainerRef.current.scrollTop = liveLogsContainerRef.current.scrollHeight;
      setIsUserScrollingLiveLogs(false);
    }
  };

  const selectedCampaign = campaigns.find(c => c._id === selectedCampaignId);

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10 p-3 sm:p-4 lg:p-6 mx-auto max-w-full">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#260f26] dark:text-[#86cb92] tracking-tight">
            Debug Console
          </h1>
          <div className="text-sm sm:text-base lg:text-lg font-medium text-[#598185] dark:text-[#d0d2e5] mt-1 sm:mt-2">
            Live system logs, campaign monitoring, and persistent Redis logging
          </div>
        </div>
        
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white dark:bg-[#333762] border border-[#e5e5e5] dark:border-[#333762]">
            <WifiIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${
              connectionStatus.isAuthenticated ? 'text-green-500' : 
              connectionStatus.isConnected ? 'text-yellow-500' : 'text-red-500'
            }`} />
            <span className="text-xs sm:text-sm font-medium hidden sm:inline">
              {connectionStatus.isAuthenticated ? 'Connected' : 
               connectionStatus.isConnected ? 'Authenticating...' : 'Disconnected'}
            </span>
            {/* Mobile short version */}
            <span className="text-xs font-medium sm:hidden">
              {connectionStatus.isAuthenticated ? '✅' : 
               connectionStatus.isConnected ? '🔄' : '❌'}
            </span>
            {connectionStatus.reconnectAttempts > 0 && (
              <span className="text-xs text-orange-500 bg-orange-100 dark:bg-orange-900/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                <span className="hidden sm:inline">Retry </span>{connectionStatus.reconnectAttempts}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* STATS GRID *
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-10">
        <AnimatePresence>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              whileHover={{
                scale: 1.02,
                boxShadow: "0 6px 24px 0 rgba(28,27,47,0.04)"
              }}
              className="
                group relative flex flex-col gap-1 sm:gap-2 min-h-[100px] sm:min-h-[120px]
                rounded-xl border shadow-lg
                bg-white dark:bg-[rgba(28,27,47,0.7)]
                border-[#e5e5e5] dark:border-[#333762]
                transition-all duration-300
                overflow-hidden
              "
            >
              <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-5">
                <span className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 flex items-center justify-center rounded-full text-lg sm:text-xl shrink-0 ${s.accent}`}>
                  <s.icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-lg sm:text-xl lg:text-[1.5rem] font-bold text-[#1c1641] dark:text-[#e6e7ef] truncate">{s.value}</div>
                  <div className="text-xs sm:text-sm text-[#404e7c] dark:text-[#b0b0c3] truncate">{s.label}</div>
                </div>
              </div>
              <div className="px-3 sm:pl-5 pb-2 sm:pb-3 mt-auto">
                <span className="text-xs italic text-[#598185] dark:text-[#b0b0c3] opacity-80 block overflow-hidden">
                  <span className="hidden sm:inline">{s.description}</span>
                  <span className="sm:hidden">{s.description.length > 30 ? s.description.substring(0, 30) + '...' : s.description}</span>
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* CAMPAIGN MONITOR SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 sm:space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] flex items-center gap-2 tracking-tighter">
            <SignalIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
            <span className="hidden sm:inline">Campaign Monitoring (Redis-Persistent)</span>
            <span className="sm:hidden">Campaign Monitor</span>
          </h2>
          
          {/* Campaign Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {loadingCampaigns ? (
              <div className="flex items-center gap-2 text-sm text-[#404e7c] dark:text-[#86cb92]">
                <ClockIcon className="w-4 h-4 animate-spin" />
                Loading campaigns...
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-sm border border-[#598185] dark:border-[#86cb92] rounded-lg bg-white dark:bg-[#1c1b2f] text-[#260f26] dark:text-[#86cb92] focus:outline-none focus:ring-2 focus:ring-[#86cb92] transition sm:min-w-[300px] lg:min-w-[400px]"
                >
                  <option value="">Select Campaign (Auto: Last Active)</option>
                  {/* Active Campaigns */}
                  {campaigns.filter(c => c.isActive).length > 0 && (
                    <optgroup label="🟢 Active Campaigns">
                      {campaigns.filter(c => c.isActive).map(campaign => (
                        <option key={campaign._id} value={campaign._id}>
                          <span className="hidden sm:inline">{campaign.url} • {campaign.concurrent} sessions • Last: {new Date(campaign.updatedAt).toLocaleString()}</span>
                          <span className="sm:hidden">{campaign.url.length > 25 ? campaign.url.substring(0, 25) + '...' : campaign.url}</span>
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* Scheduled Campaigns */}
                  {campaigns.filter(c => c.scheduling && !c.isActive).length > 0 && (
                    <optgroup label="🕒 Scheduled Campaigns">
                      {campaigns.filter(c => c.scheduling && !c.isActive).map(campaign => (
                        <option key={campaign._id} value={campaign._id}>
                          <span className="hidden sm:inline">{campaign.url} • {campaign.startTime}-{campaign.endTime} • Last: {new Date(campaign.updatedAt).toLocaleString()}</span>
                          <span className="sm:hidden">{campaign.url.length > 25 ? campaign.url.substring(0, 25) + '...' : campaign.url}</span>
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* Inactive Campaigns */}
                  {campaigns.filter(c => !c.isActive && !c.scheduling).length > 0 && (
                    <optgroup label="⭕ Inactive Campaigns (Historical Logs Available)">
                      {campaigns.filter(c => !c.isActive && !c.scheduling).map(campaign => (
                        <option key={campaign._id} value={campaign._id}>
                          <span className="hidden sm:inline">{campaign.url.length > 35 ? campaign.url.substring(0, 35) + '...' : campaign.url} • Last run: {new Date(campaign.updatedAt).toLocaleString()}</span>
                          {/* <span className="sm:hidden">{campaign.url.length > 25 ? campaign.url.substring(0, 25) + '...' : campaign.url}</span> */}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="text-xs text-[#598185] dark:text-[#d0d2e5] hidden lg:block lg:max-w-[200px]">
                  <div className="font-medium">📊 Total: {campaigns.length}</div>
                  <div>🟢 Active: {campaigns.filter(c => c.isActive).length}</div>
                  <div>⭕ Historical: {campaigns.filter(c => !c.isActive).length}</div>
                </div>
                {/* Mobile campaign count */}
                <div className="text-xs text-[#598185] dark:text-[#d0d2e5] lg:hidden flex gap-2">
                  <span>📊 {campaigns.length}</span>
                  <span>🟢 {campaigns.filter(c => c.isActive).length}</span>
                  <span>⭕ {campaigns.filter(c => !c.isActive).length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Monitor Component */}
        {selectedCampaignId ? (
          <CampaignMonitor
            campaignId={selectedCampaignId}
            campaignName={selectedCampaign?.url || 'Selected Campaign'}
            campaignStatus={
              selectedCampaign?.isActive ? 'active' : 
              selectedCampaign?.scheduling ? 'scheduled' : 
              'inactive'
            }
            className="mb-6 sm:mb-8"
          />
        ) : campaigns.length > 0 ? (
          <div className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg border border-[#e5e5e5] dark:border-[#333762] p-4 sm:p-6 lg:p-8">
            <div className="text-center text-[#404e7c] dark:text-[#86cb92]">
              <SignalIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Campaign Selected</h3>
              <p className="text-sm mb-3 sm:mb-4">
                A campaign should have been auto-selected. Please choose one from the dropdown above.
              </p>
              <div className="text-xs text-[#598185] dark:text-[#d0d2e5] space-y-1">
                <p>🟢 <strong>Active campaigns:</strong> Real-time logs + historical data</p>
                <p>🕒 <strong>Scheduled campaigns:</strong> Historical logs from previous runs</p>
                <p>⭕ <strong>Inactive campaigns:</strong> Complete historical log archive</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg border border-[#e5e5e5] dark:border-[#333762] p-4 sm:p-6 lg:p-8">
            <div className="text-center text-[#404e7c] dark:text-[#86cb92]">
              <SignalIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Campaigns Found</h3>
              <p className="text-sm mb-3 sm:mb-4">
                Create your first campaign in Traffic Settings to start monitoring logs.
              </p>
              <div className="text-xs text-orange-500 bg-orange-50 dark:bg-orange-900/20 p-2 sm:p-3 rounded-lg">
                <p className="font-medium mb-1">Getting Started:</p>
                <p>1. Go to Traffic Settings</p>
                <p>2. Create a new campaign</p>
                <p>3. Return here to monitor live logs and analytics</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* GLOBAL LIVE LOGS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl h-[400px] sm:h-[450px] lg:h-[600px] border shadow-lg mb-6 sm:mb-8 lg:mb-10 bg-[#232635] dark:bg-[#181828] border-[#e5e5e5] dark:border-[#333762] transition-all flex flex-col"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-3 sm:px-5 py-2 sm:py-3 border-b border-[#e5e5e5] dark:border-[#333762] flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <CommandLineIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#e6e7ef] flex-shrink-0" />
            <span className="font-semibold text-sm sm:text-base lg:text-lg text-[#e6e7ef] tracking-wide truncate">
              <span className="hidden sm:inline">Global Live Logs</span>
              <span className="sm:hidden">Live Logs</span>
            </span>
            <span className="text-xs text-[#b0b0c3] bg-[#333762] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0">
              <span className="hidden sm:inline">All Systems</span>
              <span className="sm:hidden">All</span>
            </span>
            {isUserScrollingLiveLogs && (
              <button
                onClick={scrollLiveLogsToBottom}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0"
              >
                <span className="hidden sm:inline">Scroll to bottom ↓</span>
                <span className="sm:hidden">↓</span>
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search logs…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full sm:w-auto px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-[#f1f5f9] dark:bg-[#333762] text-[#1c1641] dark:text-[#e6e7ef] border border-[#e5e5e5] dark:border-[#333762] focus:outline-none focus:ring-2 focus:ring-[#71b48d] dark:focus:ring-[#86cb92] transition-all"
          />
        </div>
        <div 
          ref={liveLogsContainerRef}
          onScroll={handleLiveLogsScroll}
          className="font-mono text-xs sm:text-sm text-[#95a6d2] dark:text-[#b0b0c3] px-2 sm:px-5 py-2 sm:py-3 flex-1 overflow-y-auto bg-transparent"
        >
          {filteredLogs.length === 0 ?
            <div className="italic text-[#b0b0c3] text-center py-6 sm:py-8">
              {connectionStatus.isAuthenticated ? 'No logs yet. Logs will appear here as they are generated.' : 'Waiting for WebSocket connection...'}
            </div>
            :
            filteredLogs.map((log, i) => (
              <div key={i} className="py-0.5 sm:py-1 hover:bg-white/5 px-1 sm:px-2 rounded transition-colors break-all sm:break-normal">{log}</div>
            ))
          }
        </div>
        <div className="rounded-b-xl px-2 sm:px-5 py-1.5 sm:py-2 border-t border-[#333762] bg-[#1a1a1a] text-xs text-[#b0b0c3] flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
            <span>Total logs: {filteredLogs.length}</span>
            <span>WebSocket: {connectionStatus.isAuthenticated ? '✅ Connected' : '❌ Disconnected'}</span>
          </div>
        </div>
      </motion.div>

      {/* DEBUG TIPS */}
      {showTips && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="
            flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 max-w-full lg:max-w-4xl mx-auto mb-4 sm:mb-6
            bg-white dark:bg-[rgba(28,27,47,0.7)]
            border border-[#e5e5e5] dark:border-[#333762]
            rounded-xl shadow px-4 sm:px-6 py-3 sm:py-4
          "
        >
          <div className="flex gap-2 sm:gap-3 items-start min-w-0 flex-1">
            <InformationCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#71b48d] dark:text-[#86cb92] flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="text-sm sm:text-base text-[#404e7c] dark:text-[#b0b0c3] font-medium">
                💡 <span className="hidden sm:inline">Auto-Selection & Redis Persistent Logging</span><span className="sm:hidden">Redis Logging</span>:
              </div>
              <ul className="text-xs sm:text-sm text-[#598185] dark:text-[#d0d2e5] space-y-0.5 sm:space-y-1">
                <li className="hidden sm:list-item">• Campaign logs automatically show for your last active campaign</li>
                <li>• Logs persist across page reloads and app restarts</li>
                <li className="hidden lg:list-item">• Historical logs are automatically loaded when monitoring starts</li>
                <li className="hidden sm:list-item">• Redis stores up to 10,000 logs per campaign with 24-hour auto-expiry</li>
                <li className="hidden lg:list-item">• Use Campaign Monitor for persistent logging, Global Logs for real-time debugging</li>
                <li className="sm:hidden">• Persistent storage with auto-expiry</li>
              </ul>
            </div>
          </div>
          <button
            className="text-[#598185] dark:text-[#d0d2e5] font-semibold hover:text-[#71b48d] transition-colors self-start sm:self-center flex-shrink-0 sm:ml-6"
            title="Close"
            onClick={() => setShowTips(false)}
          >
            ✕
          </button>
        </motion.div>
      )}
    </div>
  );
}
