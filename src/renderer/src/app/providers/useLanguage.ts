import { create } from 'zustand'
import { t, type TranslationKey } from '@shared/lib/i18n'

interface LanguageState {
  language: string
  t: (key: TranslationKey) => string
}

export const useLanguage = create<LanguageState>((_set, get) => ({
  language: 'en',
  t: (key) => t(key, get().language)
}))
