import posthog from "posthog-js"

export function initPostHog() {
  if (typeof window === "undefined") return

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: false,
  })
}
