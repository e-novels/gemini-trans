'use strict'

function isObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function validateEntityId(value, path, issues) {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) return value
    issues.push(`"${path}" must be a positive integer, received: ${value}`)
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      const numeric = Number(trimmed)
      if (Number.isSafeInteger(numeric) && numeric > 0 && String(numeric) === trimmed) {
        return numeric
      }
      return trimmed
    }
    issues.push(`"${path}" must be a non-empty string or positive number`)
    return ''
  }
  issues.push(`"${path}" must be a non-empty string or number, received: ${typeof value}`)
  return ''
}

function validateNumber(value, path, issues, options = {}) {
  const { min, integer = false, fallback } = options
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback
    issues.push(`"${path}" is required and must be a number`)
    return 0
  }
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    issues.push(`"${path}" must be a valid number, received: ${JSON.stringify(value)}`)
    return fallback !== undefined ? fallback : 0
  }
  if (integer && !Number.isInteger(numeric)) {
    issues.push(`"${path}" must be an integer, received: ${numeric}`)
  }
  if (min !== undefined && numeric < min) {
    issues.push(`"${path}" must be >= ${min}, received: ${numeric}`)
  }
  return numeric
}

function validateString(value, path, issues, options = {}) {
  const { required = true, maxLength = 100000, fallback = '' } = options
  if (value === undefined || value === null) {
    if (required) {
      issues.push(`"${path}" is required and must be a non-empty string`)
    }
    return fallback
  }
  const str = String(value).trim()
  if (required && str.length === 0) {
    issues.push(`"${path}" must not be empty`)
  }
  if (maxLength !== undefined && str.length > maxLength) {
    issues.push(`"${path}" exceeds maximum length of ${maxLength} characters`)
  }
  return str
}

function validateStringArray(value, path, issues, options = {}) {
  const { minItems = 0, allowEmptyStrings = false } = options
  if (!Array.isArray(value)) {
    issues.push(`"${path}" must be an array of strings, received: ${typeof value}`)
    return []
  }
  const result = []
  for (let idx = 0; idx < value.length; idx++) {
    const item = value[idx]
    if (typeof item !== 'string' && typeof item !== 'number') {
      issues.push(`"${path}[${idx}]" must be a string, received: ${typeof item}`)
      continue
    }
    const str = String(item).trim()
    if (!allowEmptyStrings && str.length === 0) {
      continue
    }
    result.push(str)
  }
  if (result.length < minItems) {
    issues.push(`"${path}" must contain at least ${minItems} non-empty item(s)`)
  }
  return result
}

function validateSearchContract(rawData, issues) {
  if (!isObject(rawData)) {
    issues.push('Search response must be an object')
    return
  }
  if (!Array.isArray(rawData.items)) {
    issues.push('Search response "items" must be an array')
  } else {
    rawData.items.forEach((item, index) => {
      if (!isObject(item)) {
        issues.push(`items[${index}] must be an object`)
      } else {
        validateString(item.book_name, `items[${index}].book_name`, issues, { required: true })
        if (item.authors !== undefined && !Array.isArray(item.authors)) {
          issues.push(`items[${index}].authors must be an array`)
        }
      }
    })
  }
  if (!isObject(rawData.pagination)) {
    issues.push('Search response "pagination" must be an object')
  } else {
    validateNumber(rawData.pagination.page, 'pagination.page', issues, { min: 1, integer: true })
    validateNumber(rawData.pagination.pageSize, 'pagination.pageSize', issues, { min: 1, integer: true })
    if (rawData.pagination.totalItems !== undefined) {
      validateNumber(rawData.pagination.totalItems, 'pagination.totalItems', issues, { min: 0, integer: true })
    }
    if (rawData.pagination.totalPages !== undefined) {
      validateNumber(rawData.pagination.totalPages, 'pagination.totalPages', issues, { min: 1, integer: true })
    }
  }
}

function validateBookDetailContract(rawData, issues) {
  if (!isObject(rawData)) {
    issues.push('BookDetail response must be an object')
    return
  }
  validateString(rawData.book_name, 'book_name', issues, { required: true })
  if (rawData.authors !== undefined && !Array.isArray(rawData.authors)) {
    issues.push('"authors" must be an array')
  }
  if (rawData.volumes !== undefined && !Array.isArray(rawData.volumes)) {
    issues.push('"volumes" must be an array')
  } else if (Array.isArray(rawData.volumes)) {
    rawData.volumes.forEach((vol, vIdx) => {
      if (!isObject(vol)) {
        issues.push(`volumes[${vIdx}] must be an object`)
      } else {
        validateString(vol.volume_name, `volumes[${vIdx}].volume_name`, issues, { required: true })
        if (vol.chapters !== undefined && !Array.isArray(vol.chapters)) {
          issues.push(`volumes[${vIdx}].chapters must be an array`)
        } else if (Array.isArray(vol.chapters)) {
          vol.chapters.forEach((chap, cIdx) => {
            if (!isObject(chap)) {
              issues.push(`volumes[${vIdx}].chapters[${cIdx}] must be an object`)
            } else {
              validateString(chap.chapter_name, `volumes[${vIdx}].chapters[${cIdx}].chapter_name`, issues, { required: true })
            }
          })
        }
      }
    })
  }
}

