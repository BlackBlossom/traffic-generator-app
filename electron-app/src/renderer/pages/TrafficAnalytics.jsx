import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  BoltIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
  CheckCircleIcon,
  GlobeAltIcon as GlobeIcon,
  CursorArrowRaysIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { sectionVariants, cardVariants } from "../animations";
import { analyticsAPI } from "../api/analytics";
import { useUser } from "../context/UserContext";
import sessionStorage from "../utils/sessionStorage";

// Chart.js registration
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, ChartTooltip, Legend, Filler);

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ---- Utility Functions ----
function formatTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000);
  
  if (diff < 60) return "less than a minute ago";
  if (diff < 120) return "1 minute ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  return `${Math.floor(diff / 3600)} hours ago`;
}

function formatSessionEvent(event) {
  const level = event.level?.toLowerCase() || 'info';
  const message = event.message?.toLowerCase() || '';
  
  // Map by log level first, then by message content
  if (level === 'error') {
    return { icon: ExclamationCircleIcon, color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-900/20" };
  } else if (level === 'warn' || level === 'warning') {
    return { icon: ExclamationCircleIcon, color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-900/20" };
  } else if (message.includes('click') || message.includes('mouse')) {
    return { icon: CursorArrowRaysIcon, color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-900/20" };
  } else if (message.includes('scroll')) {
    return { icon: ArrowPathIcon, color: "text-yellow-500", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" };
  } else if (message.includes('completed') || message.includes('finished')) {
    return { icon: CheckCircleIcon, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20" };
  } else if (message.includes('download')) {
    return { icon: ArrowDownTrayIcon, color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-900/20" };
  } else if (message.includes('upload')) {
    return { icon: ArrowUpTrayIcon, color: "text-indigo-500", bgColor: "bg-indigo-50 dark:bg-indigo-900/20" };
  } else if (message.includes('navigate') || message.includes('request')) {
    return { icon: GlobeIcon, color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-900/20" };
  }
  
  // Default for info level and unknown events
  return { icon: GlobeIcon, color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-900/20" };
}

// ---- Stat Card ----
function StatCard({ icon: Icon, label, value, gradient, custom }) {
  return (
    <motion.div
      className={cn(
        "flex flex-col justify-between px-3 py-3 sm:px-4 sm:py-4 md:px-7 md:py-6 rounded-2xl sm:rounded-3xl shadow-md bg-gradient-to-br",
        gradient,
        "relative overflow-hidden min-w-[140px] sm:min-w-[160px] md:min-w-[180px] border border-[#e5e5e5] dark:border-[#23243a]/60"
      )}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={custom}
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        <div className="rounded-full bg-white/30 dark:bg-[#251f47]/40 p-2 sm:p-2.5 md:p-3 shadow">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[#598185] dark:text-[#86cb92]" />
        </div>
        <span className="text-sm sm:text-[15px] md:text-[16px] font-semibold text-[#404e7c] dark:text-[#d0d2e5] leading-tight">
          {label}
        </span>
      </div>
      <div className="mt-3 sm:mt-4 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#260f26] dark:text-[#86cb92]">
        {value}
      </div>
    </motion.div>
  );
}

// ---- Session History Table ----
function SessionHistoryTable({ rows, refreshing = false, lastRefresh = null }) {
  // Ensure rows is always an array
  const safeRows = rows || [];

  return (
    <motion.div
      className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 mt-8"
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={2}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#260f26] dark:text-[#86cb92]">Session History</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          {lastRefresh && (
            <div className="text-xs text-[#598185] dark:text-[#d0d2e5]">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <div className="flex items-center gap-2">
            {refreshing && (
              <div className="flex items-center gap-2 text-sm text-[#86cb92]">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Updating...</span>
              </div>
            )}
            <button
              onClick={() => window.clearSessionHistory && window.clearSessionHistory()}
              className="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition whitespace-nowrap"
            >
              Clear History
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#f6f8fa] dark:bg-[#251f47] text-[#404e7c] dark:text-[#86cb92]">
              <tr className="bg-[#f6f8fa] dark:bg-[#251f47]/40 text-[#404e7c] dark:text-[#86cb92]">
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm">TIME</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm">STATUS</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm hidden sm:table-cell">SOURCE</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm hidden md:table-cell">REFERRER</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm">DURATION</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm hidden lg:table-cell">PROXY</th>
                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left font-semibold tracking-wide text-xs sm:text-sm hidden xl:table-cell">CAMPAIGN</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#404e7c] dark:text-[#86cb92] opacity-60 text-xs sm:text-sm">
                    {refreshing ? 'Loading session history...' : 'No session history yet. Start some campaigns to see traffic data.'}
                  </td>
                </tr>
              )}
              {safeRows.map((row, i) => (
                <tr key={`${row.sessionId}-${row.time}-${i}`} className="border-b border-[#f0f0f0] dark:border-[#333762]/40">
                  <td className="py-1 px-2 sm:py-2 sm:px-4 text-xs sm:text-sm">{row.time}</td>
                  <td className={cn(
                    "py-1 px-2 sm:py-2 sm:px-4 font-semibold text-xs sm:text-sm",
                    row.status === "Completed"
                      ? "text-green-600 dark:text-green-400"
                      : row.status === "Bounced"
                      ? "text-red-600 dark:text-red-400"
                      : row.status === "Timeout"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  )}>
                    {row.status}
                  </td>
                  <td className="py-1 px-2 sm:py-2 sm:px-4 text-xs sm:text-sm hidden sm:table-cell">{row.source}</td>
                  <td className="py-1 px-2 sm:py-2 sm:px-4 font-mono text-xs max-w-[100px] sm:max-w-[150px] truncate hidden md:table-cell" title={row.specificReferrer}>
                    {row.specificReferrer || 'Direct'}
                  </td>
                  <td className="py-1 px-2 sm:py-2 sm:px-4 text-xs sm:text-sm">{row.duration}</td>
                  <td className="py-1 px-2 sm:py-2 sm:px-4 font-mono text-xs hidden lg:table-cell">{row.proxy || 'No Proxy'}</td>
                  <td className="py-1 px-2 sm:py-2 sm:px-4 text-xs max-w-[120px] sm:max-w-[200px] truncate hidden xl:table-cell" title={row.campaignUrl}>
                    {row.campaignUrl || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
function SessionActivityCard({ session, custom }) {
  return (
    <motion.div
      className="bg-white dark:bg-[#1c1b2f]/80 rounded-xl shadow p-3 sm:p-4 md:p-5 border border-[#86cb92]/20"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={custom}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[#260f26] dark:text-[#86cb92]">
            <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#86cb92] flex-shrink-0" />
            <span className="text-sm sm:text-base">Session</span>
            <span className="font-mono font-medium text-xs sm:text-sm">[{session.id}]</span>
          </div>
          <div className="text-xs text-[#598185] dark:text-[#d0d2e5]">
            {formatTimeAgo(session.startTime)}
          </div>
        </div>
        
        {session.campaignUrl && (
          <div className="text-xs text-[#598185] dark:text-[#d0d2e5] font-mono bg-gray-50 dark:bg-[#251f47]/30 px-2 py-1 rounded">
            <span className="font-semibold">Campaign:</span> {session.campaignUrl}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-[#404e7c] dark:text-[#86cb92] text-sm">
            <span className="font-semibold">Source:</span> {session.source}
          </div>
          {session.specificReferrer && (
            <div className="text-xs text-[#598185] dark:text-[#d0d2e5]">
              <span className="font-semibold">Referrer:</span> 
              <span className="font-mono text-xs ml-1 break-all">{session.specificReferrer}</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-[#404e7c] dark:text-[#d0d2e5]">
            <span className="font-semibold">Proxy:</span> 
            <span className="font-mono ml-1 break-all">{session.proxy || 'Unknown'}</span>
          </div>
          <div className="text-[#404e7c] dark:text-[#d0d2e5]">
            <span className="font-semibold">Status:</span> 
            <span className={`font-semibold ml-1 ${
              session.status === 'completed' ? 'text-green-600' : 
              session.status === 'bounced' ? 'text-red-600' :
              session.status === 'timeout' ? 'text-orange-600' : 'text-yellow-600'
            }`}>
              {session.status === 'completed' ? 'Completed' : 
               session.status === 'bounced' ? 'Bounced' : 
               session.status === 'timeout' ? 'Timeout' : 'Active'}
            </span>
            {session.duration > 0 && <span> ({session.duration}s)</span>}
          </div>
        </div>
      </div>
      
      {session.events && session.events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#86cb92]/20">
          <div className="text-xs font-semibold text-[#598185] dark:text-[#d0d2e5] mb-2">
            Session Activity ({session.events.length} events)
          </div>
          <div className="max-h-48 overflow-y-auto">
            <ul className="space-y-1">
              {session.events.map((ev, idx) => {
                const eventInfo = formatSessionEvent(ev);
                const Icon = eventInfo.icon;
                return (
                  <li key={idx} className={`flex items-start gap-2 text-xs sm:text-sm p-2 rounded-lg ${eventInfo.bgColor}`}>
                    <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${eventInfo.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="break-words text-[#260f26] dark:text-[#86cb92]">{ev.message}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.level === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          ev.level === 'warn' || ev.level === 'warning' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {ev.level?.toUpperCase() || 'INFO'}
                        </span>
                        <span className="text-xs text-[#598185] dark:text-[#d0d2e5] flex-shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString('en-US', { 
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---- Traffic Overview Chart (Visits & Bounces) ----
function TrafficOverviewChart({ data }) {
  // Provide default values if data is undefined or missing properties
  const safeData = useMemo(() => ({
    labels: data?.labels || [],
    visits: data?.visits || [],
    bounces: data?.bounces || []
  }), [data]);

  const chartData = useMemo(() => ({
    labels: safeData.labels,
    datasets: [
      {
        label: "Visits",
        data: safeData.visits,
        borderColor: "#4f8cff",
        backgroundColor: "rgba(79,140,255,0.08)",
        pointBackgroundColor: "#4f8cff",
        pointBorderColor: "#4f8cff",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true, // area fill
        tension: 0.4, // smooth lines
        pointStyle: "circle",
      },
      {
        label: "Bounces",
        data: safeData.bounces,
        borderColor: "#ff6d6d",
        backgroundColor: "rgba(255,109,109,0.08)",
        pointBackgroundColor: "#ff6d6d",
        pointBorderColor: "#ff6d6d",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
        pointStyle: "circle",
      },
    ],
  }), [safeData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { 
          color: "#404e7c", 
          font: { size: 14, weight: "bold" },
          usePointStyle: true, // <-- circles in legend
          boxWidth: 18,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#fff",
        borderColor: "#86cb92",
        borderWidth: 1.5,
        titleColor: "#251f47",
        bodyColor: "#251f47",
        bodyFont: { weight: "bold" },
        cornerRadius: 12,
        padding: 12,
      },
    },
    elements: {
      line: { borderWidth: 2 },
      point: { borderWidth: 2 },
    },
    scales: {
      x: {
        grid: { color: "rgba(64,78,124,0.08)" },
        ticks: { color: "#404e7c" },
      },
      y: {
        grid: { color: "rgba(64,78,124,0.08)" },
        ticks: { color: "#404e7c" },
        beginAtZero: true,
        suggestedMax: Math.max(...safeData.visits, ...safeData.bounces, 1) + 1,
      },
    },
  }), [safeData]);

  return (
    <motion.div
      className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mt-8"
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={3}
    >
      <h2 className="text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-4">Traffic Overview</h2>
      <div className="w-full h-64 sm:h-80 md:h-96">
        <Line data={chartData} options={chartOptions} />
      </div>
    </motion.div>
  );
}

// ---- Traffic Sources Chart ----
function TrafficSourcesChart({ data }) {
  // Provide default values if data is undefined or missing properties
  const safeData = useMemo(() => ({
    labels: data?.labels || [],
    organic: data?.organic || [],
    direct: data?.direct || [],
    social: data?.social || [],
    referral: data?.referral || []
  }), [data]);

  const chartData = useMemo(() => ({
    labels: safeData.labels,
    datasets: [
      {
        label: "Organic",
        data: safeData.organic,
        borderColor: "#86cb92",
        backgroundColor: "rgba(134,203,146,0.08)",
        pointBackgroundColor: "#86cb92",
        pointBorderColor: "#86cb92",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
        pointStyle: "circle",
      },
      {
        label: "Direct",
        data: safeData.direct,
        borderColor: "#4f8cff",
        backgroundColor: "rgba(79,140,255,0.08)",
        pointBackgroundColor: "#4f8cff",
        pointBorderColor: "#4f8cff",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
        pointStyle: "circle",
      },
      {
        label: "Social",
        data: safeData.social,
        borderColor: "#a78bfa",
        backgroundColor: "rgba(167,139,250,0.08)",
        pointBackgroundColor: "#a78bfa",
        pointBorderColor: "#a78bfa",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
        pointStyle: "circle",
      },
      {
        label: "Referral",
        data: safeData.referral,
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251,191,36,0.08)",
        pointBackgroundColor: "#fbbf24",
        pointBorderColor: "#fbbf24",
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
        pointStyle: "circle",
      },
    ],
  }), [safeData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { 
          color: "#404e7c", 
          font: { size: 14, weight: "bold" },
          usePointStyle: true,
          boxWidth: 18,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#fff",
        borderColor: "#86cb92",
        borderWidth: 1.5,
        titleColor: "#251f47",
        bodyColor: "#251f47",
        bodyFont: { weight: "bold" },
        cornerRadius: 12,
        padding: 12,
      },
    },
    elements: {
      line: { borderWidth: 2 },
      point: { borderWidth: 2 },
    },
    scales: {
      x: {
        grid: { color: "rgba(64,78,124,0.08)" },
        ticks: { color: "#404e7c" },
      },
      y: {
        grid: { color: "rgba(64,78,124,0.08)" },
        ticks: { color: "#404e7c" },
        beginAtZero: true,
        suggestedMax: Math.max(...safeData.organic, ...safeData.direct, ...safeData.social, ...safeData.referral, 1) + 1,
      },
    },
  }), [safeData]);

  return (
    <motion.div
      className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mt-8"
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      custom={4}
    >
      <h2 className="text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-4">Traffic Sources</h2>
      <div className="w-full h-64 sm:h-80 md:h-96">
        <Line data={chartData} options={chartOptions} />
      </div>
    </motion.div>
  );
}

// ---- Main Page ----
export default function TrafficAnalytics() {
  const location = useLocation();
  const { user } = useUser();
  
  // State for real analytics data
  const [analyticsData, setAnalyticsData] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [stats, setStats] = useState({
    online: 0,
    total: 0,
    avgDuration: 0,
    mobile: 0,
    desktop: 0,
    completed: 0,
    bounced: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Scroll to top on mount
  useEffect(() => {
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  // Load analytics data
  const loadAnalyticsData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Check if user and API key are available
      if (!user || !user.apiKeys?.[0]?.key) {
        throw new Error('No API key found. Please generate an API key first.');
      }

      const apiKey = user.apiKeys[0].key;

      // First check if user has any campaigns
      const { getUserCampaigns } = await import('../api/auth');
      const campaigns = await getUserCampaigns(user.email, apiKey);
      
      setHasCampaigns(campaigns && campaigns.length > 0);

      // If no campaigns exist, set everything to zero
      if (!campaigns || campaigns.length === 0) {
        setAnalyticsData({
          timeSeries: { labels: [], visits: [], bounces: [] },
          sources: { labels: [], organic: [], direct: [], social: [], referral: [] },
          campaigns: {}
        });
        setLiveSessions([]);
        setSessionHistory([]);
        setStats({
          online: 0,
          total: 0,
          avgDuration: 0,
          mobile: 0,
          desktop: 0,
          completed: 0,
          bounced: 0
        });
        return;
      }

      // Check if any campaigns are active
      const activeCampaigns = campaigns.filter(c => c.isActive);
      
      // Fetch analytics data from database (not just Redis)
      const [overview, liveSess, sessHistory, statsData] = await Promise.all([
        analyticsAPI.getOverview(null, apiKey),
        activeCampaigns.length > 0 ? analyticsAPI.getLiveSessions(10, apiKey) : Promise.resolve([]),
        analyticsAPI.getSessionHistory(50, apiKey), // This now gets only most recent campaign sessions
        analyticsAPI.getStats(apiKey)
      ]);

      // Set analytics data from database (server data is now timestamp-based)
      setAnalyticsData(overview);
      setSessionHistory(sessHistory);
      setLastRefresh(new Date());
      
      // Filter stats for active campaigns only
      if (activeCampaigns.length === 0) {
        // No active campaigns - show historical data but zero live sessions
        setStats({
          ...statsData,
          online: 0 // No live sessions if no active campaigns
        });
        setLiveSessions([]);
      } else {
        setLiveSessions(liveSess);
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (user && user.apiKeys?.[0]?.key) {
      loadAnalyticsData();
    }
  }, [user]);

  // Auto-refresh every 5 seconds for more real-time data
  useEffect(() => {
    if (!user || !user.apiKeys?.[0]?.key) return;
    
    const interval = setInterval(() => {
      loadAnalyticsData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [user]); // Add user dependency

  // Debug: Track session history changes
  useEffect(() => {
    console.log('Session history updated:', sessionHistory.length, 'sessions');
  }, [sessionHistory]);

  // Manual refresh
  const handleRefresh = () => {
    loadAnalyticsData(true);
  };

  // Clear session history
  const clearSessionHistory = () => {
    setSessionHistory([]);
    // Also clear local storage data
    sessionStorage.clearAll();
  };

  // Expose clearSessionHistory to window for button access
  useEffect(() => {
    window.clearSessionHistory = clearSessionHistory;
    return () => {
      delete window.clearSessionHistory;
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-10 p-4 sm:p-6 mx-auto max-w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#86cb92] mx-auto mb-4"></div>
            <p className="text-[#404e7c] dark:text-[#86cb92]">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !analyticsData) {
    return (
      <div className="space-y-10 p-4 sm:p-6 mx-auto max-w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ExclamationCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">Failed to load analytics data</p>
            <p className="text-sm text-[#404e7c] dark:text-[#86cb92] mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-[#86cb92] text-white rounded-lg hover:bg-[#71b48d] transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-10 p-4 sm:p-6 mx-auto max-w-full"
      initial="hidden"
      animate="visible"
      variants={sectionVariants}
    >
      {/* Page Heading and Intro */}
      <motion.header className="space-y-2 mx-auto" variants={sectionVariants} custom={0}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#260f26] dark:text-[#86cb92] tracking-tight">
              SEO Analytics
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-[#598185] dark:text-[#d0d2e5] mt-1">
              Monitor live sessions, analyze historical traffic, and understand your traffic sources — all in one place.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-[#86cb92] text-white rounded-lg hover:bg-[#71b48d] transition disabled:opacity-50 text-sm sm:text-base self-start lg:self-auto"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            <span className="sm:hidden">{refreshing ? '...' : 'Refresh'}</span>
          </button>
        </div>
      </motion.header>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6"
        variants={sectionVariants}
        custom={1}
        initial="hidden"
        animate="visible"
      >
        <StatCard icon={BoltIcon} label="Online Sessions" value={stats.online || 0} gradient="from-[#86cb92]/40 to-[#71b48d]/30" custom={0} />
        <StatCard icon={GlobeAltIcon} label="Total Visits" value={stats.totalVisits || stats.total || 0} gradient="from-[#404e7c]/40 to-[#333762]/30 dark:bg-[#1c1b2f] dark:to-[#333762]/30" custom={1} />
        <StatCard icon={EyeIcon} label="Avg. Duration (s)" value={stats.avgDuration || 0} gradient="from-[#86cb92]/40 to-[#71b48d]/30" custom={2} />
        <StatCard icon={DevicePhoneMobileIcon} label="Mobile/Desktop" value={`${stats.mobile || 0}/${stats.desktop || 0}`} gradient="from-[#404e7c]/40 to-[#333762]/30 dark:bg-[#1c1b2f] dark:to-[#333762]/30" custom={3} />
      </motion.div>

      {/* No Campaigns Warning */}
      {!hasCampaigns && (
        <motion.div
          className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6 text-center"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <ExclamationCircleIcon className="w-12 h-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            No Campaigns Found
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mb-4">
            You need to create campaigns in SEO Settings to start generating analytics data. All current stats show zero because no campaigns exist.
          </p>
          <button
            onClick={() => window.location.hash = '#/traffic-settings'}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium"
          >
            Create Your First Campaign
          </button>
        </motion.div>
      )}

      {/* Live Traffic Monitor */}
      <motion.section
        aria-label="Live Traffic Monitor"
        className="bg-white/70 dark:bg-[#1c1b2f]/70 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl p-3 sm:p-6 md:p-8 mx-auto"
        variants={sectionVariants}
        custom={3}
      >
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-4 sm:mb-6">
          Live Traffic Monitor
        </h2>
        <AnimatePresence>
          {!hasCampaigns ? (
            <motion.div
              className="text-center py-8 sm:py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <BoltIcon className="w-12 h-12 sm:w-16 sm:h-16 text-[#86cb92]/50 mx-auto mb-4" />
              <p className="text-[#598185] dark:text-[#d0d2e5] text-base sm:text-lg px-4">
                No campaigns to monitor. Create campaigns to see live traffic sessions here.
              </p>
            </motion.div>
          ) : liveSessions.length === 0 ? (
            <motion.div
              className="text-center py-6 sm:py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-[#598185] dark:text-[#d0d2e5] text-sm sm:text-base">
                No recent sessions. Start some campaigns to see live traffic data.
              </p>
            </motion.div>
          ) : (
            <motion.div
              className="space-y-4 sm:space-y-6 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.08 } },
                hidden: {},
              }}
            >
              {liveSessions.map((session, idx) => (
                <SessionActivityCard key={session.id} session={session} custom={idx} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Campaign Breakdown */}
      {hasCampaigns && analyticsData && analyticsData.campaigns && Object.keys(analyticsData.campaigns).length > 0 && (
        <motion.section
          className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mt-8"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={5}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-6">
            Campaign Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2">
            {Object.entries(analyticsData.campaigns).map(([campaignId, campaignData]) => (
              <div key={campaignId} className="bg-white/50 dark:bg-[#251f47]/30 rounded-xl p-3 sm:p-4 border border-[#86cb92]/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm sm:text-base text-[#260f26] dark:text-[#86cb92] truncate pr-2">
                    {campaignData.campaign?.url || 'Unknown Campaign'}
                  </h3>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    campaignData.campaign?.isActive ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <div className="text-[#598185] dark:text-[#d0d2e5]">Sessions</div>
                    <div className="font-bold text-[#260f26] dark:text-[#86cb92] text-sm sm:text-base">{campaignData.totalSessions}</div>
                  </div>
                  <div>
                    <div className="text-[#598185] dark:text-[#d0d2e5]">Completed</div>
                    <div className="font-bold text-green-600 text-sm sm:text-base">{campaignData.completedSessions}</div>
                  </div>
                  <div>
                    <div className="text-[#598185] dark:text-[#d0d2e5]">Bounced</div>
                    <div className="font-bold text-red-600 text-sm sm:text-base">{campaignData.bouncedSessions}</div>
                  </div>
                  <div>
                    <div className="text-[#598185] dark:text-[#d0d2e5]">Avg Duration</div>
                    <div className="font-bold text-[#260f26] dark:text-[#86cb92] text-sm sm:text-base">{campaignData.avgDuration}s</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Traffic Sources Breakdown */}
      {hasCampaigns && analyticsData && analyticsData.sources && (
        <motion.section
          className="bg-white dark:bg-[#1c1b2f]/80 rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 mt-8"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={6}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-[#260f26] dark:text-[#86cb92] mb-6">
            Traffic Sources Breakdown
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Use server data from database/Redis logs for traffic sources breakdown */}
            {analyticsData.sources.labels && analyticsData.sources.labels.length > 0 ? (
              <>
                <div className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">
                    {analyticsData.sourcesStats.organic}
                  </div>
                  <div className="text-xs sm:text-sm text-[#598185] dark:text-[#d0d2e5]">Organic</div>
                  <div className="text-xs text-[#598185] dark:text-[#d0d2e5] mt-1">Google Search</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
                    {analyticsData.sourcesStats.direct}
                  </div>
                  <div className="text-xs sm:text-sm text-[#598185] dark:text-[#d0d2e5]">Direct</div>
                  <div className="text-xs text-[#598185] dark:text-[#d0d2e5] mt-1">No Referrer</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">
                    {analyticsData.sourcesStats.social}
                  </div>
                  <div className="text-xs sm:text-sm text-[#598185] dark:text-[#d0d2e5]">Social</div>
                  <div className="text-xs text-[#598185] dark:text-[#d0d2e5] mt-1">Social Media</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600">
                    {analyticsData.sourcesStats.referral}
                  </div>
                  <div className="text-xs sm:text-sm text-[#598185] dark:text-[#d0d2e5]">Referral</div>
                  <div className="text-xs text-[#598185] dark:text-[#d0d2e5] mt-1">Other Sites</div>
                </div>
              </>
            ) : (
              <div className="col-span-full text-center py-6 sm:py-8 text-[#598185] dark:text-[#d0d2e5] text-sm sm:text-base">
                No traffic source data available yet.
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Charts */}
      {hasCampaigns && analyticsData && (
        <>
          <TrafficOverviewChart data={analyticsData.timeSeries} />
          <TrafficSourcesChart data={analyticsData.sources} />
        </>
      )}
      
      {/* Session History Table */}
      <SessionHistoryTable rows={sessionHistory} refreshing={refreshing} lastRefresh={lastRefresh} />
    </motion.div>
  );
}
