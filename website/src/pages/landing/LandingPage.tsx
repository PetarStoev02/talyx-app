import { HeroSection } from './sections/HeroSection'
import { HowItWorksSection } from './sections/HowItWorksSection'
import { TryItSection } from './sections/TryItSection'
import { FeaturesSection } from './sections/FeaturesSection'
import { PrivacySection } from './sections/PrivacySection'
import { FAQSection } from './sections/FAQSection'
import { DownloadSection } from '../../widgets/download/DownloadSection'
import { InstallSteps } from './sections/InstallSteps'

/** The page as a series of claims, each followed by its proof. */
export function LandingPage() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <TryItSection />
      <FeaturesSection />
      <PrivacySection />
      <FAQSection />
      <DownloadSection />
      <InstallSteps />
    </>
  )
}
