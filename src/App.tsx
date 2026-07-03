import { useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { CookieConsentBanner } from "@/components/cookie-consent"
import { useCookieConsent } from "@/hooks/use-cookie-consent"
import { captureEvent } from "@/lib/posthog"
import { FormPage } from "@/pages/form"
import { AuthCallback } from "@/pages/auth-callback"
import { ModeratorDashboardPage } from "@/pages/moderator-dashboard"
import { ModeratorReviewPage } from "@/pages/moderator-review"
import { ModeratorAuditPage } from "@/pages/moderator-audit"
import { ModeratorAuditDetailPage } from "@/pages/moderator-audit-detail"
import { ModeratorSettingsPage } from "@/pages/moderator-settings"
import { ModeratorConflictsPage } from "@/pages/moderator-conflicts"
import { ModeratorConflictDetailPage } from "@/pages/moderator-conflict-detail"
import { UnscoredApplicationsPage } from "@/pages/unscored-applications"
import { NoAccessPage } from "@/pages/no-access"
import { PreviewImagesPage } from "@/pages/preview-images"
import { InviteDashboardPage } from "@/pages/invite-dashboard"
import { InviteRedeemPage } from "@/pages/invite-redeem"
import { ModeratorExportPage } from "@/pages/moderator-export"
import { ModeratorApplicationsPage } from "@/pages/moderator-applications"
import { ModeratorStatisticsPage } from "@/pages/moderator-statistics"
import { DebugPage } from "@/pages/debug"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    captureEvent("$pageview", {
      path: location.pathname,
      search: location.search,
    })
  }, [location.pathname, location.search])

  return null
}

function AppLayout() {
  const { consent, accept, decline } = useCookieConsent()

  return (
    <>
      <PageViewTracker />
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 py-10">
          <Routes>
            <Route path="/" element={<FormPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/moderator" element={<ModeratorDashboardPage />} />
            <Route path="/moderator/review" element={<ModeratorReviewPage />} />
            <Route path="/moderator/audit" element={<ModeratorAuditPage />} />
            <Route path="/moderator/audit/:id" element={<ModeratorAuditDetailPage />} />
            <Route path="/moderator/settings" element={<ModeratorSettingsPage />} />
            <Route path="/moderator/conflicts" element={<ModeratorConflictsPage />} />
            <Route path="/moderator/conflicts/:applicationId" element={<ModeratorConflictDetailPage />} />
            <Route path="/moderator/unscored" element={<UnscoredApplicationsPage />} />
            <Route path="/moderator/export" element={<ModeratorExportPage />} />
            <Route path="/moderator/applications" element={<ModeratorApplicationsPage />} />
            <Route path="/moderator/statistics" element={<ModeratorStatisticsPage />} />
            <Route path="/no-access" element={<NoAccessPage />} />
            <Route path="/preview-images" element={<PreviewImagesPage />} />
            <Route path="/invites" element={<InviteDashboardPage />} />
            <Route path="/invite/:code" element={<InviteRedeemPage />} />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </main>

        <footer className="mt-auto border-t border-white/5 py-6 text-center">
          <p className="text-xs text-white/20">
            OutCraft &copy; {new Date().getFullYear()}
            <span className="mx-2 text-white/10">|</span>
            <a
              href="https://tos.outcraft.net"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/50"
            >
              Terms
            </a>
            <span className="mx-2 text-white/10">|</span>
            <a
              href="https://tos.outcraft.net#privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/50"
            >
              Privacy
            </a>
            <span className="mx-2 text-white/10">|</span>
            <a
              href="https://tos.outcraft.net#cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/50"
            >
              Cookies
            </a>
          </p>
        </footer>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "oklch(0.15 0.01 260)",
            color: "oklch(0.92 0.01 260)",
            border: "1px solid oklch(0.3 0.01 260)",
          },
        }}
      />
      {consent === null && (
        <CookieConsentBanner onAccept={accept} onDecline={decline} />
      )}
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
