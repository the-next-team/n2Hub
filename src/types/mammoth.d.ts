declare module 'mammoth' {
  interface ConversionResult {
    value: string
    messages: { type: string; message: string }[]
  }
  function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConversionResult>
  function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ConversionResult>
}
