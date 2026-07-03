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
    capture_pageview: true,
    capture_pageleave: false,
  })
  initialized = true
}

export function disablePostHog() {
  if (typeof window === "undefined") return
  posthog.opt_out_capturing()
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  try {
    posthog.identify(userId, {
      platform: "apply.outcraft.net",
      ...properties,
    })
  } catch {
    /* posthog not available or opted out */
  }
}

export function resetUser() {
  try {
    posthog.reset()
  } catch {
    /* posthog not available */
  }
}

export function captureEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  try {
    posthog.capture(eventName, {
      platform: "apply.outcraft.net",
      ...properties,
    })
  } catch {
    /* posthog not available or opted out */
  }
}
