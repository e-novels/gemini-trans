import { buildGeminiRequestBody } from './promptBuilder'
import { GeminiConfig, GeminiGenerateContentRequest, GeminiGenerateContentResponse } from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash'
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GeminiClientOptions {
  network: ExtensionNetworkApi
  logger?: {
    info(...values: unknown[]): Promise<void>
    warn(...values: unknown[]): Promise<void>
    error(...values: unknown[]): Promise<void>
  }
}

export function extractTextFromResponse(response: GeminiGenerateContentResponse): string {
  if (!response || !response.candidates || response.candidates.length === 0) {
    if (response?.error?.message) {
      throw new Error(`Gemini API Error (${response.error.code || 'UNKNOWN'}): ${response.error.message}`)
    }
    throw new Error('Gemini API returned an empty response or no candidates.')
  }

  const candidate = response.candidates[0]
  const text = candidate?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Gemini candidate does not contain valid text content.')
  }

  return text
}

export function parseTranslationsFromText(rawText: string, expectedCount: number): string[] {
  let cleaned = rawText.trim()

  // Remove markdown code fences if present (e.g. ```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  }

  // Try parsing as JSON object or array
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed.map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.translations)) {
      return parsed.translations.map((item: unknown) => (typeof item === 'string' ? item : String(item ?? '')))
    }
  } catch {
    // If standard JSON parse fails, fallback to line-based extraction
  }

  // Fallback: Split by lines if JSON parsing fails
  const lines = cleaned
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length === expectedCount) {
    return lines
  }

  // If count still differs, return array of raw lines padded/truncated to expectedCount
  const result: string[] = []
  for (let i = 0; i < expectedCount; i++) {
    if (i < lines.length) {
      result.push(lines[i])
    } else {
      result.push(`[Chưa dịch]`)
    }
  }
  return result
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class GeminiClient {
  private network: ExtensionNetworkApi
  private logger?: GeminiClientOptions['logger']

  constructor(options: GeminiClientOptions) {
    this.network = options.network
    this.logger = options.logger
  }

  async translateChunk(
    paragraphs: string[],
    config: GeminiConfig,
    options: { sourceLang?: string; targetLang?: string }
  ): Promise<string[]> {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng vào Cài đặt Tiện ích để nhập API Key.')
    }

    const apiKey = config.apiKey.trim()
    const model = (config.model && config.model.trim()) || DEFAULT_MODEL
    const targetLang = options.targetLang || config.targetLang || 'vi'
    const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

    const requestBody: GeminiGenerateContentRequest = buildGeminiRequestBody(paragraphs, {
      sourceLang: options.sourceLang,
      targetLang,
      style: config.style,
      temperature: config.temperature,
      glossary: config.glossary,
      customPrompt: config.customPrompt
    })

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.network.fetchJson<GeminiGenerateContentResponse>(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (response.error) {
          const isRateLimit = response.error.code === 429 || response.error.status === 'RESOURCE_EXHAUSTED'
          if (isRateLimit && attempt < maxRetries) {
            const backoffMs = attempt * 2000
            await this.logger?.warn?.(
              `Gemini API Rate Limit (429). Đang thử lại lượt ${attempt}/${maxRetries} sau ${backoffMs}ms...`
            )
            await sleep(backoffMs)
            continue
          }
          throw new Error(`Gemini API Lỗi (${response.error.code || 'UNKNOWN'}): ${response.error.message}`)
        }

        const rawText = extractTextFromResponse(response)
        const translations = parseTranslationsFromText(rawText, paragraphs.length)

        if (translations.length !== paragraphs.length) {
          await this.logger?.warn?.(
            `Gemini trả về ${translations.length} đoạn, mong đợi ${paragraphs.length} đoạn. Đang cân chỉnh danh sách...`
          )
          // Align lengths
          while (translations.length < paragraphs.length) {
            const missingIndex = translations.length
            translations.push(paragraphs[missingIndex])
          }
          if (translations.length > paragraphs.length) {
            translations.length = paragraphs.length
          }
        }

        return translations
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const errorMsg = lastError.message

        const isTransient =
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('503') ||
          errorMsg.includes('500')

        if (isTransient && attempt < maxRetries) {
          const backoffMs = attempt * 2000
          await this.logger?.warn?.(`Gọi Gemini API thất bại (lượt ${attempt}/${maxRetries}): ${errorMsg}. Đang thử lại...`)
          await sleep(backoffMs)
          continue
        }

        break
      }
    }

    throw lastError || new Error('Không thể kết nối tới Google Gemini API sau nhiều lần thử.')
  }

  async testConnection(config: GeminiConfig): Promise<{ success: boolean; message: string }> {
    if (!config.apiKey || !config.apiKey.trim()) {
      return {
        success: false,
        message: 'Vui lòng nhập Google Gemini API Key trước khi kiểm tra kết nối.'
      }
    }

    const targetLang = config.targetLang || 'vi'
    const sourceLang = targetLang === 'en' ? 'vi' : 'en'
    const testParagraphs = sourceLang === 'en'
      ? ['Hello world, this is a test novel paragraph.']
      : ['Xin chào thế giới! Đây là câu kiểm tra kết nối Gemini API.']

    try {
      const results = await this.translateChunk(testParagraphs, config, {
        sourceLang,
        targetLang
      })

      if (results && results.length > 0 && results[0].trim()) {
        return {
          success: true,
          message: `Kết nối Gemini API thành công!\nModel: ${config.model || DEFAULT_MODEL}\nNgôn ngữ đích: ${targetLang}\nBản dịch mẫu (${sourceLang} -> ${targetLang}): "${results[0]}"`
        }
      }

      return {
        success: false,
        message: 'Gemini API trả về kết quả rỗng khi kiểm tra thử.'
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        message: `Kiểm tra kết nối thất bại: ${msg}`
      }
    }
  }
}