function validateChapterContract(rawData, issues) {
  if (!isObject(rawData)) {
    issues.push('Chapter response must be an object')
    return
  }
  validateString(rawData.chapter_name, 'chapter_name', issues, { required: true })
  if (!Array.isArray(rawData.content)) {
    issues.push('"content" must be an array of paragraph strings (string[])')
  } else if (rawData.content.length === 0) {
    issues.push('"content" array must not be empty')
  } else {
    validateStringArray(rawData.content, 'content', issues, { minItems: 1 })
  }
}

function validateDownloadContract(rawData, issues) {
  if (!isObject(rawData)) {
    issues.push('Download response must be an object containing book structure with chapter contents')
    return
  }
  validateEntityId(rawData.book_id, 'book_id', issues)
  validateString(rawData.book_name, 'book_name', issues, { required: true })

  if (!Array.isArray(rawData.volumes) || rawData.volumes.length === 0) {
    issues.push('Download response must contain a non-empty "volumes" array')
    return
  }

  for (let vIdx = 0; vIdx < rawData.volumes.length; vIdx++) {
    const vol = rawData.volumes[vIdx]
    if (!isObject(vol)) {
      issues.push(`volumes[${vIdx}] must be an object`)
      continue
    }
    validateEntityId(vol.volume_id, `volumes[${vIdx}].volume_id`, issues)
    validateString(vol.volume_name, `volumes[${vIdx}].volume_name`, issues, { required: true })
    if (!Array.isArray(vol.chapters) || vol.chapters.length === 0) {
      issues.push(`volumes[${vIdx}].chapters must be a non-empty array of chapters`)
      continue
    }
    for (let cIdx = 0; cIdx < vol.chapters.length; cIdx++) {
      const ch = vol.chapters[cIdx]
      if (!isObject(ch)) {
        issues.push(`volumes[${vIdx}].chapters[${cIdx}] must be an object`)
        continue
      }
      validateEntityId(ch.chapter_id, `volumes[${vIdx}].chapters[${cIdx}].chapter_id`, issues)
      validateString(ch.chapter_name, `volumes[${vIdx}].chapters[${cIdx}].chapter_name`, issues, { required: true })
      if (!Array.isArray(ch.content) || ch.content.length === 0) {
        issues.push(`volumes[${vIdx}].chapters[${cIdx}].content must be a non-empty array of strings`)
      } else {
        validateStringArray(ch.content, `volumes[${vIdx}].chapters[${cIdx}].content`, issues, { minItems: 1 })
      }
    }
  }
}

function validateTranslatorContract(method, rawData, expectedBatchCount, issues) {
  if (method === 'translate') {
    if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
      issues.push('Translator.translate response must be an object containing "translatedParagraphs"')
      return
    }
    if (!Array.isArray(rawData.translatedParagraphs)) {
      issues.push('Translator.translate response "translatedParagraphs" must be an array of strings')
      return
    }
    if (expectedBatchCount !== undefined && rawData.translatedParagraphs.length !== expectedBatchCount) {
      issues.push(
        `Translator.translate returned ${rawData.translatedParagraphs.length} paragraphs, expected exactly ${expectedBatchCount}`
      )
    }
    for (let i = 0; i < rawData.translatedParagraphs.length; i++) {
      if (typeof rawData.translatedParagraphs[i] !== 'string') {
        issues.push(`Translator.translate paragraph at index ${i} must be a string`)
      }
    }
  } else if (method === 'getLanguages') {
    if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
      issues.push('Translator.getLanguages response must be an object')
      return
    }
    if (!Array.isArray(rawData.sourceLanguages) || !rawData.sourceLanguages.every(l => typeof l === 'string')) {
      issues.push('Translator.getLanguages response "sourceLanguages" must be an array of strings')
    }
    if (!Array.isArray(rawData.targetLanguages) || !rawData.targetLanguages.every(l => typeof l === 'string')) {
      issues.push('Translator.getLanguages response "targetLanguages" must be an array of strings')
    }
  }
}

function validateTTSContract(method, rawData, issues) {
  if (method === 'getVoices') {
    if (!Array.isArray(rawData)) {
      issues.push('TTS.getVoices response must be an array of voice objects')
    } else {
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i]
        if (!isObject(item) || !item.id || !item.name) {
          issues.push(`TTS.getVoices[${i}] must contain "id" and "name" strings`)
        }
      }
    }
  } else if (method === 'synthesize') {
    if (!rawData) {
      issues.push('TTS.synthesize response must not be null or undefined')
    }
  }
}

function enforceContract(profile, method, rawData, options = {}) {
  const issues = []
  if (profile === 'scraper') {
    switch (method) {
      case 'search':
        validateSearchContract(rawData, issues)
        break
      case 'getBookDetail':
        validateBookDetailContract(rawData, issues)
        break
      case 'getChapter':
        validateChapterContract(rawData, issues)
        break
      case 'download':
        validateDownloadContract(rawData, issues)
        break
      default:
        break
    }
  } else if (profile === 'translator') {
    validateTranslatorContract(method, rawData, options.expectedBatchCount, issues)
  } else if (profile === 'tts') {
    validateTTSContract(method, rawData, issues)
  }

  if (issues.length > 0) {
    const err = new Error(
      `[Extension Contract Violation] Method "${method}" failed contract:\n${issues.map(i => `  • ${i}`).join('\n')}`
    )
    err.issues = issues
    throw err
  }
}

module.exports = {
  validateEntityId,
  validateNumber,
  validateString,
  validateStringArray,
  validateSearchContract,
  validateBookDetailContract,
  validateChapterContract,
  validateDownloadContract,
  validateTranslatorContract,
  validateTTSContract,
  enforceContract
}
