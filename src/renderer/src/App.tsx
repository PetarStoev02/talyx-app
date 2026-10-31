import { Toaster } from 'sonner'
import { useNavigation } from '@app/providers/useNavigation'
import { OfficePage } from '@pages/office'

const pages = { office: <OfficePage /> }

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
