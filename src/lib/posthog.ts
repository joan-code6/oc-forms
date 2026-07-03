import posthog from "posthog-js"

let initialized = false

export function initPostHog() {
  if (typeof window === "undefined") return
  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing()
  }

  if (initialized) {
    posthog.opt_in_capturing()
    return
  }

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: false,
  })
  initialized = true
}

export function disablePostHog() {
  if (typeof window === "undefined") return
  posthog.opt_out_capturing()
}
