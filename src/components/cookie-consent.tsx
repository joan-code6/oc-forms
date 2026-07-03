import { useState, useEffect } from "react"

export function CookieConsentBanner({
  onAccept,
  onDecline,
}: {
  onAccept: () => void
  onDecline: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(timer)
  }, [])

  const handleAccept = () => {
    setVisible(false)
    setTimeout(onAccept, 300)
  }

  const handleDecline = () => {
    setVisible(false)
    setTimeout(onDecline, 300)
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="border-t border-white/10 bg-[oklch(0.13_0.01_260)]/95 px-6 py-5 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-white/60">
            We use essential cookies for authentication and analytics cookies
            (via PostHog) to understand how our platform is used. By clicking
            &quot;Accept&quot; you consent to analytics cookies. See our{" "}
            <a
              href="https://tos.outcraft.net#cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-white/90"
            >
              Cookie Policy
            </a>{" "}
            for details.
          </p>
          <div className="flex shrink-0 gap-3">
            <button
              onClick={handleDecline}
              className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
