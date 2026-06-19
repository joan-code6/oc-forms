import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { FormPage } from "@/pages/form"
import { AuthCallback } from "@/pages/auth-callback"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen">
          <main className="py-10">
            <Routes>
              <Route path="/" element={<FormPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
            </Routes>
          </main>

          <footer className="border-t border-white/5 py-6 text-center">
            <p className="text-xs text-white/20">
              OutCraft Event Server &copy; {new Date().getFullYear()}
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
      </BrowserRouter>
    </QueryClientProvider>
  )
}
