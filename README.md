# E-Novel Extension Starter  
  
This folder is a self-contained TypeScript starter for one e-novels extension profile. It packages, type-checks, and runs fixture-backed tests without access to the host application source code. A built extension only communicates with the application through the `novel` object (`NovelExtensionApi`) passed to `activate`.  
  
The starter supports four profiles, and every build/test/package cycle targets exactly one of them:  
  
| Profile | What it does | Runtime |  
| --- | --- | --- |  
| `scraper` | Search, book detail, and chapter retrieval from a source site/API. | Electron only (network is mediated by the host). |  
| `theme` | A programmatic theme that sets reader UI variables. | Desktop and web. |  
| `translator` | Batch AI/machine translation of chapter paragraphs. | Desktop only (`novel.translator` is not exposed on web). |  
| `tts` | Text-to-speech voice provider (`process`, `cloud`, or `wasm` mode). | Depends on mode: `process` is Desktop Electron only (`novel.process` is not exposed on web); `cloud`/`wasm` also run on web. |  
  
The default profile is a scraper. It does not scrape a live website: it uses `example.com` and mocked API responses so you can verify the extension contract locally before connecting a source you are authorized to access.  
  
## Prerequisites  
  
- Node.js `20.19.0` or later  
- A e-novels installation compatible with the `enovel` version in `extension.json`  
  
## Quick Start  
  
```bash  
npm install  
  
# Pick ONE of the following, then run the shared build/test/package steps.  
  
# Scraper (requires --base-url)  
npm run init -- --name my-source --display-name "My Source" --publisher your-name --kind scraper --base-url https://books.example.org  
  
# Theme  
npm run init -- --name paper-theme --display-name "Paper Theme" --publisher your-name --kind theme  
  
# Translator  
npm run init -- --name my-translator --display-name "My AI Translator" --publisher your-name --kind translator  
  
# TTS (choose a mode: process | cloud | wasm)  
npm run init -- --name my-tts --display-name "My TTS Service" --publisher your-name --kind tts --tts-mode process  
  
npm test  
npm run test:package  
```  
  
`npm test` type-checks the extension, validates the selected profile, builds desktop and browser bundles, then invokes the matching profile through a mocked e-novels bridge. `npm run test:package` creates and verifies the ZIP named from `extension.json`.  
  
`npm run init` replaces the template manifest and, for a scraper, changes `BASE_URL` in `src/scraper/index.ts`. It does not infer a source API or HTML structure; update routes, mappers, and fixtures after initialization. The command refuses to replace a configured extension unless `--force` is provided.  
  
## Choose One Profile  
  
Set `starter.kind` in `extension.json` to exactly one value: `scraper`, `theme`, `translator`, or `tts`. `npm run validate` runs before every build and rejects invalid combinations:  
  
| Profile | Required permission(s) | Primary contribution | Forbidden contributions |  
| --- | --- | --- | --- |  
| `scraper` | `network`, `reader` | `contributes.scraper` | `themes`, `tts`, `translator` |  
| `theme` | `ui.theme` | Optional `contributes.themes` | `scraper`, `tts`, `translator`, and `network`/`reader` |  
| `translator` | `translate` (+ `network`, `storage` if calling an API) | `contributes.translator` | `scraper`, `themes`, `tts` |  
| `tts` | `tts` (+ `network` for `cloud`, `storage` for assets) | `contributes.tts` | `scraper`, `themes`, `translator` |  
  
Only one primary contribution among `scraper`, `themes`, `tts`, and `translator` may be declared. The entry point activates only the selected profile. Note the **single active translator constraint**: activating a new translator extension automatically deactivates any previously active one.  
  
## Project Structure  
  
```text  
src/  
  index.ts          # Selects the profile declared in extension.json  
  scraper/          # Scraper route builders and response mappers  
  theme/            # Programmatic theme variables  
  translator/       # Translator handler and batch paragraph processor  
  tts/              # TTS bridges for process/cloud/wasm modes (+ python/ example)  
  utilities/        # Shared SDK utilities (context, logger, network, storage, etc.)  
  types/            # Public bridge and response types (global ambient declarations)  
test/  
  scraper/          # Mocked scraper bridge tests  
  theme/            # Mocked theme bridge tests  
  translator/       # Mocked translator bridge tests  
  tts/              # Mocked TTS bridge tests  
```  
  
## Extension Utilities SDK (`src/utilities`)

When `activate(novel)` runs in `src/index.ts`, `initExtensionApi(novel)` is invoked automatically. All helper files and sub-modules within your extension can then directly import and use the SDK services:

