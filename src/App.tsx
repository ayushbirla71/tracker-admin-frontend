import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import { LiveProvider } from './live';
const Alerts = lazy(() => import('./pages/Alerts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Devices = lazy(() => import('./pages/Devices'));
const Geofences = lazy(() => import('./pages/Geofences'));
const LiveMap = lazy(() => import('./pages/LiveMap'));
const MobileApp = lazy(() => import('./pages/MobileApp'));
import Login from './pages/Login';
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const WorkerDetail = lazy(() => import('./pages/WorkerDetail'));
const Workers = lazy(() => import('./pages/Workers'));

export default function App() {
  const { loggedIn } = useAuth();
  if (!loggedIn) return <Login />;
  return (
    <LiveProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="live" element={<LiveMap />} />
            <Route path="workers" element={<Workers />} />
            <Route path="workers/:id" element={<WorkerDetail />} />
            <Route path="devices" element={<Devices />} />
            <Route path="geofences" element={<Geofences />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="app" element={<MobileApp />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LiveProvider>
  );
}
