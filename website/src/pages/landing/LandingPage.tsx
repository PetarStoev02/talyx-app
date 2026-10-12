import { OpenSourceBanner } from './sections/OpenSourceBanner'
import { HeroSection } from './sections/HeroSection'
import { FeaturesSection } from './sections/FeaturesSection'
import { PrivacySection } from './sections/PrivacySection'
import { ComparisonSection } from './sections/ComparisonSection'
import { FAQSection } from './sections/FAQSection'
import { DownloadSection } from './sections/DownloadSection'
import { CtaBreak } from './sections/DownloadCta'
import { StickyMobileCta } from './sections/StickyMobileCta'

/** One offer, one audience, one action — repeated after every proof block. */
export function LandingPage() {
  return (
    <>
      <OpenSourceBanner />
      <HeroSection />
      <FeaturesSection />
      <CtaBreak />
      <PrivacySection />
      <CtaBreak />
      <ComparisonSection />
      <CtaBreak />
      <FAQSection />
      <DownloadSection />
      <div aria-hidden="true" className="h-24 sm:hidden" />
      <StickyMobileCta />
    </>
  )
}
