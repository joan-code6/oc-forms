import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { initPostHog, disablePostHog } from "@/lib/posthog"
import App from "./App"
import "./index.css"

function applyPostHogConsent() {
  try {
    const consent = localStorage.getItem("oc_cookie_consent")
    if (consent === "accepted") {
      initPostHog()
    } else if (consent === "declined") {
      disablePostHog()
    }
  } catch {
    // localStorage unavailable, skip
  }
}

applyPostHogConsent()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
