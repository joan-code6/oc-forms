import posthog from "posthog-js"

export const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  person_profiles: "identified_only" as const,
  capture_pageview: true,
  capture_pageleave: false,
}

export function initPostHog() {
  if (typeof window === "undefined") return

  posthog.init(import.meta.env.VITE_POSTHOG_KEY, posthogOptions)
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

export function captureOAuthError(message: string, code?: string) {
  try {
    posthog.captureException(new Error(message), {
      source: "oauth_callback",
      errorCode: code || "unknown",
    })
  } catch {
    /* ignore */
  }
}
