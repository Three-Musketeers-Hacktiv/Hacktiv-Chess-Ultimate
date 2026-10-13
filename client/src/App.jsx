import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards'
import { FullPageLoader } from './components/ui/Spinner'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LobbyPage from './pages/LobbyPage'
import NotFoundPage from './pages/NotFoundPage'

// The board stack (react-chessboard + chess.js) is only fetched when a game or review opens.
const ArenaPage = lazy(() => import('./pages/ArenaPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/arena/:roomId" element={<ArenaPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
