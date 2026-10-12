import { useState, useEffect } from 'react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Stepper } from '@shared/ui/stepper'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { APP_LANGUAGES } from '@shared/lib/i18n'
import { WelcomeStep } from './steps/WelcomeStep'
import { ConnectClaudeStep } from './steps/ConnectClaudeStep'

interface WelcomeOverlayProps {
  onDismiss: () => void
}

function detectSystemLanguage(): string {
  const nav = navigator.language || ''
  const base = nav.split('-')[0].toLowerCase()
  const match = APP_LANGUAGES.find((l) => l.code === base)
  return match ? match.code : 'en'
}

const TOTAL_STEPS = 2

export function WelcomeOverlay({ onDismiss }: WelcomeOverlayProps): React.JSX.Element {
  const { t, language, setLanguage } = useLanguage()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language)

  useEffect(() => {
    const detected = detectSystemLanguage()
    if (detected !== language) {
      setSelectedLanguage(detected) // eslint-disable-line react-hooks/set-state-in-effect
      setLanguage(detected)
      settingsApi.set({ appLanguage: detected })
    } else {
      setSelectedLanguage(language)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleComplete(): void {
    settingsApi.set({ hasSeenOnboarding: true })
    onDismiss()
  }

  function handleNext(): void {
    if (currentStep < TOTAL_STEPS - 1) setCurrentStep(currentStep + 1)
  }

  function handleBack(): void {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <GateOverlay>
      <Stepper total={TOTAL_STEPS} current={currentStep} />

      {/* Step content */}
      <div className="min-h-[280px] mt-6">
        {currentStep === 0 && (
          <WelcomeStep selectedLanguage={selectedLanguage} onLanguageSelect={setSelectedLanguage} />
        )}
        {currentStep === 1 && <ConnectClaudeStep />}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8">
        {currentStep < TOTAL_STEPS - 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleComplete}
            className="text-muted-foreground"
          >
            {t('welcome.skip')}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('welcome.back')}
            </Button>
          )}
          {currentStep < TOTAL_STEPS - 1 ? (
            <Button onClick={handleNext}>
              {t('welcome.next')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete}>{t('welcome.getStarted')}</Button>
          )}
        </div>
      </div>
    </GateOverlay>
  )
}

/**
 * Full-screen scrim + centered card. Owned by the caller's own visibility
 * state, not a Radix Dialog, so there is no backdrop-click or Escape dismissal.
 */
function GateOverlay({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-6 rounded-xl border border-border bg-card/95 p-6 shadow-lg backdrop-blur-xl">
        {children}
      </div>
    </div>
  )
}
