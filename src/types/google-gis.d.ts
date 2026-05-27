// Google Identity Services (GIS) type declarations
interface GISTokenResponse {
  access_token: string
  error?: string
  error_description?: string
  expires_in?: number
}

interface GISTokenClient {
  requestAccessToken: (options?: { prompt?: string; hint?: string }) => void
}

interface Window {
  google: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: GISTokenResponse) => void
          error_callback?: (error: unknown) => void
        }) => GISTokenClient
      }
    }
  }
}
