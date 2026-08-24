'use strict'

const assert = require('node:assert/strict')
const { enforceContract } = require('../contractValidator')

module.exports = async function runTranslatorContractTests(root, manifest, handlers) {
  console.log('  Running Translator Contract Enforcement Tests...')

  // 1. Positive Tests
  if (handlers) {
    if (typeof handlers.translate === 'function') {
      const res = await handlers.translate({ paragraphs: ['Hello'] })
      assert.doesNotThrow(() => {
        enforceContract('translator', 'translate', res, { expectedBatchCount: 1 })
      })
    }
  }

  // 2. Negative Contract Tests
  assert.throws(
    () => enforceContract('translator', 'translate', ''),
    /translate response must be an object containing "translatedParagraphs"/,
    'Translator.translate must reject string'
  )
  assert.throws(
    () => enforceContract('translator', 'translate', { invalid: true }),
    /response "translatedParagraphs" must be an array of strings/,
    'Translator.translate must reject objects without translatedParagraphs'
  )
  assert.throws(
    () => enforceContract('translator', 'translate', { translatedParagraphs: ['T1'] }, { expectedBatchCount: 2 }),
    /returned 1 paragraphs, expected exactly 2/,
    'Translator.translate must reject length mismatch'
  )

  console.log('  [PASS] All Translator Contract Enforcement Tests passed successfully.')
}
