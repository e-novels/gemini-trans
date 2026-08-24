# e-novels Translator Extension Guide

A Translator extension enables automatic AI/machine translation of chapter paragraphs when the user enables translation mode in the application.

## 1. Manifest Declaration (`extension.json`)

A standard Translator extension must declare the `translate` permission and contribute a `contributes.translator` block:

```json
{
  "name": "my-translator",
  "displayName": "My AI Translator",
  "publisher": "my-publisher",
  "version": "1.0.0",
  "starter": {
    "kind": "translator"
  },
  "engines": {
    "enovel": ">=1.0.0"
  },
  "main": "./dist/index.js",
  "browser": "./dist/browser.js",
  "activationEvents": ["always"],
  "categories": ["AI", "Translator"],
  "permissions": ["translate", "network", "storage"],
  "network": {
    "allowedHosts": ["api.example.com"]
  },
  "contributes": {
    "translator": {
      "name": "My AI Translator",
      "description": "Automatic AI chapter translation engine",
      "capabilities": ["translate", "getLanguages"],
      "sourceLanguages": ["auto", "en", "zh", "ja", "ko"],
      "targetLanguages": ["en", "vi"]
    }
  }
}
```

### Key Rules:
1. **Permissions**: Request permission `"translate"`. If making external network requests, request `"network"` and list endpoints in `"network.allowedHosts"`.
2. **Single Active Constraint**: e-novels allows **only one active translator extension at a time**. Activating a new translator extension automatically deactivates any previously active translator extension.

## 2. Entry Point Implementation (`src/index.ts`)

Register the translator handler using `novel.translator.register`:

```ts
export function activate(novel: NovelExtensionApi) {
  novel.translator.register({
    getLanguages: () => ({
      sourceLanguages: ['auto', 'en', 'zh', 'ja', 'ko'],
      targetLanguages: ['en', 'vi']
    }),
    translate: async (request) => {
      const { paragraphs, targetLang = 'en' } = request

      // Perform batch translation
      const translatedParagraphs = paragraphs.map(p => `[AI Translated] ${p}`)

      return { translatedParagraphs }
    }
  })
}
```

## 3. Request Format & Response Contract

- **`translate(request)`**:
  - Input `request`: `{ paragraphs: string[], sourceLang?: string, targetLang?: string }`
  - Output `response`: `{ translatedParagraphs: string[] }` (array preserving the exact paragraph count and order).

## 4. Timeouts & External API Calls

- **Invocation Timeout**: The host allows up to **3 minutes (180,000 ms)** for each `translate` call.
- **Network Timeout**: The host proxy (`novel.network.fetchJson` / `fetchText`) has a default timeout of **10 seconds (10,000 ms)** per HTTP request. When calling external AI APIs (such as Gemini, OpenAI, Claude), you **must specify a longer timeout** in `ExtensionFetchOptions` (e.g. `timeout: 120_000` for 2 minutes) to prevent premature aborts:

```ts
const response = await novel.network.fetchJson<MyApiResponse>('https://api.example.com/translate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({ paragraphs, targetLang }),
  timeout: 120_000 // 120 seconds timeout for AI generation
})
```
