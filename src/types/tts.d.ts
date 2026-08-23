interface ExtensionTTSVoiceInfo {
  id: string
  name: string
  lang: string
  isCloned?: boolean
}

interface ExtensionTTSGetVoicesResponse {
  voices: ExtensionTTSVoiceInfo[]
}

interface ExtensionTTSSpeakRequest {
  text: string
  voiceId?: string
  config?: Record<string, unknown>
}

interface ExtensionTTSSpeakResponse {
  audio: string
  mimeType: string
}

interface ExtensionTTSStopResponse {
  success?: boolean
}

interface ExtensionTTSResource {
  url: string
  path: string
  size: number
  sha256: string
}

interface ExtensionTTSHandlerMap {
  getVoices(): ExtensionMaybePromise<ExtensionTTSGetVoicesResponse>
  speak(request: ExtensionTTSSpeakRequest): ExtensionMaybePromise<ExtensionTTSSpeakResponse>
  stop?(): ExtensionMaybePromise<ExtensionTTSStopResponse | void>
}

interface ExtensionTTSApi {
  register(handlers: ExtensionTTSHandlerMap): Promise<void>
}

