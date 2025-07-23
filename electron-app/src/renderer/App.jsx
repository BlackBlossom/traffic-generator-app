import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TitleBar from './components/TitleBar';
import TrafficSettings from './pages/TrafficSettings';
import ProxyManagement from './pages/ProxyManagement';
import TrafficAnalytics from './pages/TrafficAnalytics';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import DebugPage from './pages/DebugPage';
import { UserProvider } from './context/UserContext';
import { WebSocketProvider } from './context/WebSocketLogContext';

// Simple private route wrapper
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <TitleBar />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <UserProvider>
                <WebSocketProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/traffic-settings" element={<TrafficSettings />} />
                      <Route path="/proxy-management" element={<ProxyManagement />} />
                      <Route path="/traffic-analytics" element={<TrafficAnalytics />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/debug" element={<DebugPage/>} />
                      {/* Add more protected routes here */}
                    </Routes>
                  </Layout>
                </WebSocketProvider>
              </UserProvider>
            </PrivateRoute>
          }
        />
        {/* Catch-all: Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