```ts
import { logger, network, storage, env } from '../utilities'

export async function fetchChapterData(chapterRef: string) {
  await logger.info(`Fetching chapter ${chapterRef}`)

  // Centralized permission check: network.fetchJson automatically asserts network permission
  const data = await network.fetchJson<TemplateChapter>(`https://api.example.com/chapters/${chapterRef}`)
  return data
}
```

### Available Utilities Overview

| Utility | Imported Symbol | Main Methods & Features |
| --- | --- | --- |
| Context | `initExtensionApi`, `getNovelApi`, `isNovelApiInitialized` | Sets and retrieves the global `NovelExtensionApi` instance for the extension. |
| Logger | `logger` | `logger.info(...)`, `logger.warn(...)`, `logger.error(...)` |
| Network | `network`, `getNetwork` | `network.fetchJson<T>(...)`, `fetchText(...)`, `fetchDataUrl(...)`. Asserts `network` permission. |
| Storage | `storage`, `getStorage` | `storage.get<T>(...)`, `set(...)`, `remove(...)`, `createAssetUrl(...)`. Asserts `storage` permission. |
| Settings | `settings`, `getSettings` | `settings.register(handlers)` |
| Progress | `progress`, `getProgress` | `progress.report({ message, percentage })` |
| Process | `processApi`, `getProcess` | `processApi.spawn(...)`, `kill(...)`, `writeLine(...)`, `onLine(...)` (Desktop Electron). |
| UI / Theme | `ui` | `ui.applyTheme(variables)` |
| Environment | `env` | `env.version`, `env.platform`, `env.extensionId`, `env.manifest` |

  
Keep only the profile directory you are actively changing. The others remain as reference implementations, but they are not activated, tested, or declared in the package.  
  
## Customize a Scraper  
  
1. Init with `--kind scraper --base-url https://...` (or set `starter.kind` to `scraper`), then edit `extension.json`: `name`, `displayName`, `publisher`, `version`, `description`, `contributes.scraper.site`, and `network.allowedHosts` (every HTTP(S) host you request; no wildcards).  
2. Edit `src/scraper/index.ts`: set `BASE_URL`, update the search/book-detail/chapter paths, and adapt `toBookSummary`, `toBookDetail`, `toChapter` to the required response shapes.  
3. Read [src/scraper/README.md](src/scraper/README.md) — the complete scraper authoring guide.  
4. Update `test/scraper/run-tests.js` with representative fixtures. Keep the mock network bridge.  
5. Run `npm test`, then `npm run test:package`.  
  
Required capabilities are `search`, `getBookDetail`, `getChapter`; optional ones are `getFilterOptions`, `suggest`, `getComments`, `getReviews`. See "Required Response Shapes" below.  
  
## Customize a Theme  
  
1. Set `starter.kind` to `theme`; set `permissions` to `["ui.theme"]`; remove `network` and any scraper contribution.  
2. Edit `src/theme/index.ts` and replace the values in `TEMPLATE_THEME`.  
3. Use [src/theme/README.md](src/theme/README.md) as the token reference.  
4. Update `test/theme/run-tests.js` to assert the theme variables.  
5. Run `npm test`, then `npm run test:package`.  
  
For a declarative theme asset, add `contributes.themes` only after selecting the `theme` profile.  
  
## Customize a Translator  
  
1. Init with `--kind translator` (or set `starter.kind` to `translator`). Request `translate`; add `network` + `network.allowedHosts` and `storage` only if you call an external API.  
2. Edit `src/translator/index.ts` and register handlers via `novel.translator.register`:  
   - `translate(request)` — input `{ paragraphs: string[], sourceLang?: string, targetLang?: string }`, output `{ translatedParagraphs: string[] }` preserving the exact paragraph count and order.  
   - `getLanguages()` — `{ sourceLanguages: string[], targetLanguages: string[] }`.  
3. Read [src/translator/README.md](src/translator/README.md).  
4. Update `test/translator/run-tests.js`.  
5. Run `npm test`, then `npm run test:package`.  
  
## Customize a TTS Provider  
  
