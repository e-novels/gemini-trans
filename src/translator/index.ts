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
  key: string,
  defaultValue?: string
): Promise<string | undefined> {
  if (!storage) return defaultValue
  const val = await storage.get(key)
  return typeof val === 'string' && val.trim() ? val.trim() : defaultValue
}

async function getNumber(
  storage: ExtensionStorageApi | undefined,
  key: string,
  defaultValue?: number
): Promise<number | undefined> {
  if (!storage) return defaultValue
  const val = await storage.get(key)
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = Number(val)
    if (Number.isFinite(parsed)) return parsed
  }
  return defaultValue
}

export async function getStoredConfig(novel: NovelExtensionApi): Promise<GeminiConfig> {
  const apiKey = await getString(novel.storage, 'apiKey')
  const model = (await getString(novel.storage, 'model', 'gemini-2.5-flash')) || 'gemini-2.5-flash'
  const targetLang = (await getString(novel.storage, 'targetLang', 'vi')) || 'vi'
  const style = (await getString(novel.storage, 'style', 'tienhiep_kiemhiep')) || 'tienhiep_kiemhiep'
  const temperature = (await getNumber(novel.storage, 'temperature', 0.3)) ?? 0.3
  const batchSize = (await getNumber(novel.storage, 'batchSize', 25)) ?? 25
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
      const effectiveTargetLang = targetLang || config.targetLang || 'vi'

      // If API key is configured and network permission is available, use Gemini API
      if (config.apiKey && novel.network) {
        try {
          const translatedParagraphs = await batchProcessor.processParagraphs(paragraphs, config, {
            sourceLang: sourceLang || 'auto',
            targetLang: effectiveTargetLang
          })
          return {
            translatedParagraphs,
            translatedText: translatedParagraphs.join('\n')
          } as any
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          await novel.logger.warn('Gemini API translation error, falling back to batch mock translator:', errMsg)
        }
      }

      // Default mock batch translator fallback when API key is not yet set
      const translatedParagraphs = paragraphs.map(p => {
        if (!p || !p.trim() || p.startsWith('@{') || p.startsWith('!{')) {
          return p
        }
        return `[AI Translated] ${p}`
      })

      return {
        translatedParagraphs,
        translatedText: translatedParagraphs.join('\n')
      } as any
    }
  })

  // Register Settings Action handlers
  if (novel.settings?.register) {
    novel.settings.register({
      testConnection: async (values: Record<string, unknown>) => {
        const storedConfig = await getStoredConfig(novel)
        const apiKey = typeof values?.apiKey === 'string' && values.apiKey.trim()
          ? values.apiKey.trim()
          : storedConfig.apiKey
        const model = typeof values?.model === 'string' && values.model.trim()
          ? values.model.trim()
          : storedConfig.model
        const targetLang = typeof values?.targetLang === 'string' && values.targetLang.trim()
          ? values.targetLang.trim()
          : storedConfig.targetLang || 'vi'

        const result = await client.testConnection({
          ...storedConfig,
          apiKey,
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
