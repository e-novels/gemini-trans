import { GeminiClient } from './geminiClient'
import { GeminiConfig } from './types'

export interface BatchProcessorOptions {
  client: GeminiClient
  progress?: ExtensionProgressApi
  logger?: {
    info(...values: unknown[]): Promise<void>
    warn(...values: unknown[]): Promise<void>
    error(...values: unknown[]): Promise<void>
  }
}

export function isNonTranslatableParagraph(paragraph: string): boolean {
  if (!paragraph || !paragraph.trim()) {
    return true
  }
  const trimmed = paragraph.trim()
  // Media tags, page breaks, system tokens
  if (
    trimmed.startsWith('@{') ||
    trimmed.startsWith('!{') ||
    /^\[image:[^\]]+\]$/i.test(trimmed) ||
    /^(?:\*{3,}|-{3,}|_{3,}|#{3,})$/.test(trimmed)
  ) {
    return true
  }
  return false
}

export class BatchProcessor {
  private client: GeminiClient
  private progress?: ExtensionProgressApi
  private logger?: BatchProcessorOptions['logger']

  constructor(options: BatchProcessorOptions) {
    this.client = options.client
    this.progress = options.progress
    this.logger = options.logger
  }

  async processParagraphs(
    paragraphs: string[],
    config: GeminiConfig,
    options: { sourceLang?: string; targetLang?: string }
  ): Promise<string[]> {
    if (!paragraphs || paragraphs.length === 0) {
      return []
    }

    const totalCount = paragraphs.length
    const sourceLang = options.sourceLang || 'auto'
    const targetLang = options.targetLang || config.targetLang || 'vi'

    // Identify which paragraphs need translation vs which are kept as-is
    const translatableIndices: number[] = []
    const translatableParagraphs: string[] = []
    const finalResults: string[] = new Array(totalCount)

    for (let i = 0; i < totalCount; i++) {
      const p = paragraphs[i]
      if (isNonTranslatableParagraph(p)) {
        finalResults[i] = p
      } else {
        translatableIndices.push(i)
        translatableParagraphs.push(p)
      }
    }

    if (translatableParagraphs.length === 0) {
      return finalResults
    }

    // Default or batchSize = 0: Translate all paragraphs in a single request to preserve 100% full chapter context
    const configuredBatchSize = typeof config.batchSize === 'number' ? config.batchSize : 0
    const isSingleCall = configuredBatchSize === 0 || configuredBatchSize >= translatableParagraphs.length

    if (isSingleCall) {
      await this.logger?.info?.(
        `[Gemini Translator] Đang dịch trọn vẹn toàn bộ ${translatableParagraphs.length}/${totalCount} đoạn văn trong 1 lượt (giữ 100% ngữ cảnh nhân vật & mạch truyện) [${sourceLang} ➔ ${targetLang}] (Model: ${config.model || 'gemini-2.5-flash'}, Style: ${config.style || 'tienhiep_kiemhiep'})...`
      )

      await this.progress?.report?.({
        message: `[${sourceLang} ➔ ${targetLang}] Đang dịch toàn bộ ${translatableParagraphs.length} đoạn văn...`,
        percentage: 30
      })

      const translated = await this.client.translateChunk(translatableParagraphs, config, {
        sourceLang,
        targetLang
      })

      for (let i = 0; i < translatableIndices.length; i++) {
        const originalIndex = translatableIndices[i]
        finalResults[originalIndex] = translated[i] || translatableParagraphs[i]
      }

      await this.progress?.report?.({
        message: `Hoàn tất dịch [${sourceLang} ➔ ${targetLang}] toàn bộ chương!`,
        percentage: 100
      })

      return finalResults
    }

    // Otherwise split by configured batchSize (when user explicitly sets batchSize > 0)
    const batchSize = Math.max(1, configuredBatchSize)
    const totalBatches = Math.ceil(translatableParagraphs.length / batchSize)
    await this.logger?.info?.(
      `[Gemini Translator] Đang dịch ${translatableParagraphs.length}/${totalCount} đoạn văn [${sourceLang} ➔ ${targetLang}] (chia làm ${totalBatches} mẻ, kích thước: ${batchSize})...`
    )

    let previousContext = ''
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, translatableParagraphs.length)
      const currentBatch = translatableParagraphs.slice(start, end)
      const currentIndices = translatableIndices.slice(start, end)

      const percentage = Math.round(((batchIndex) / totalBatches) * 100)
      await this.progress?.report?.({
        message: `[${sourceLang} ➔ ${targetLang}] Đang dịch mẻ ${batchIndex + 1}/${totalBatches} (${currentBatch.length} đoạn)...`,
        percentage
      })

      // Include previous translated context into prompt if available to avoid losing continuity
      const customPromptWithContext = previousContext
        ? `${config.customPrompt ? config.customPrompt + '\n\n' : ''}NGỮ CẢNH CÁC ĐOẠN VĂN TRƯỚC VỪA DỊCH (để giữ đúng đại từ xưng hô và mạch truyện):\n${previousContext}`
        : config.customPrompt

      const translatedBatch = await this.client.translateChunk(currentBatch, {
        ...config,
        customPrompt: customPromptWithContext
      }, {
        sourceLang,
        targetLang
      })

      for (let i = 0; i < currentIndices.length; i++) {
        const originalIndex = currentIndices[i]
        const translatedText = translatedBatch[i] || currentBatch[i]
        finalResults[originalIndex] = translatedText
      }

      // Save last 2-3 sentences as context for the next batch
      previousContext = translatedBatch.slice(-3).join('\n')
    }

    await this.progress?.report?.({
      message: `Hoàn tất dịch [${sourceLang} ➔ ${targetLang}] toàn bộ chương!`,
      percentage: 100
    })

    return finalResults
  }
}
