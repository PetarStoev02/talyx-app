const buttonBase =
  'mt-3 mr-1.5 h-[30px] cursor-pointer rounded-md border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-50'

export const cardButton = `${buttonBase} border-[#444] bg-transparent text-white hover:border-[#b4b4b4]`

export const primaryButton = `${buttonBase} border-white bg-white text-black hover:bg-[#e5e5e5]`

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
