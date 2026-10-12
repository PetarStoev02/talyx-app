import {
  createRouter,
  createRoute,
  createRootRoute,
  lazyRouteComponent,
  type RouterHistory
} from '@tanstack/react-router'
import { RootLayout } from './RootLayout'
import { LandingPage } from '../pages/landing/LandingPage'
import { NotFoundPage } from '../pages/not-found/NotFoundPage'

// Only the landing page ships in the first chunk. Everything else — including
// react-markdown on the legal pages — loads on demand,
// so a first visit downloads the page it actually asked for.
//
// lazyRouteComponent, not React.lazy: the router awaits these in `router.load()`,
// so the static prerender emits finished HTML instead of a Suspense placeholder
// the browser has to fill in afterwards.
const BlogPage = lazyRouteComponent(() => import('../pages/blog/BlogPage'), 'BlogPage')
const BlogPostPage = lazyRouteComponent(() => import('../pages/blog/BlogPostPage'), 'BlogPostPage')
const PressKitPage = lazyRouteComponent(() => import('../pages/press/PressKitPage'), 'PressKitPage')
const FeaturePage = lazyRouteComponent(() => import('../pages/features/FeaturePage'), 'FeaturePage')
const UseCasePage = lazyRouteComponent(
  () => import('../pages/use-cases/UseCasePage'),
  'UseCasePage'
)
const ContactPage = lazyRouteComponent(() => import('../pages/contact/ContactPage'), 'ContactPage')
const RoadmapPage = lazyRouteComponent(() => import('../pages/roadmap/RoadmapPage'), 'RoadmapPage')
const LegalPage = lazyRouteComponent(() => import('../pages/legal/LegalPage'), 'LegalPage')

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage
})

const blogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog',
  component: BlogPage
})

const blogPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$slug',
  component: BlogPostPage
})

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$slug',
  component: FeaturePage
})

const useCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/use-cases/$slug',
  component: UseCasePage
})

const pressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/press',
  component: PressKitPage
})

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contact',
  component: ContactPage
})

const roadmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roadmap',
  component: RoadmapPage
})

const legalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/legal/$slug',
  component: LegalPage
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  blogRoute,
  blogPostRoute,
  featureRoute,
  useCaseRoute,
  pressRoute,
  contactRoute,
  roadmapRoute,
  legalRoute
])

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundPage,
    ...(history ? { history } : {})
  })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
