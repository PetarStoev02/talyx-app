import { features } from './navigation'

/** Every page that is prerendered and listed in the sitemap. vercel.json redirects must never name one. */
export const ROUTES: string[] = [
  '/',
  ...features.map(({ slug }) => `/features/${slug}`),
  '/roadmap',
  '/press',
  '/pricing',
  '/contact',
  '/legal/terms',
  '/legal/privacy',
  '/legal/refund'
]
