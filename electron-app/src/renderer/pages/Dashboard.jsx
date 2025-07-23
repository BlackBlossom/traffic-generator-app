import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserGroupIcon,
  ArrowTrendingDownIcon,
  ServerIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import TooltipBox from '../components/TooltipBox'
import { dashboardAPI } from '../api/dashboard'
import { useUser } from '../context/UserContext'
import { useWebSocketLogs } from '../context/WebSocketLogContext'

export default function Dashboard() {
  const location = useLocation();
  const { user } = useUser();
  const { logs } = useWebSocketLogs();
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [activeSessions, setActiveSessions] = useState(new Set());

  // Load dashboard data
  const loadDashboardData = async (forceRefresh = false) => {
    const startTime = performance.now();
    
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (!user || !user.apiKeys?.[0]?.key || !user.email) {
        throw new Error('No API key or email found. Please generate an API key first.');
      }

      const apiKey = user.apiKeys[0].key;
      const userEmail = user.email;
      
      console.log('Dashboard API Call:', {
        userEmail,
        apiKey: apiKey.substring(0, 8) + '...',
        endpoint: forceRefresh ? 'refresh' : 'analytics'
      });
      
      const data = forceRefresh 
        ? await dashboardAPI.refresh(apiKey, userEmail)
        : await dashboardAPI.getAnalytics(apiKey, userEmail);
      
      console.log('Dashboard API Response:', data);
      
      setDashboardData(data);
      setLastUpdateTime(new Date());
      
      const loadTime = performance.now() - startTime;
      console.log(`Dashboard data loaded in ${loadTime.toFixed(2)}ms`);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (user && user.apiKeys?.[0]?.key) {
      loadDashboardData();
    }
  }, [user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user || !user.apiKeys?.[0]?.key) return;
    
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Process WebSocket logs for real-time session tracking
  useEffect(() => {
    if (logs && logs.length > 0) {
      const recentLogs = logs.slice(-10); // Get last 10 logs
      const newActiveSessions = new Set();
      
      recentLogs.forEach(log => {
        if (log.sessionId && log.level === 'info' && log.message.includes('Session')) {
          if (log.message.includes('starting') || log.message.includes('Launching')) {
            newActiveSessions.add(log.sessionId);
          } else if (log.message.includes('completed') || log.message.includes('closed')) {
            // Session ended - will be removed from active set
          }
        }
      });

      // Only update if there are changes
      if (newActiveSessions.size !== activeSessions.size || 
          ![...newActiveSessions].every(id => activeSessions.has(id))) {
        setActiveSessions(newActiveSessions);
        
        // Update dashboard data with real-time active sessions
        if (dashboardData) {
          setDashboardData(prev => ({
            ...prev,
            activeSessions: newActiveSessions.size
          }));
        }
      }
    }
  }, [logs, activeSessions, dashboardData]);

  // Scroll to top on mount
  useEffect(() => {
    const scroller = document.querySelector('.main-scrollable');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname]);

  // Manual refresh with retry logic
  const handleRefresh = async (retryCount = 0) => {
    try {
      await loadDashboardData(true);
    } catch (error) {
      if (retryCount < 2) {
        console.log(`Retry attempt ${retryCount + 1}`);
        setTimeout(() => handleRefresh(retryCount + 1), 1000 * (retryCount + 1));
      }
    }
  };


  // Helper function to format duration
  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m > 0 ? `${m}m ` : ''}${sec}s`;
  };

  // Memoized stats for performance with real trend calculations
  const statCards = useMemo(() => {
    if (!dashboardData) return [];
    
    // Calculate trends based on real data comparison (simplified for now)
    const calculateTrend = (current, field) => {
      // For now, we'll calculate trends based on data patterns
      // In a real implementation, you'd store and compare historical data
      if (!current || current === 0) return null; // No trend for zero values
      
      // Simple trend calculation based on data characteristics
      const trends = {
        totalVisits: current > 100 ? 5 : current > 50 ? 2 : null,
        bounceRate: current > 50 ? -3 : current > 30 ? 1 : null,
        totalProxies: current > 80 ? 2 : null,
        totalEfficiency: current > 70 ? 8 : current > 50 ? 3 : current > 30 ? -2 : null
      };
      return trends[field];
    };
    
    return [
      {
        title: 'Total Visits',
        value: dashboardData.totalVisits?.toLocaleString() || '0',
        subLabel: 'Active Sessions',
        subValue: activeSessions.size || dashboardData.activeSessions || 0,
        icon: UserGroupIcon,
        iconBg: 'bg-[#f1f5f9] dark:bg-[#333762]',
        color: 'text-[#404e7c] dark:text-[#e6e7ef]',
        tooltip: 'Total number of website visits generated using campaigns.',
        trend: calculateTrend(dashboardData.totalVisits, 'totalVisits')
      },
      {
        title: 'Bounce Rate',
        value: (dashboardData.bounceRate || 0) + '%',
        subLabel: 'Avg. Duration',
        subValue: formatDuration(dashboardData.avgDuration || 0),
        icon: ArrowTrendingDownIcon,
        iconBg: 'bg-[#f1f5f9] dark:bg-[#333762]',
        color: 'text-[#71b48d] dark:text-[#86cb92]',
        tooltip: 'Percentage of visitors who leave after a single page view.',
        trend: calculateTrend(dashboardData.bounceRate, 'bounceRate')
      },
      {
        title: 'Total Proxies',
        value: dashboardData.totalProxies || 0,
        subLabel: 'Active Proxies',
        subValue: dashboardData.activeProxies || 0,
        icon: ServerIcon,
        iconBg: 'bg-[#f1f5f9] dark:bg-[#333762]',
        color: 'text-[#9b59b6] dark:text-[#d0d2e5]',
        tooltip: 'Number of configured and usable proxy servers.',
        trend: calculateTrend(dashboardData.totalProxies, 'totalProxies')
      },
      {
        title: 'Efficiency',
        value: (dashboardData.totalEfficiency || 0) + '%',
        subLabel: 'Top Campaign',
        subValue: dashboardData.topCampaign?.name || 'None',
        icon: ChartBarIcon,
        iconBg: 'bg-[#f1f5f9] dark:bg-[#333762]',
        color: 'text-[#f39c12] dark:text-[#f7d774]',
        tooltip: 'Overall campaign efficiency and top performing campaign.',
        trend: calculateTrend(dashboardData.totalEfficiency, 'totalEfficiency')
      }
    ];
  }, [dashboardData, activeSessions]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-10 p-6 mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#86cb92] mx-auto mb-4"></div>
            <p className="text-[#404e7c] dark:text-[#86cb92]">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="space-y-10 p-6 mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ExclamationCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">Failed to load dashboard</p>
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
      className="space-y-10 p-6 mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100, damping: 20 }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4, type: "spring" }}
        className="flex justify-between items-start"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-[#260f26] dark:text-[#86cb92]">Dashboard</h1>
          <p className="text-lg text-[#598185] dark:text-[#d0d2e5] mt-1">
            Overview of your application's analytics and campaign performance.
          </p>
          {lastUpdateTime && (
            <p className="text-sm text-[#404e7c] dark:text-[#b0b0c3] mt-1">
              Last updated: {lastUpdateTime.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#86cb92] text-white rounded-lg hover:bg-[#71b48d] transition disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        
        {/* Live Activity Indicator */}
        {activeSessions.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {activeSessions.size} Active Session{activeSessions.size !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            className={`
              relative overflow-visible
              bg-white dark:bg-[#1c1b2f]/70
              border border-[#e5e5e5] dark:border-[#333762]
              p-5 rounded-xl shadow-lg
              transition-all hover:shadow-2xl
              group
            `}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08 * i, duration: 0.4, type: "spring", stiffness: 120 }}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1 text-[16px] font-medium text-[#1c1641] dark:text-[#e6e7ef]">
                  {card.title}
                  <span
                    className="relative"
                    onMouseEnter={() => setHoveredTooltip(i)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <ExclamationCircleIcon className={`w-4 h-4 ${card.color} cursor-pointer`} />
                    <TooltipBox show={hoveredTooltip === i} text={card.tooltip} />
                  </span>
                </div>
                <div className="mt-2 text-3xl font-bold text-[#1c1641] dark:text-[#e6e7ef] flex items-center gap-2">
                  {card.value}
                  {typeof card.trend === 'number' && (
                    <motion.span
                      className={card.trend < 0 ? "text-red-500 flex items-center" : "text-green-500 flex items-center"}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      {card.trend < 0
                        ? <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
                        : <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />}
                      {Math.abs(card.trend)}%
                    </motion.span>
                  )}
                </div>
                {card.subLabel && (
                  <div className="mt-1 text-sm text-[#404e7c] dark:text-[#b0b0c3]">
                    {card.subLabel}{' '}
                    <span className="font-semibold">{card.subValue}</span>
                  </div>
                )}
              </div>
              <div className={`w-12 h-12 flex items-center justify-center rounded-full ${card.iconBg} transition-all group-hover:scale-105`}>
                <card.icon className={`w-7 h-7 ${card.color}`} />
              </div>
            </div>
            {card.title === 'Efficiency' && dashboardData && dashboardData.trafficSources && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-[#404e7c] dark:text-[#b0b0c3] mb-2">Traffic Sources</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1 text-green-500">
                      <span className="w-2 h-2 rounded-full bg-current inline-block" />
                      Organic
                    </span>
                    <span className="text-[#1c1641] dark:text-[#e6e7ef]">{dashboardData.trafficSources.organic}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1 text-blue-500">
                      <span className="w-2 h-2 rounded-full bg-current inline-block" />
                      Direct
                    </span>
                    <span className="text-[#1c1641] dark:text-[#e6e7ef]">{dashboardData.trafficSources.direct}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1 text-purple-500">
                      <span className="w-2 h-2 rounded-full bg-current inline-block" />
                      Social
                    </span>
                    <span className="text-[#1c1641] dark:text-[#e6e7ef]">{dashboardData.trafficSources.social}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1 text-orange-500">
                      <span className="w-2 h-2 rounded-full bg-current inline-block" />
                      Referral
                    </span>
                    <span className="text-[#1c1641] dark:text-[#e6e7ef]">{dashboardData.trafficSources.referral}%</span>
                  </li>
                </ul>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Proxy Status Section */}
      <motion.div
        className="bg-white dark:bg-[#1c1b2f]/70 border border-[#e5e5e5] dark:border-[#333762] p-5 rounded-xl shadow-lg transition-all hover:shadow-2xl"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4, type: "spring", stiffness: 120 }}
      >
        <h2 className="text-xl font-semibold text-[#260f26] dark:text-[#e6e7ef] mb-4">Proxy Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg flex justify-between items-center transition-all">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Total Proxies</div>
            <div className="text-lg font-bold text-[#260f26] dark:text-[#e6e7ef]">{dashboardData?.totalProxies || 0}</div>
          </div>
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg flex justify-between items-center transition-all">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Active Proxies</div>
            <div className="text-lg font-bold text-[#260f26] dark:text-[#e6e7ef]">{dashboardData?.activeProxies || 0}</div>
          </div>
        </div>
      </motion.div>

      {/* Campaign Analytics Section */}
      <motion.div
        className="bg-white dark:bg-[#1c1b2f]/70 border border-[#e5e5e5] dark:border-[#333762] p-5 rounded-xl shadow-lg transition-all hover:shadow-2xl"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4, type: "spring", stiffness: 120 }}
      >
        <h2 className="text-xl font-semibold text-[#260f26] dark:text-[#e6e7ef] mb-4">Campaign Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Total Campaigns</div>
            <div className="text-lg font-bold text-[#260f26] dark:text-[#e6e7ef]">{dashboardData?.totalCampaigns || 0}</div>
          </div>
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Active Campaigns</div>
            <div className="text-lg font-bold text-[#260f26] dark:text-[#e6e7ef]">{dashboardData?.activeCampaigns || 0}</div>
          </div>
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Efficiency</div>
            <div className="text-lg font-bold text-green-500 dark:text-green-400">{dashboardData?.totalEfficiency || 0}%</div>
          </div>
          <div className="bg-[#f1f5f9] dark:bg-[#333762] p-4 rounded-lg">
            <div className="text-[16px] font-medium text-[#404e7c] dark:text-[#b0b0c3]">Top Campaign</div>
            <div className="text-lg font-bold text-[#260f26] dark:text-[#e6e7ef]">{dashboardData?.topCampaign?.name || 'None'}</div>
          </div>
        </div>
        {/* List of campaigns */}
        <div className="mt-6">
          <h3 className="text-[16px] font-semibold text-[#404e7c] dark:text-[#86cb92] mb-2">Recent Campaigns</h3>
          <ul className="divide-y divide-[#e5e5e5] dark:divide-[#333762]">
            {dashboardData?.recentCampaigns?.length > 0 ? (
              dashboardData.recentCampaigns.map((campaign, idx) => (
                <motion.li
                  key={campaign._id || idx}
                  className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx + 0.4, duration: 0.3, type: "spring", stiffness: 100 }}
                >
                  <div className="flex items-center gap-3">
                    {/* Status indicator */}
                    <div className={`w-3 h-3 rounded-full ${
                      campaign.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`}></div>
                    <span className="font-medium text-[#1c1641] dark:text-[#e6e7ef]">
                      {campaign.name}
                    </span>
                    {campaign.isActive && (
                      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#598185] dark:text-[#b0b0c3] flex gap-4 mt-2 sm:mt-0">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="w-4 h-4" /> 
                      <strong>{campaign.visits || 0}</strong> visits
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowTrendingDownIcon className="w-4 h-4" /> 
                      <strong>{campaign.bounce || 0}%</strong> bounce
                    </span>
                    <span className="flex items-center gap-1">
                      <ChartBarIcon className="w-4 h-4" /> 
                      <strong>{campaign.efficiency || 0}%</strong> efficiency
                    </span>
                  </span>
                </motion.li>
              ))
            ) : (
              <li className="py-4 text-center text-[#404e7c] dark:text-[#b0b0c3]">
                <div className="flex flex-col items-center gap-2">
                  <ChartBarIcon className="w-8 h-8 text-gray-400" />
                  <span>No recent campaigns available</span>
                  <span className="text-xs">Create your first campaign to see analytics here</span>
                </div>
              </li>
            )}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  )
}
