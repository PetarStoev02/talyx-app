import { toast } from 'sonner'
import { errorMessage } from '@features/bot-card/cardStyles'

/** Runs a main-process call and toasts its error; resolves true when it worked. */
export async function attempt(action: () => Promise<unknown>, failure: string): Promise<boolean> {
  try {
    await action()
    return true
  } catch (err) {
    toast.error(errorMessage(err, failure))
    return false
  }
}

export async function copyText(text: string): Promise<void> {
  if (await attempt(() => navigator.clipboard.writeText(text), 'Could not copy')) {
    toast.success('Copied')
  }
}
