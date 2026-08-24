import { GeminiGenerateContentRequest, GlossaryItem, NovelTranslationStyle } from './types'

const LANGUAGE_NAMES: Record<string, string> = {
  auto: 'ngôn ngữ nguồn tự động',
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh (English)',
  zh: 'Tiếng Trung (Chinese)',
  ja: 'Tiếng Nhật (Japanese)',
  ko: 'Tiếng Hàn (Korean)',
  fr: 'Tiếng Pháp (French)',
  de: 'Tiếng Đức (German)',
  ru: 'Tiếng Nga (Russian)',
  es: 'Tiếng Tây Ban Nha (Spanish)',
  th: 'Tiếng Thái (Thai)'
}

export function parseGlossary(glossaryText?: string): GlossaryItem[] {
  if (!glossaryText || typeof glossaryText !== 'string') return []

  const items: GlossaryItem[] = []
  const lines = glossaryText.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue
    }

    // Support separators: "=>", "->", "=", ":"
    let separator = ''
    if (trimmed.includes('=>')) separator = '=>'
    else if (trimmed.includes('->')) separator = '->'
    else if (trimmed.includes('=')) separator = '='
    else if (trimmed.includes(':')) separator = ':'

    if (separator) {
      const parts = trimmed.split(separator)
      const source = parts[0]?.trim()
      const target = parts.slice(1).join(separator).trim()
      if (source && target) {
        items.push({ source, target })
      }
    }
  }

  return items
}

export function getStyleInstruction(style?: NovelTranslationStyle | string): string {
  switch (style) {
    case 'tienhiep_kiemhiep':
      return `Phong cách: TIÊN HIỆP / KIẾM HIỆP CỔ TRANG.
- Sử dụng từ ngữ Hán Việt chuẩn mực, đúng sắc thái văn phong kiếm hiệp/tiên hiệp.
- Đại từ nhân xưng chuẩn cổ trang (ta, ngươi, huynh, muội, tiền bối, vãn bối, sư phụ, đồ nhi, chưởng môn, chư vị...).
- Giữ chuẩn tên chiêu thức, bí tịch, đan dược, pháp bảo, cảnh giới tu vi (Luyện Khí, Trúc Cơ, Kim Đan, Nguyên Anh...).`

    case 'ngontinh':
      return `Phong cách: NGÔN TÌNH / HIỆN ĐẠI.
- Câu văn mượt mà, giàu cảm xúc, chuyển ngữ tự nhiên.
- Xưng hô phù hợp với lứa tuổi và mối quan hệ (anh, em, cậu, tớ, tôi, anh ấy, cô ấy...).
- Lời thoại chân thật, gần gũi với đời sống hiện đại.`

    case 'huyenhuyen_phuongtay':
      return `Phong cách: HUYỀN HUYỄN / FANTASY PHƯƠNG TÂY.
- Chuẩn văn phong ma pháp, hiệp sĩ, thần thoại phương Tây.
- Dịch chuẩn tên ma pháp, cấp bậc mạo hiểm giả, quái vật, thần khí, danh hiệu quý tộc.`

    case 'accurate':
      return `Phong cách: CHÍNH XÁC / SÁT NGHĨA.
- Bám sát cấu trúc ngữ pháp và từ vựng của bản gốc.
- Không tự ý thêm thắt hoặc diễn giải phóng tác quá mức.`

    case 'tieuthuyet_chung':
    default:
      return `Phong cách: TIỂU THUYẾT VĂN HỌC CHUNG.
- Văn phong thuần Việt trong sáng, mượt mà, lưu loát, giàu hình ảnh.
- Đại từ nhân xưng và hội thoại linh hoạt, phù hợp ngữ cảnh câu chuyện.`
  }
}