1. Init with `--kind tts --tts-mode <process|cloud|wasm>` (or set `starter.kind` to `tts` and `contributes.tts.mode`).  
   - `process`: spawns a local binary via `novel.process.spawn(...)` and communicates over stdio JSON lines. Desktop Electron only (`novel.process` is not available on web). See `src/tts/python/server.py`.  
   - `cloud`: calls a cloud API via `novel.network.fetchJson`/`fetchText`; requires `network` + `allowedHosts`.  
   - `wasm`: runs client-side WASM/ONNX inference; load assets via `novel.storage.get(...)` or `novel.storage.createAssetUrl(...)`.  
   - External models, binaries, and lexicons can be declared under `contributes.tts.resources` to be automatically downloaded during installation.  
2. Register handlers via `novel.tts.register`: `getVoices`, `speak({ text, voiceId })` → `{ audio, mimeType }`, and `stop`. `getVoices` and `speak` are required.  
3. Read [src/tts/README.md](src/tts/README.md).  
4. Update `test/tts/run-tests.js`. Run `npm test`, then `npm run test:package`.  
  
## Extension Contract  
  
`src/index.ts` exports `activate(novel)` and `deactivate()`. The selected profile is embedded at build time. Manifest capabilities and registered handlers must match exactly.  
  
Scraper capability ↔ handler ↔ request:  
  
| Capability | Handler | Request | Description |
| --- | --- | --- | --- |
| `search` | `search` | `{ filters, page, pageSize }` | Searches books with filters and pagination. |
| `getBookDetail` | `getBookDetail` | `{ bookRef }` | Returns detailed book metadata and volume/chapter outline. |
| `getChapter` | `getChapter` | `{ chapterRef, bookRef? }` | Returns a single chapter's content paragraphs. |
| `download` | `download` | `{ book_id, volume_id? }` | Batch downloads book or volume with chapter contents. |

### Invocation Timeouts & Long-running Operations

- **Standard Scraper Methods** (`search`, `getBookDetail`, `getChapter`, `getComments`, `getReviews`): Maximum **45 seconds** timeout.
- **Batch Download Method** (`download`): Maximum **10 minutes (600,000 ms)** timeout to allow batch crawling of multiple chapters.
- **TTS Speech Synthesis** (`speak`): Maximum **2 minutes (120,000 ms)** timeout (customizable via `contributes.tts.speakTimeoutMs`).
- **Batch Translator** (`translate`): Maximum **3 minutes (180,000 ms)** timeout for batch AI/machine translation of full chapters.
- **Network Requests** (`novel.network.fetchJson` / `fetchText`): Default **10 seconds (10,000 ms)** per request. For AI models or slower external APIs, pass `{ timeout: 120_000 }` (e.g. 120 seconds) in `ExtensionFetchOptions` to prevent early request abortion.
- **Best Practice for `download`**: When downloading multiple chapters sequentially, throttle requests politely (e.g. `150ms` - `300ms` delay between requests) to prevent HTTP 429 rate-limiting from target servers while ensuring the entire download completes within the 10-minute ceiling.

## Required Response Shapes (scraper)  
  
Entity IDs must be positive safe integers (or valid string references mapped via the gateway). Image URLs must be absolute HTTP(S) URLs or an empty string. Dates must be ISO-compatible.  
  
`search` returns a response with `items` and `pagination`:  
  
```ts  
{  
  items: [{  
    book_id: 101,  
    book_name: 'Example Book',  
    book_image: 'https://source.example/covers/example.jpg',  
    authors: [{ author_id: 11, author_name: 'Example Author' }]  
  }],  
  pagination: {  
    page: 1,  
    pageSize: 20,  
    totalItems: 1,  
    totalPages: 1,  
    hasNextPage: false  
  }  
}  
```  
  
`getBookDetail` returns the search fields plus metadata and chapter structure:  
  
```ts  
{  
  book_id: 101,  
  book_name: 'Example Book',  
  book_image: '',  
  authors: [],  
  book_sub_name: [],  
  status: 'ongoing',  
  description: '',  
  artists: [],  
  book_genre: [],  
  volumes: [{  
    volume_id: 201,  
    volume_name: 'Volume 1',  
    volume_number: 1,  
    created_at: '2026-01-01T00:00:00.000Z',  
    updated_at: '2026-01-01T00:00:00.000Z',  
    chapters: [{  
      chapter_id: 301,  
      chapter_name: 'Chapter 1',  
      chapter_number: 1,  
      created_at: '2026-01-01T00:00:00.000Z',  
      updated_at: '2026-01-01T00:00:00.000Z'  
    }]  
  }],  
  follow: 0,  
  latest_update: null,  
  rating_count: 0,  
  total_index: 0,  
  views: 0,  
  total_comment: 0,  
  average_rating: 0  
}  
```  
  
`getChapter` returns a sequence of non-empty text paragraphs:  
  
