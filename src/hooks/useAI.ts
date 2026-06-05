import { useState, useCallback } from 'react'
import { generateDocumentDraft } from '../lib/groq'

export function useAI() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')

  const generate = useCallback(async (documentType: string, projectContext: string) => {
    setIsGenerating(true)
    setGeneratedText('')
    try {
      await generateDocumentDraft(documentType, projectContext, (chunk) => {
        setGeneratedText(prev => prev + chunk)
      })
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => setGeneratedText(''), [])

  return { isGenerating, generatedText, generate, reset }
}
