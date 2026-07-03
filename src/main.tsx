import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { initPostHog } from "@/lib/posthog"
import App from "./App"
import "./index.css"

initPostHog()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
