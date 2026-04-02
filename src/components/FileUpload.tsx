'use client'
import { useRef } from 'react'

interface FileUploadProps {
  accept?: string
  onFile: (file: File, dataUrl?: string) => void
  children: React.ReactNode
  style?: React.CSSProperties
  asDataUrl?: boolean
}

/**
 * Reliable file upload wrapper that works on ALL devices (iOS, Android, desktop).
 * Wraps children in a clickable area that opens the native file picker.
 */
export default function FileUpload({ accept = 'image/*', onFile, children, style, asDataUrl = true }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (asDataUrl) {
      const reader = new FileReader()
      reader.onload = () => onFile(file, reader.result as string)
      reader.readAsDataURL(file)
    } else {
      onFile(file)
    }

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div onClick={handleClick} style={{ cursor: 'pointer', position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        tabIndex={-1}
      />
      {children}
    </div>
  )
}
