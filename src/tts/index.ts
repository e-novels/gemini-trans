import { ProcessBridge } from './processMode/bridge'
import { CloudBridge } from './cloudMode/bridge'
import { WasmBridge } from './wasmMode/bridge'

export async function activateTTS(novel: NovelExtensionApi): Promise<void> {
  if (!novel.tts) return
  const mode = novel.extension?.manifest?.contributes?.tts?.mode || 'process'

  let speakFn: (params: ExtensionTTSSpeakRequest) => Promise<ExtensionTTSSpeakResponse>

  if (mode === 'process') {
    const bridge = new ProcessBridge(novel)
    speakFn = async (params: ExtensionTTSSpeakRequest) => bridge.sendCommand('speak', params)
    await novel.tts.register({
      getVoices: async () => {
        if (!novel.process) {
          throw new Error('novel.process is only available on Electron Desktop.')
        }
        await bridge.startProcess('bin/server')
        return await bridge.sendCommand('getVoices', {})
      },
      speak: speakFn,
      stop: async () => {
        return await bridge.sendCommand('stop', {})
      }
    })
  } else if (mode === 'cloud') {
    const bridge = new CloudBridge(novel)
    speakFn = async (params: ExtensionTTSSpeakRequest) => bridge.speak(params)
    await novel.tts.register({
      getVoices: async () => bridge.getVoices(),
      speak: speakFn,
      stop: async () => bridge.stop()
    })
  } else if (mode === 'wasm') {
    const bridge = new WasmBridge(novel)
    speakFn = async (params: ExtensionTTSSpeakRequest) => bridge.speak(params)
    await novel.tts.register({
      getVoices: async () => bridge.getVoices(),
      speak: speakFn,
      stop: async () => bridge.stop()
    })
  }

  // Register settings action for voice previewing
  if (novel.settings) {
    await novel.settings.register({
      previewVoice: async (fieldValues: Record<string, unknown>) => {
        const voiceId = typeof fieldValues.voice === 'string' ? fieldValues.voice : undefined
        const previewText =
          typeof fieldValues.previewText === 'string' && fieldValues.previewText.trim()
            ? fieldValues.previewText.trim()
            : 'This is a sample speech synthesis test.'

        try {
          const result = await speakFn({
            text: previewText,
            voiceId
          })

          return {
            success: true,
            message: `Synthesized sample audio (${voiceId || 'default voice'})`,
            audio: result.audio,
            mimeType: result.mimeType || 'audio/wav'
          }
        } catch (err: unknown) {
          return {
            success: false,
            message: err instanceof Error ? err.message : String(err)
          }
        }
      }
    })
  }
}

