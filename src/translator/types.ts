export type NovelTranslationStyle =
  | 'tienhiep_kiemhiep'
  | 'ngontinh'
  | 'huyenhuyen_phuongtay'
  | 'tieuthuyet_chung'
  | 'accurate'

export interface GeminiConfig {
  apiKey?: string
  model?: string
  targetLang?: string
  style?: NovelTranslationStyle | string
  temperature?: number
  batchSize?: number
  glossary?: string
  customPrompt?: string
}

export interface GlossaryItem {
  source: string
  target: string
}

export interface GeminiPart {
  text?: string
}

export interface GeminiContent {
  role?: 'user' | 'model' | 'system'
  parts: GeminiPart[]
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[]
  systemInstruction?: {
    parts: GeminiPart[]
  }
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    responseMimeType?: string
    responseSchema?: Record<string, unknown>
  }
  safetySettings?: Array<{
    category: string
    threshold: string
  }>
}

export interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[]
    role?: string
  }
  finishReason?: string
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[]
  error?: {
    code?: number
    message?: string
    status?: string
  }
}
