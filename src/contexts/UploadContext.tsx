import { createContext, useContext, useState, type ReactNode } from 'react'

export interface UploadProgress {
  fileIndex: number
  fileCount: number
  fileName: string
  percent: number
}

interface UploadContextValue {
  uploading: boolean
  uploadProgress: UploadProgress | null
  setUploading: (v: boolean) => void
  setUploadProgress: (p: UploadProgress | null) => void
}

const UploadContext = createContext<UploadContextValue>({
  uploading: false,
  uploadProgress: null,
  setUploading: () => {},
  setUploadProgress: () => {},
})

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploading, setUploading]             = useState(false)
  const [uploadProgress, setUploadProgress]   = useState<UploadProgress | null>(null)

  return (
    <UploadContext.Provider value={{ uploading, uploadProgress, setUploading, setUploadProgress }}>
      {children}
    </UploadContext.Provider>
  )
}

export function useUploadContext() {
  return useContext(UploadContext)
}
