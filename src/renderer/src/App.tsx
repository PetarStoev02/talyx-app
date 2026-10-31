import { Toaster } from 'sonner'
import { useNavigation } from '@app/providers/useNavigation'
import { OfficePage } from '@pages/office'
import { OfficeSettingsPage } from '@pages/office-settings'

const pages = { office: <OfficePage />, settings: <OfficeSettingsPage /> }

function App(): React.JSX.Element {
  const currentView = useNavigation((s) => s.currentView)
  return (
    <>
      {pages[currentView]}
      <Toaster theme="dark" />
    </>
  )
}

export default App
