import { useEffect } from "react"

export function CookieConsentBanner({
  onAccept,
  onDecline,
}: {
  onAccept: () => void
  onDecline: () => void
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-[oklch(0.13_0.01_260)] p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <svg
            className="mb-4 h-10 w-10 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>

          <h2 className="mb-2 text-xl font-bold text-white">We use cookies</h2>

          <p className="mb-6 text-sm leading-relaxed text-white/50">
            This site uses essential cookies for authentication and analytics
            cookies (via PostHog) to improve your experience. By continuing,
            you agree to our use of cookies.
          </p>

          <button
            onClick={onAccept}
            className="mb-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-purple-600/30 transition-all hover:from-purple-500 hover:to-purple-400 hover:shadow-purple-500/40 active:scale-[0.98]"
          >
            Accept &amp; Continue
          </button>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/20">
            <button
              onClick={onDecline}
              className="cursor-pointer transition-colors hover:text-white/35"
            >
              Decline
            </button>
            <a
              href="https://tos.outcraft.net#cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white/35"
            >
              Cookie Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