export function buildSystemInstruction(options: {
  sourceLang?: string
  targetLang?: string
  style?: NovelTranslationStyle | string
  glossary?: string
  customPrompt?: string
}): string {
  const sourceName = LANGUAGE_NAMES[options.sourceLang || 'auto'] || options.sourceLang || 'tự động'
  const targetName = LANGUAGE_NAMES[options.targetLang || 'vi'] || options.targetLang || 'Tiếng Việt'
  const styleInstruction = getStyleInstruction(options.style)
  const glossaryItems = parseGlossary(options.glossary)

  let glossarySection = ''
  if (glossaryItems.length > 0) {
    glossarySection = `\nBẢNG THUẬT NGỮ BẮT BUỘC (GLOSSARY):\nKhi gặp các từ hoặc cụm từ sau, BẮT BUỘC dịch chính xác theo quy định:\n${glossaryItems
      .map(item => `- "${item.source}" => "${item.target}"`)
      .join('\n')}\n`
  }

  let customPromptSection = ''
  if (options.customPrompt && options.customPrompt.trim()) {
    customPromptSection = `\nCHỈ DẪN BỔ SUNG TỪ NGƯỜI DÙNG:\n${options.customPrompt.trim()}\n`
  }

  return `Bạn là một dịch giả chuyên nghiệp hàng đầu thế giới về tiểu thuyết, truyện chữ và light novel, có khả năng chuyển ngữ xuất sắc từ ${sourceName} sang ${targetName}.

MỤC TIÊU VÀ NGUYÊN TẮC DỊCH THUẬT:
1. Độ chính xác & Văn phong: Dịch chính xác nghĩa gốc nhưng diễn đạt mượt mà, tự nhiên, đúng giọng điệu tiểu thuyết, không dịch máy móc kiểu "word-by-word".
2. ${styleInstruction}
3. BẢO TOÀN THẺ ĐẶC BIỆT & ĐỊNH DẠNG:
   - Tuyệt đối giữ nguyên không thay đổi các mã thẻ định dạng đặc biệt nếu có trong văn bản: ví dụ @{img:...}, @{page:...}, !{...}, các thẻ HTML như <br>, <b>, <i>...
   - Giữ nguyên các ký hiệu phân cách cảnh truyện như ***, ---, ###, v.v.
   - Giữ nguyên dấu ngoặc kép hoặc ký hiệu thoại ("...", “...”, 「...」).
4. ÁNH XẠ 1-1 CHÍNH XÁC:
   - Đầu vào là một danh sách các đoạn văn (paragraphs).
   - Đầu ra BẮT BUỘC phải là một mảng chuỗi (JSON array) trong trường "translations", với số lượng phần tử CHÍNH XÁC bằng số lượng đoạn văn đầu vào.
   - Mỗi đoạn văn dịch tương ứng đúng vị trí chỉ số (index) với đoạn văn gốc.${glossarySection}${customPromptSection}

Định dạng trả về: JSON Object tuân thủ schema {"translations": ["đoạn 1 dịch", "đoạn 2 dịch", ...]}.`
}

export function buildGeminiRequestBody(
  paragraphs: string[],
  options: {
    sourceLang?: string
    targetLang?: string
    style?: NovelTranslationStyle | string
    temperature?: number
    glossary?: string
    customPrompt?: string
  }
): GeminiGenerateContentRequest {
  const systemInstructionText = buildSystemInstruction(options)

  const userPrompt = `Hãy dịch ${paragraphs.length} đoạn văn sau đây sang ${
    LANGUAGE_NAMES[options.targetLang || 'vi'] || options.targetLang || 'Tiếng Việt'
  }:\n\n${JSON.stringify({ paragraphs }, null, 2)}`

  return {
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature: typeof options.temperature === 'number' ? Math.max(0, Math.min(1, options.temperature)) : 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          translations: {
            type: 'ARRAY',
            description: 'Danh sách các đoạn văn đã được dịch theo đúng thứ tự và số lượng 1-1 với đầu vào',
            items: {
              type: 'STRING'
            }
          }
        },
        required: ['translations']
      }
    }
  }
}