```ts  
{  
  chapter_id: 301,  
  chapter_name: 'Chapter 1',  
  chapter_number: 1,  
  volume_id: 201,  
  book_id: 101,  
  content: ['First paragraph.', 'Second paragraph.'],  
  total_index: 2,  
  status: 'ongoing',  
  created_at: '2026-01-01T00:00:00.000Z',  
  updated_at: '2026-01-01T00:00:00.000Z'  
}  
```  

`download` returns the book structure containing volumes and chapters with their full text `content`:

```ts
{
  book_id: 101,
  book_name: 'Example Book',
  volumes: [{
    volume_id: 201,
    volume_name: 'Volume 1',
    volume_number: 1,
    chapters: [{
      chapter_id: 301,
      chapter_name: 'Chapter 1',
      chapter_number: 1,
      content: ['First paragraph.', 'Second paragraph.']
    }]
  }]
}
```

The extension-local definitions in `src/types/` provide autocomplete for the public bridge and these template data shapes.  
  
## Commands  
  
```bash  
npm run typecheck    # validate + tsc --noEmit  
npm run build        # typecheck + bundle dist/index.js and dist/browser.js  
npm test             # build + mocked bridge tests (scraper/theme/translator/tts) + init tests  
npm run package      # build + create the ZIP  
npm run test:package # package + verify the ZIP  
```  
  
## Runtime Boundaries & Host API  
  
Use only `novel`, `URL`, `TextEncoder`, `TextDecoder`, `Buffer`, timers, and bundled dependencies. Do not use Electron modules, `ipcRenderer`, Node built-ins, direct `fetch`, `window`, `document`, or `localStorage`. All network access goes through `novel.network`; all persistence through `novel.storage`. Never persist credentials, cookies, tokens, or personal data.  
  
The host exposes the following APIs on `novel`:  
  
| Host API | Requirement / Permission | Description & Availability |  
| --- | --- | --- |  
| `novel.version` | Always available | Application host version string. |  
| `novel.platform` | Always available | Host runtime platform (`'darwin'`, `'win32'`, `'linux'` on Desktop; `'web'` on Web Worker). |  
| `novel.extension` | Always available | Contains `id` and optional extension `manifest`. |  
| `novel.logger` | Always available | Host logger (`info`, `warn`, `error`). |  
| `novel.scraper` | Default scraper profile | Scraper registration (`register`). |  
| `novel.settings` | Optional settings | Preferences and action registration (`register`). |  
| `novel.tts` | `tts` permission | Text-to-speech registration (`register`). Desktop and Web. |  
| `novel.process` | `tts` permission | Process execution bridge (`spawn`, `kill`, `writeLine`, `onLine`). Desktop Electron only (`novel.platform !== 'web'`). |  
| `novel.progress` | `tts` permission | Progress reporting (`report({ message, percentage })`). Desktop and Web. |  
| `novel.translator` | `translate` permission | Translator engine registration (`register`). Desktop Electron only. |  
| `novel.network` | `network` permission | HTTP(S) request API (`fetchText`, `fetchJson`, `fetchDataUrl`). Host must be in `network.allowedHosts`. |  
| `novel.storage` | `storage` permission | Persistent key-value storage (`get`, `set`, `remove`) and streaming virtual asset URLs (`createAssetUrl`). |  
| `novel.ui` | `ui.theme` permission | Theme variable application (`applyTheme`). |  
  
## Troubleshooting  
  
| Symptom | Likely cause | Fix |  
| --- | --- | --- |  
| `network permission is required` | `permissions` does not include `network`. | Add `network` to the manifest and rebuild. |  
| Host rejects a URL | The hostname is missing from `network.allowedHosts`. | Add the exact hostname; do not use wildcards. |  
| Activation fails | Handler names and manifest capabilities differ. | Register each declared handler once, with the identical name. |  
| Response validation fails | IDs, dates, image URLs, or required fields are invalid. | Compare the mapper output with the response shapes above. |  
| ZIP is rejected | Archive is missing a bundle or canonical manifest. | Run `npm run test:package` and use the generated ZIP. |  
  
The fixture tests prove local type safety, bundle generation, registration, request construction, response mapping, and archive contents. They do not prove that a third-party website permits access or that its API, HTML, and terms will remain stable; validate those separately after configuring your source.  
  
## Release Checklist  
  
Before publishing a ZIP, confirm all of the following:  
  
