import type { PostHog } from 'posthog-js'

/** A public project key: PostHog ships it to every browser, so it is no secret. */
const POSTHOG_KEY = 'phc_uvakVLbnsMmUH879fEjzTZBkSYgccboqV943zzgtV63B'
const POSTHOG_HOST = 'https://eu.i.posthog.com'
/** Dev builds and Vercel previews count nothing. */
const PRODUCTION_HOSTS = ['talyx.app', 'www.talyx.app']

let posthog: PostHog | null = null

/**
 * Counts page views, page leaves and download clicks on talyx.app, without cookies or browser
 * storage. Everything the privacy policy says about the site's analytics is set here.
 */
export function startAnalytics(): void {
  if (!PRODUCTION_HOSTS.includes(location.hostname)) return
  // Loaded only here, so other hosts never download it.
  void import('posthog-js').then(({ default: client }) => {
    client.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      cookieless_mode: 'always',
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: true,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_performance: false,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      // No remote config, no /flags/ call and no scripts from PostHog: project settings in the
      // PostHog UI cannot switch on anything the privacy policy says is off.
      advanced_disable_flags: true,
      disable_external_dependency_loading: true
    })
    posthog = client
  })
  document.addEventListener('click', onDownloadClick)
}

export function trackDownload(asset: string): void {
  // Sent at once, not batched: the visitor may close the tab as the file starts.
  posthog?.capture('download', { asset }, { send_instantly: true })
}

/** A throw here cannot cancel the link: only preventDefault() stops a navigation. */
function onDownloadClick(event: MouseEvent): void {
  const link = event.target instanceof Element && event.target.closest('[data-cta="download"]')
  const asset = link instanceof HTMLElement ? link.dataset.asset : undefined
  if (asset) trackDownload(asset)
}
