import { Globe } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { APP_LANGUAGES } from '@shared/lib/i18n'

interface WelcomeStepProps {
  selectedLanguage: string
  onLanguageSelect: (code: string) => void
}

export function WelcomeStep({
  selectedLanguage,
  onLanguageSelect
}: WelcomeStepProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const setLanguage = useLanguage((s) => s.setLanguage)

  function handleLanguageSelect(code: string): void {
    onLanguageSelect(code)
    setLanguage(code)
    settingsApi.set({ appLanguage: code })
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-4">
        <Globe className="h-6 w-6 text-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{t('welcome.heroTitle')}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t('welcome.heroSubtitle')}</p>
      <div className="grid grid-cols-2 gap-2 w-full max-h-48 overflow-y-auto pr-1">
        {APP_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageSelect(lang.code)}
            className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedLanguage === lang.code
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>
    </div>
  )
}
