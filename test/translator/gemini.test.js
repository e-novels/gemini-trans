'use strict'

const assert = require('node:assert/strict')
const { parseGlossary, getStyleInstruction, buildSystemInstruction, buildGeminiRequestBody } = require('../../dist/index.js')
const { extractTextFromResponse, parseTranslationsFromText, GeminiClient } = require('../../dist/index.js')
const { isNonTranslatableParagraph, BatchProcessor } = require('../../dist/index.js')

module.exports = async function runGeminiUnitTests() {
  console.log('  Running Gemini Translator Unit Tests...')

  // 1. Prompt Builder & Glossary Tests
  const glossaryRaw = `
    # Bảng nhân vật
    Tiêu Viêm: Tiêu Viêm
    Dược Lão = Dược Lão
    Dou Qi -> Đấu Khí
    Yun Lan Sect => Vân Lam Tông
    // Bình luận bỏ qua
  `
  const glossary = parseGlossary(glossaryRaw)
  assert.equal(glossary.length, 4)
  assert.deepEqual(glossary[0], { source: 'Tiêu Viêm', target: 'Tiêu Viêm' })
  assert.deepEqual(glossary[1], { source: 'Dược Lão', target: 'Dược Lão' })
  assert.deepEqual(glossary[2], { source: 'Dou Qi', target: 'Đấu Khí' })
  assert.deepEqual(glossary[3], { source: 'Yun Lan Sect', target: 'Vân Lam Tông' })

  const sysInst = buildSystemInstruction({
    sourceLang: 'zh',
    targetLang: 'vi',
    style: 'tienhiep_kiemhiep',
    glossary: glossaryRaw,
    customPrompt: 'Lưu ý xưng hô huynh muội'
  })
  assert.ok(sysInst.includes('Tiếng Trung'))
  assert.ok(sysInst.includes('Tiếng Việt'))
  assert.ok(sysInst.includes('TIÊN HIỆP / KIẾM HIỆP'))
  assert.ok(sysInst.includes('BẢNG THUẬT NGỮ BẮT BUỘC'))
  assert.ok(sysInst.includes('Vân Lam Tông'))
  assert.ok(sysInst.includes('Lưu ý xưng hô huynh muội'))

  const reqBody = buildGeminiRequestBody(['Đoạn 1', 'Đoạn 2'], {
    sourceLang: 'en',
    targetLang: 'vi',
    temperature: 0.2
  })
  assert.equal(reqBody.generationConfig.temperature, 0.2)
  assert.equal(reqBody.generationConfig.responseMimeType, 'application/json')
  assert.ok(reqBody.generationConfig.responseSchema.properties.translations)

  // 2. Gemini Response Parsing Tests
  const mockCandidate = {
    candidates: [
      {
        content: {
          parts: [{ text: '{"translations": ["Dịch đoạn 1", "Dịch đoạn 2"]}' }]
        }
      }
    ]
  }
  const extracted = extractTextFromResponse(mockCandidate)
  assert.equal(extracted, '{"translations": ["Dịch đoạn 1", "Dịch đoạn 2"]}')

  const parsedJson = parseTranslationsFromText(extracted, 2)
  assert.deepEqual(parsedJson, ['Dịch đoạn 1', 'Dịch đoạn 2'])

  const markdownJson = '```json\n{"translations": ["Câu A", "Câu B"]}\n```'
  const parsedMarkdown = parseTranslationsFromText(markdownJson, 2)
  assert.deepEqual(parsedMarkdown, ['Câu A', 'Câu B'])

  // Fallback text parsing
  const plainText = 'Dòng 1\nDòng 2\nDòng 3'
  const parsedPlainText = parseTranslationsFromText(plainText, 3)
  assert.deepEqual(parsedPlainText, ['Dòng 1', 'Dòng 2', 'Dòng 3'])

  // 3. Non-translatable Paragraphs
  assert.equal(isNonTranslatableParagraph(''), true)
  assert.equal(isNonTranslatableParagraph('   \n  '), true)
  assert.equal(isNonTranslatableParagraph('@{img:https://example.com/cover.jpg}'), true)
  assert.equal(isNonTranslatableParagraph('!{page:2}'), true)
  assert.equal(isNonTranslatableParagraph('***'), true)
  assert.equal(isNonTranslatableParagraph('---'), true)
  assert.equal(isNonTranslatableParagraph('Đây là một đoạn văn cần dịch.'), false)

  // 4. GeminiClient with Mock Network and Target Language
  let fetchCount = 0
  let lastTargetLangInPrompt = ''
  let lastFetchOptions = null
  const mockNetwork = {
    fetchJson: async (url, options) => {
      fetchCount++
      lastFetchOptions = options
      const body = JSON.parse(options.body)
      const promptText = body.contents[0].parts[0].text
      lastTargetLangInPrompt = promptText
      const paragraphs = JSON.parse(promptText.split('\n\n')[1]).paragraphs
      return {
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ translations: paragraphs.map(p => `[Dịch] ${p}`) }) }]
            }
          }
        ]
      }
    },
    fetchText: async () => '',
    fetchDataUrl: async () => ''
  }

  const client = new GeminiClient({
    network: mockNetwork,
    logger: { info: async () => {}, warn: async () => {}, error: async () => {} }
  })

  const translations = await client.translateChunk(['Hello', 'World'], {
    apiKey: 'mock-test-key-123',
    model: 'gemini-2.5-flash',
    targetLang: 'en'
  }, { sourceLang: 'vi' })

  assert.deepEqual(translations, ['[Dịch] Hello', '[Dịch] World'])
  assert.equal(fetchCount, 1)
  assert.equal(lastFetchOptions?.timeout, 120_000, 'fetchJson options should specify a 120_000ms (2 minutes) timeout')
  assert.ok(lastTargetLangInPrompt.includes('Tiếng Anh'))

  // 5. Test connection with custom targetLang
  const testConnSuccess = await client.testConnection({
    apiKey: 'mock-test-key-123',
    model: 'gemini-2.5-flash',
    targetLang: 'en'
  })
  assert.equal(testConnSuccess.success, true)
  assert.ok(testConnSuccess.message.includes('Kết nối Gemini API thành công'))
  assert.ok(testConnSuccess.message.includes('Ngôn ngữ đích: en'))

  const testConnFail = await client.testConnection({ apiKey: '' })
  assert.equal(testConnFail.success, false)

  // 6. BatchProcessor with Full Chapter Mode (batchSize = 0)
  const fullChapterReports = []
  const batchProcessor = new BatchProcessor({
    client,
    progress: {
      report: async data => {
        fullChapterReports.push(data)
      }
    },
    logger: { info: async () => {}, warn: async () => {}, error: async () => {} }
  })

  const testChapter = [
    'Đoạn văn 1 mở đầu.',
    '@{img:https://example.com/illustration1.png}',
    '',
    'Đoạn văn 2 tiếp tục câu chuyện.',
    '***',
    'Đoạn văn 3 kết thúc chương.'
  ]

  // Full chapter 1-call mode
  fetchCount = 0
  const processedFull = await batchProcessor.processParagraphs(testChapter, {
    apiKey: 'mock-test-key-123',
    batchSize: 0
  }, { sourceLang: 'zh', targetLang: 'vi' })

  assert.equal(fetchCount, 1, 'Full chapter translation should only make 1 API call')
  assert.equal(processedFull.length, 6)
  assert.equal(processedFull[0], '[Dịch] Đoạn văn 1 mở đầu.')
  assert.equal(processedFull[1], '@{img:https://example.com/illustration1.png}')
  assert.equal(processedFull[2], '')
  assert.equal(processedFull[3], '[Dịch] Đoạn văn 2 tiếp tục câu chuyện.')
  assert.equal(processedFull[4], '***')
  assert.equal(processedFull[5], '[Dịch] Đoạn văn 3 kết thúc chương.')

  // Chunked batch mode (batchSize = 2)
  fetchCount = 0
  const processedChunked = await batchProcessor.processParagraphs(testChapter, {
    apiKey: 'mock-test-key-123',
    batchSize: 2
  }, { sourceLang: 'zh', targetLang: 'vi' })

  assert.equal(processedChunked.length, 6)
  assert.equal(processedChunked[0], '[Dịch] Đoạn văn 1 mở đầu.')
  assert.equal(processedChunked[3], '[Dịch] Đoạn văn 2 tiếp tục câu chuyện.')
  assert.equal(processedChunked[5], '[Dịch] Đoạn văn 3 kết thúc chương.')
  assert.equal(fetchCount, 2, 'Batch of 3 items with batchSize 2 should make 2 calls')

  console.log('  [PASS] All Gemini Translator Unit Tests passed successfully.')
}
