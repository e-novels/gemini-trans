import { BatchProcessor } from './batchProcessor'
import { GeminiClient } from './geminiClient'
import { GeminiConfig } from './types'

export * from './types'
export * from './promptBuilder'
export * from './geminiClient'
export * from './batchProcessor'

const SOURCE_LANGUAGES = ['auto', 'zh', 'ja', 'ko', 'en', 'vi', 'fr', 'de', 'ru', 'es', 'th']
const TARGET_LANGUAGES = ['vi', 'en', 'zh', 'ja', 'ko', 'fr', 'de', 'ru', 'es', 'th']

async function getString(
  storage: ExtensionStorageApi | undefined,
  key: string
): Promise<string | undefined> {
  if (!storage) return undefined
  const val = await storage.get(key)
  return typeof val === 'string' && val.trim() ? val.trim() : undefined
}

async function getNumber(
  storage: ExtensionStorageApi | undefined,
  key: string
): Promise<number | undefined> {
  if (!storage) return undefined
  const val = await storage.get(key)
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = Number(val)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export async function saveConfigToStorage(
  storage: ExtensionStorageApi | undefined,
  values: Record<string, unknown>
): Promise<void> {
  if (!storage || !values || typeof values !== 'object') return

  if (typeof values.apiKey === 'string' && values.apiKey.trim().length > 0) {
    await storage.set('apiKey', values.apiKey.trim())
  }
  if (typeof values.model === 'string' && values.model.trim()) {
    await storage.set('model', values.model.trim())
  }
  if (typeof values.targetLang === 'string' && values.targetLang.trim()) {
    await storage.set('targetLang', values.targetLang.trim())
  }
  if (typeof values.style === 'string' && values.style.trim()) {
    await storage.set('style', values.style.trim())
  }
  if (values.temperature !== undefined && values.temperature !== null && values.temperature !== '') {
    const tempNum = Number(values.temperature)
    if (Number.isFinite(tempNum)) {
      await storage.set('temperature', Math.max(0, Math.min(1, tempNum)))
    }
  }
  if (values.batchSize !== undefined && values.batchSize !== null && values.batchSize !== '') {
    const batchNum = Number(values.batchSize)
    if (Number.isFinite(batchNum)) {
      await storage.set('batchSize', Math.max(0, Math.min(200, Math.round(batchNum))))
    }
  }
  if (typeof values.glossary === 'string') {
    await storage.set('glossary', values.glossary)
  }
  if (typeof values.customPrompt === 'string') {
    await storage.set('customPrompt', values.customPrompt)
  }
}

export async function getStoredConfig(novel: NovelExtensionApi): Promise<GeminiConfig> {
  const apiKey = await getString(novel.storage, 'apiKey')
  const model = (await getString(novel.storage, 'model')) || 'gemini-2.5-flash'
  const targetLang = await getString(novel.storage, 'targetLang')
  const style = (await getString(novel.storage, 'style')) || 'tienhiep_kiemhiep'
  const temperature = (await getNumber(novel.storage, 'temperature')) ?? 0.3
  const batchSize = (await getNumber(novel.storage, 'batchSize')) ?? 0
  const glossary = await getString(novel.storage, 'glossary')
  const customPrompt = await getString(novel.storage, 'customPrompt')

  return {
    apiKey,
    model,
    targetLang,
    style,
    temperature,
    batchSize,
    glossary,
    customPrompt
  }
}

export function registerTranslatorProfile(novel: NovelExtensionApi): void {
  if (!novel.translator) {
    throw new Error('Translator API is not available on novel instance.')
  }

  const client = new GeminiClient({
    network: novel.network || {
      fetchJson: async () => ({}) as any,
      fetchText: async () => '',
      fetchDataUrl: async () => ''
    },
    logger: novel.logger
  })

  const batchProcessor = new BatchProcessor({
    client,
    progress: novel.progress,
    logger: novel.logger
  })

  novel.translator.register({
    getLanguages: () => {
      return {
        sourceLanguages: SOURCE_LANGUAGES,
        targetLanguages: TARGET_LANGUAGES
      }
    },
    translate: async (request: TranslateRequest & { text?: string }) => {
      const isSingleText = typeof request?.text === 'string' && (!request.paragraphs || !Array.isArray(request.paragraphs))
      const paragraphs = isSingleText ? [request.text!] : request.paragraphs
      const { sourceLang, targetLang } = request

      if (!paragraphs || !Array.isArray(paragraphs)) {
        return { translatedParagraphs: [], translatedText: '' } as any
      }

      const config = await getStoredConfig(novel)
      // Prioritize the user's explicitly configured targetLang from extension settings
      const effectiveTargetLang = config.targetLang || (typeof targetLang === 'string' && targetLang.trim() ? targetLang.trim() : 'vi')
      const effectiveSourceLang = typeof sourceLang === 'string' && sourceLang.trim() ? sourceLang.trim() : 'auto'
      const maskedKey = config.apiKey
        ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}`
        : 'Chưa có'

      await novel.logger.info(
        `[Gemini Translator] Nhận yêu cầu dịch ${paragraphs.length} đoạn văn [${effectiveSourceLang} ➔ ${effectiveTargetLang}]\n` +
        `  • Cấu hình: Model=${config.model}, Ngôn ngữ đích=${effectiveTargetLang}, BatchSize=${config.batchSize || 0} (${!config.batchSize || config.batchSize === 0 ? 'Dịch toàn bộ chương trong 1 lượt' : `mẻ ${config.batchSize} đoạn`}), Style=${config.style}, Temp=${config.temperature}, Key=${maskedKey}`
      )

      // If API key is configured and network permission is available, use Gemini API
      if (config.apiKey && novel.network) {
        try {
          const translatedParagraphs = await batchProcessor.processParagraphs(paragraphs, config, {
            sourceLang: effectiveSourceLang,
            targetLang: effectiveTargetLang
          })
          return {
            translatedParagraphs,
            translatedText: translatedParagraphs.join('\n')
          } as any
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          await novel.logger.error('[Gemini Translator] Lỗi gọi Gemini API:', errMsg)
        }
      } else {
        if (!config.apiKey) {
          await novel.logger.warn(
            '[Gemini Translator] Chưa cấu hình API Key trong Cài đặt Tiện ích. Vui lòng nhập API Key để kích hoạt dịch thuật tự động.'
          )
        } else if (!novel.network) {
          await novel.logger.warn('[Gemini Translator] Extension thiếu quyền network để gọi Gemini API.')
        }
      }

      // Fallback: return original paragraphs cleanly without prefix
      const translatedParagraphs = paragraphs.map(p => p)

      return {
        translatedParagraphs,
        translatedText: translatedParagraphs.join('\n')
      } as any
    }
  })

  // Register Settings Action handlers
  if (novel.settings?.register) {
    novel.settings.register({
      saveSettings: async (values: Record<string, unknown>) => {
        try {
          await saveConfigToStorage(novel.storage, values)
          const updatedConfig = await getStoredConfig(novel)
          const hasKey = Boolean(updatedConfig.apiKey)
          const keyStatus = hasKey
            ? `API Key: ${updatedConfig.apiKey!.slice(0, 6)}...${updatedConfig.apiKey!.slice(-4)}`
            : 'Chưa có API Key'
          const langStatus = updatedConfig.targetLang ? `Ngôn ngữ đích: ${updatedConfig.targetLang}` : 'Ngôn ngữ đích: vi'
          await novel.logger?.info?.(`[Gemini Translator] Đã lưu cấu hình cài đặt (${keyStatus}, ${langStatus}).`)
          return {
            success: true,
            message: `Đã lưu cài đặt thành công!\n(${keyStatus}, ${langStatus})`
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          await novel.logger?.error?.('[Gemini Translator] Lỗi khi lưu cài đặt:', msg)
          return {
            success: false,
            message: `Lỗi khi lưu cài đặt: ${msg}`
          }
        }
      },
      testConnection: async (values: Record<string, unknown>) => {
        if (novel.storage) {
          await saveConfigToStorage(novel.storage, values)
        }

        const storedConfig = await getStoredConfig(novel)
        const inputApiKey = typeof values?.apiKey === 'string' && values.apiKey.trim().length > 0
          ? values.apiKey.trim()
          : undefined
        const effectiveApiKey = inputApiKey || storedConfig.apiKey

        if (!effectiveApiKey) {
          return {
            success: false,
            message: 'Chưa tìm thấy Google Gemini API Key. Vui lòng nhập API Key và nhấn "Lưu cài đặt" trước khi kiểm tra.'
          }
        }

        const model = typeof values?.model === 'string' && values.model.trim()
          ? values.model.trim()
          : storedConfig.model
        const targetLang = typeof values?.targetLang === 'string' && values.targetLang.trim()
          ? values.targetLang.trim()
          : storedConfig.targetLang || 'vi'

        const result = await client.testConnection({
          ...storedConfig,
          apiKey: effectiveApiKey,
          model,
          targetLang
        })

        return {
          success: result.success,
          message: result.message
        }
      }
    })
  }
}
