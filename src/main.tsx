import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { PostHogProvider } from "@posthog/react"
import { posthogOptions } from "@/lib/posthog"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_POSTHOG_KEY}
      options={posthogOptions}
    >
      <App />
    </PostHogProvider>
  </StrictMode>
)