1. `name`, `displayName`, `publisher`, description, icon, version, and keywords no longer use template values.  
2. Every requested hostname, including image CDN and API redirect hosts, is listed in `network.allowedHosts`.  
3. You have permission to access the source and have checked its terms, rate limits, and authentication requirements.  
4. Fixtures cover representative successful data plus malformed data, a missing chapter selector, and expected request failures such as HTTP 403 or 429.  
5. `npm test` and `npm run test:package` pass, then the ZIP has been installed and exercised in a compatible e-novels build.  
6. For TTS, also confirm: the correct `mode`, that `process` mode ships its binary/script, and that `cloud` mode lists every API host in `network.allowedHosts`.  
  
## Runtime Source Validation  
  
The default scraper validates JSON received from `novel.network` before mapping it into e-novels response objects. Invalid IDs, dates, images, pagination, chapter metadata, or empty paragraphs produce an actionable error such as `Invalid source response at chapter.paragraphs[0]`.  
  
When replacing the `Template*` types with source-specific types, update [src/scraper/validation.ts](src/scraper/validation.ts) with the invariants that matter for that source. TypeScript only checks code at build time; network responses must be checked at runtime.  
  
## Manifest Reference  
  
`extension.json` is the installed extension manifest. `starter.kind` is only a starter build and test selector; e-novels ignores it after installation.  
  
| Field | Requirement |  
| --- | --- |  
| `name` | Lowercase letters, digits, and hyphens. It identifies the installed extension and its host channels. |  
| `version` | SemVer, such as `1.2.0`. |  
| `engines.enovel` | Compatible e-novels version range. |  
| `main`, `browser`, `icon` | Safe relative paths included in the package. The starter builds the first two. |  
| `activationEvents` | Use `always` for a scraper, TTS, translator or programmatic theme that must be available on application start. |  
| `permissions` | Request only capabilities the selected profile needs. |  
| `network.allowedHosts` | Required for scrapers and cloud TTS/translators. Include the source hostname; an allowed entry also permits its subdomains. Private networks and `localhost` are rejected. |  
| `contributes.scraper` | Singular scraper metadata, capabilities, and search fields. Never use `contributes.scrapers`. |  
| `contributes.tts` | Singular TTS metadata (`name`, `description`, `mode`, `capabilities`, optional `resources`). |  
| `contributes.tts.resources` | Optional array of external downloadable assets (`url`, `path`, `size`, `sha256`) fetched during extension installation. |  
| `contributes.translator` | Singular translator metadata (`name`, `description`, `capabilities`, `sourceLanguages`, `targetLanguages`). |  
| `contributes.settings` | Optional non-secret preferences and actions (`text`, `password`, `url`, `email`, `number`, `checkbox`, `select`, `textarea`, `audio`). Persistent actions require `storage`. |  
| `contributes.themes` | Optional declarative theme metadata for a theme profile. |  
  
### Extension Settings Formats (`contributes.settings.fields`)

Extensions can declare settings fields with the following `type` options:
- `text`: Single-line text input.
- `password`: Masked input with show/hide toggle for sensitive tokens/keys.
- `url`: Validated URL endpoint.
- `email`: Email address format.
- `number`: Numeric input with optional `min`, `max`, `step`.
- `checkbox`: Boolean toggle (true/false).
- `select`: Dropdown menu with predefined `options: [{ label, value }]`.
- `textarea`: Multiline text area.
- `audio`: Drag-and-drop audio input with file selector, audio preview player, and configurable `accept` types & `maxSizeMb` limits (e.g. for Voice Cloning TTS reference samples).

Every declared scraper/TTS/translator capability must be registered exactly once during `activate`. The required capabilities for scraper are `search`, `getBookDetail`, and `getChapter`; for TTS: `getVoices` and `speak`.  
  
## Install, Update, And Diagnose  
  
1. Run `npm run test:package`. The ZIP is written in this folder as `<name>-<version>.zip`.  
2. In e-novels, open **Extensions** and choose **Install extension from ZIP**.  
3. Select the ZIP and open its detail page. Its bundled `README.md` appears on the **Guide** tab.  
4. Activate the extension from its detail page when it is not activated automatically.  
5. To update it, increment `version`, package again, deactivate the existing extension, install the new ZIP with the same `name`, then activate it.  
  
For installation failures, start with the manifest error and run `npm run validate` locally. For activation or handler failures, log a concise operation name, source URL, and safe response metadata with `novel.logger.error`, then reproduce the case using scrubbed files in `test/scraper/fixtures/` or `test/tts/`. Never log credentials, cookies, chapter text, or personal data.  