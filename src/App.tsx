import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import CrmLayout from './layouts/CrmLayout'
import Dashboard from './pages/Dashboard'
import ClientList from './pages/ClientList'
import ClientDetail from './pages/ClientDetail'
import Revenue from './pages/Revenue'
import Settings from './pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/crm/*"
        element={
          <ProtectedRoute>
            <CrmLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<ClientList />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="credit" element={<div className="p-8 text-gray-400">Credit - Coming Soon</div>} />
        <Route path="interactions" element={<div className="p-8 text-gray-400">Interactions - Coming Soon</div>} />
        <Route path="reports" element={<div className="p-8 text-gray-400">Reports - Coming Soon</div>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/crm" replace />} />
    </Routes>
  )
}
