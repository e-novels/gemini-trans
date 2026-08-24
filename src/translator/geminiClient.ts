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
    const sourceLang = options.sourceLang || 'auto'
    const url = `${BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

    const requestBody: GeminiGenerateContentRequest = buildGeminiRequestBody(paragraphs, {
      sourceLang,
      targetLang,
      style: config.style,
      temperature: config.temperature,
      glossary: config.glossary,
      customPrompt: config.customPrompt
    })

    const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : `${apiKey.slice(0, 3)}...`
    const samplePreview = paragraphs[0] ? `"${paragraphs[0].slice(0, 70)}${paragraphs[0].length > 70 ? '...' : ''}"` : ''
    const glossaryCount = config.glossary ? config.glossary.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//')).length : 0

    await this.logger?.info?.(
      `[Gemini Translator] 📤 Gửi API Request:\n` +
      `  • Endpoint: ${BASE_URL}/${model}:generateContent?key=${maskedKey}\n` +
      `  • Model: ${model}\n` +
      `  • Ngôn ngữ: [${sourceLang} ➔ ${targetLang}]\n` +
      `  • Số đoạn văn gửi: ${paragraphs.length}\n` +
      `  • Temperature: ${requestBody.generationConfig?.temperature}\n` +
      `  • Style: ${config.style || 'tienhiep_kiemhiep'}\n` +
      `  • Glossary: ${glossaryCount > 0 ? `${glossaryCount} mục` : 'Không có'}\n` +
      `  • Đoạn đầu tiên: ${samplePreview}`
    )

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now()
      try {
        const response = await this.network.fetchJson<GeminiGenerateContentResponse>(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          timeout: 120_000 // 2 minutes (120,000ms) for AI generation
        })

        const duration = Date.now() - startTime

        // Log raw response from Gemini API
        try {
          const rawResponseStr = typeof response === 'object' ? JSON.stringify(response, null, 2) : String(response)
          await this.logger?.info?.(`[Gemini Translator] 📦 RAW Response từ Gemini API (${duration}ms):\n${rawResponseStr}`)
        } catch {
          await this.logger?.info?.(`[Gemini Translator] 📦 RAW Response từ Gemini API (${duration}ms):`, response)
        }

        if (response.error) {
          const isRateLimit = response.error.code === 429 || response.error.status === 'RESOURCE_EXHAUSTED'
          if (isRateLimit && attempt < maxRetries) {
            const backoffMs = attempt * 2000
            await this.logger?.warn?.(
              `[Gemini Translator] Rate Limit (429). Đang thử lại lượt ${attempt}/${maxRetries} sau ${backoffMs}ms...`
            )
            await sleep(backoffMs)
            continue
          }
          throw new Error(`Gemini API Lỗi (${response.error.code || 'UNKNOWN'}): ${response.error.message}`)
        }

        const rawText = extractTextFromResponse(response)
        await this.logger?.info?.(`[Gemini Translator] 📄 RAW Content Text từ Candidate:\n${rawText}`)

        const translations = parseTranslationsFromText(rawText, paragraphs.length)

        await this.logger?.info?.(
          `[Gemini Translator] 📥 Nhận phản hồi API thành công (${duration}ms, phân tích được ${translations.length}/${paragraphs.length} đoạn)`
        )

        if (translations.length !== paragraphs.length) {
          await this.logger?.warn?.(
            `[Gemini Translator] Số lượng đoạn trả về (${translations.length}) khác với đầu vào (${paragraphs.length}). Đang tự động cân chỉnh danh sách...`
          )
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
        const duration = Date.now() - startTime
        lastError = err instanceof Error ? err : new Error(String(err))
        const errorMsg = lastError.message

        await this.logger?.error?.(
          `[Gemini Translator] ❌ Lỗi RAW khi gọi API (${duration}ms, Model: ${model}): ${errorMsg}`,
          err
        )

        const isTransient =
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('503') ||
          errorMsg.includes('500')

        if (isTransient && attempt < maxRetries) {
          const backoffMs = attempt * 2000
          await this.logger?.warn?.(
            `[Gemini Translator] Gọi API tạm thời thất bại (${duration}ms, lượt ${attempt}/${maxRetries}): ${errorMsg}. Đang thử lại sau ${backoffMs}ms...`
          )
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
        message: 'Chưa tìm thấy Google Gemini API Key. Vui lòng nhập API Key và nhấn "Lưu cài đặt" trước khi kiểm tra.'
      }
    }

    const rawKey = config.apiKey.trim()
    const maskedKey = rawKey.length > 10 ? `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}` : `${rawKey.slice(0, 3)}...`
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
          message: `Kết nối Gemini API thành công!\n• API Key: ${maskedKey}\n• Model: ${config.model || DEFAULT_MODEL}\n• Ngôn ngữ đích: ${targetLang}\n• Bản dịch mẫu (${sourceLang} -> ${targetLang}): "${results[0]}"`
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
