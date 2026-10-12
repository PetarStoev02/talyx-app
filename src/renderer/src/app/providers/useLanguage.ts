import { create } from 'zustand'
import { t, translateCategory, type TranslationKey } from '@shared/lib/i18n'

interface LanguageState {
  language: string
  setLanguage: (lang: string) => void
  t: (key: TranslationKey) => string
  tc: (category: string) => string
}

export const useLanguage = create<LanguageState>((set, get) => ({
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  t: (key) => t(key, get().language),
  tc: (category) => translateCategory(category, get().language)
}))
