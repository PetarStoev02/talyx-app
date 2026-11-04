// English only for now (pivot decision 11). Another language is one more table here.
const en = {
  'app.alpha': 'alpha',
  'nav.agents': 'Agents',
  'nav.settings': 'Settings',
  'nav.updateVersion': 'Update v{version}',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',
  'agents.empty': 'Nothing here yet',
  'nav.engineDebug': 'Engine (debug)',
  'engine.checking': 'Looking for the engine…',
  'engine.missingTitle': 'Talyx needs its engine.',
  'engine.missingBody':
    'The engine runs your bots on this machine. Its command must be on your PATH as talyx-engine, or choose the file.',
  'engine.retry': 'Retry',
  'engine.chooseFile': 'Choose file',
  'engine.errorTitle': 'Talyx could not attach to the engine.',
  'engine.debugProfile': 'Profile',
  'engine.debugPing': 'Send "ping"',
  'engine.debugDrop': 'Drop socket',
  'engine.debugClear': 'Clear',
  'engine.debugWaiting': 'Events appear here.',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeDesc': 'Choose your preferred color scheme',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.system': 'System',
  'updater.available': 'Talyx v{version} is available',
  'updater.openPage': 'Open download page'
}

export type TranslationKey = keyof typeof en

const translations: Record<string, Record<TranslationKey, string>> = { en }

export function t(key: TranslationKey, language: string): string {
  return translations[language]?.[key] ?? en[key]
}
