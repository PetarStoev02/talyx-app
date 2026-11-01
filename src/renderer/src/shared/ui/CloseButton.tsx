export function CloseButton({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="-mt-1 -mr-1 cursor-pointer rounded-md px-1.5 text-lg leading-6 text-[#949494] hover:text-white focus-visible:outline-2 focus-visible:outline-white"
    >
      ×
    </button>
  )
}
