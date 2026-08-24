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

    const batchSize = Math.max(5, Math.min(100, config.batchSize || 25))
    const totalCount = paragraphs.length

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

    const totalBatches = Math.ceil(translatableParagraphs.length / batchSize)
    await this.logger?.info?.(
      `Bắt đầu dịch ${translatableParagraphs.length}/${totalCount} đoạn văn (chia thành ${totalBatches} mẻ, kích thước mẻ: ${batchSize})...`
    )

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, translatableParagraphs.length)
      const currentBatch = translatableParagraphs.slice(start, end)
      const currentIndices = translatableIndices.slice(start, end)

      const percentage = Math.round(((batchIndex) / totalBatches) * 100)
      await this.progress?.report?.({
        message: `Đang dịch mẻ ${batchIndex + 1}/${totalBatches} (${currentBatch.length} đoạn)...`,
        percentage
      })

      const translatedBatch = await this.client.translateChunk(currentBatch, config, options)

      for (let i = 0; i < currentIndices.length; i++) {
        const originalIndex = currentIndices[i]
        finalResults[originalIndex] = translatedBatch[i] || currentBatch[i]
      }
    }

    await this.progress?.report?.({
      message: 'Hoàn tất dịch toàn bộ chương!',
      percentage: 100
    })

    return finalResults
  }
}
