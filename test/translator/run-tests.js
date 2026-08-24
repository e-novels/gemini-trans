'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const runTranslatorContractTests = require('./contract.test')
const runGeminiUnitTests = require('./gemini.test')

module.exports = async function runTranslatorTests(root, manifest) {
  assert.equal(manifest.icon, './public/icon.png')
  assert.ok(manifest.permissions.includes('translate'))
  assert.ok(manifest.permissions.includes('network'))
  assert.ok(manifest.permissions.includes('storage'))
  assert.equal(manifest.contributes?.scraper, undefined)
  assert.ok(manifest.contributes?.translator !== undefined)
  assert.ok(manifest.contributes?.settings !== undefined)

  async function smokeBundle(filename) {
    const entryPath = path.join(root, 'dist', filename)
    assert.ok(fs.existsSync(entryPath), `${filename} must be built before testing`)
    delete require.cache[require.resolve(entryPath)]
    const extension = require(entryPath)
    const logs = []
    let registeredTranslator = null
    let registeredSettings = null
    const storageStore = new Map()

    await extension.activate({
      version: '1.0.0',
      extension: { id: manifest.name },
      logger: {
        info: async value => logs.push(value),
        warn: async value => logs.push(value),
        error: async value => logs.push(value)
      },
      scraper: { register: async () => { throw new Error('Translator profile must not register a scraper.') } },
      settings: {
        register: async handlers => {
          registeredSettings = handlers
        }
      },
      storage: {
        get: async key => storageStore.get(key) || null,
        set: async (key, val) => { storageStore.set(key, val) },
        remove: async key => { storageStore.delete(key) },
        createAssetUrl: async () => null
      },
      network: {
        fetchJson: async (url, options) => {
          const body = JSON.parse(options.body)
          const promptText = body.contents[0].parts[0].text
          const paragraphs = JSON.parse(promptText.split('\n\n')[1]).paragraphs
          return {
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ translations: paragraphs.map(p => `[Gemini Dịch] ${p}`) }) }]
                }
              }
            ]
          }
        },
        fetchText: async () => '',
        fetchDataUrl: async () => ''
      },
      translator: {
        register: async handlers => {
          registeredTranslator = handlers
        }
      }
    })

    assert.ok(registeredTranslator !== null, 'Translator handlers should be registered')
    assert.equal(typeof registeredTranslator.translate, 'function')

    const getLanguagesRes = await registeredTranslator.getLanguages()
    assert.ok(getLanguagesRes.targetLanguages.includes('vi'))
    assert.ok(getLanguagesRes.targetLanguages.includes('en'))

    // 1. Test Mock fallback when no API key is in storage
    const translateMockRes = await registeredTranslator.translate({
      paragraphs: ['Hello world', 'Second paragraph']
    })
    assert.equal(translateMockRes.translatedParagraphs.length, 2)
    assert.equal(translateMockRes.translatedParagraphs[0], '[AI Translated] Hello world')

    // 2. Test Gemini translation when API key is configured
    storageStore.set('apiKey', 'AIzaSyFakeTestKey12345')
    storageStore.set('model', 'gemini-2.5-flash')
    storageStore.set('targetLang', 'vi')
    storageStore.set('style', 'tienhiep_kiemhiep')

    const translateGeminiRes = await registeredTranslator.translate({
      paragraphs: ['Tiêu Viêm mở to hai mắt', 'Luyện Dược Sư truyền kỳ'],
      sourceLang: 'zh',
      targetLang: 'vi'
    })
    assert.equal(translateGeminiRes.translatedParagraphs.length, 2)
    assert.equal(translateGeminiRes.translatedParagraphs[0], '[Gemini Dịch] Tiêu Viêm mở to hai mắt')
    assert.equal(translateGeminiRes.translatedParagraphs[1], '[Gemini Dịch] Luyện Dược Sư truyền kỳ')

    // 3. Test Settings Action testConnection
    assert.ok(registeredSettings !== null, 'Settings handlers should be registered')
    assert.equal(typeof registeredSettings.testConnection, 'function')
    const testConnRes = await registeredSettings.testConnection({
      apiKey: 'AIzaSyFakeTestKey12345',
      model: 'gemini-2.5-flash',
      targetLang: 'vi'
    })
    assert.equal(testConnRes.success, true)
    assert.ok(testConnRes.message.includes('Kết nối Gemini API thành công'))

    await runTranslatorContractTests(root, manifest, registeredTranslator)
    await extension.deactivate()
  }

  try {
    await Promise.all([smokeBundle('index.js'), smokeBundle('browser.js')])
    await runGeminiUnitTests()
    console.log(`[${manifest.displayName}] Gemini Translator profile tests passed`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
