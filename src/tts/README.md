# TTS Extension Authoring Guide

This folder contains a template for developing Text-to-Speech (TTS) extensions.
The template demonstrates three different modes of execution for TTS extensions:

1. **Process Mode (`process`)**: Executes a local binary/script (e.g., Python) via standard input/output (stdio) to generate audio. This is only supported in desktop (Electron) environments.
2. **Cloud Mode (`cloud`)**: Invokes cloud-based API endpoints (e.g., ElevenLabs, Google Cloud TTS) using the host-provided `novel.network` fetch wrapper. Works in both desktop and web-only environments (subject to network permissions).
3. **WASM/ONNX Mode (`wasm`)**: Performs client-side inference using WebAssembly (WASM) or ONNX models within the browser/extension sandbox. Works in both desktop and web-only environments.

## Initialize a Profile

To initialize a copy of this starter for your TTS extension, run:

```bash
npm run init -- --name my-tts --display-name "My TTS Service" --publisher your-name --kind tts --tts-mode process
```

The options for `--tts-mode` are `process`, `cloud`, or `wasm`.

## Required Manifest

For every TTS extension, `extension.json` should declare the TTS contribution and settings schema for user preferences (voice selection, preview text, test action):

```json
{
  "starter": { "kind": "tts" },
  "permissions": ["tts", "storage"],
  "contributes": {
    "tts": {
      "name": "My TTS Provider",
      "description": "Provide custom text-to-speech voices.",
      "version": 1,
      "mode": "cloud",
      "capabilities": ["getVoices", "speak", "stop"]
    },
    "settings": {
      "fields": [
        {
          "id": "voice",
          "label": "Voice",
          "type": "select",
          "description": "Select default voice.",
          "defaultValue": "voice-1",
          "options": [
            { "label": "Sample Voice 1", "value": "voice-1" },
            { "label": "Sample Voice 2", "value": "voice-2" }
          ]
        },
        {
          "id": "previewText",
          "label": "Preview Text",
          "type": "textarea",
          "description": "Sample text to test speech synthesis.",
          "defaultValue": "This is a sample speech synthesis test."
        }
      ],
      "actions": [
        {
          "id": "previewVoice",
          "label": "🔊 Preview Voice",
          "style": "primary",
          "fields": ["voice", "previewText"]
        }
      ]
    }
  }
}
```

*Note: If your extension uses `cloud` mode, it must also include the `"network"` permission and list allowed hosts under `"network": { "allowedHosts": [...] }`.*

## Extension API Registration

Your extension registers its handlers using the `novel.tts.register` function during activation:

```ts
await novel.tts.register({
  async getVoices() {
    // Return list of supported voices
    return {
      voices: [
        { id: "voice-1", name: "English Female Voice", lang: "en-US" }
      ]
    };
  },
  async speak({ text, voiceId }) {
    // Generate audio and return base64 encoded audio
    return {
      audio: "BASE64_ENCODED_AUDIO_DATA",
      mimeType: "audio/wav"
    };
  },
  async stop() {
    // Stop any ongoing speech generation
    return { success: true };
  }
});
```

### 1. Process Mode Details

In Process mode:
- The host spawns a local process using `novel.process.spawn({ executable: 'bin/server' })`.
- Communication is carried out via JSON lines written to stdin and read from stdout.
- The request format is: `{"id": "unique-id", "method": "getVoices" | "speak" | "stop", "params": {...}}`.
- The response format is: `{"id": "unique-id", "result": {...}}` or `{"id": "unique-id", "error": "error message"}`.
- A Python example server (`python/server.py`) is provided under the `python` directory as a starting point.

### 2. Cloud Mode Details

In Cloud mode:
- You make requests using `novel.network.fetchJson` or `novel.network.fetchText`.
- You cannot use direct `fetch` or custom TCP sockets. All connections must respect the declared `allowedHosts`.

### 3. WASM/ONNX Mode Details

In WASM mode:
- You can load custom assets (like ONNX models or dictionary files) using `novel.storage.get('models/file.onnx')` which returns a standard `File` object for in-memory processing.
- Alternatively, generate streaming asset URLs with `novel.storage.createAssetUrl('models/file.onnx')` which returns a virtual URL (`novel-ext://...` on Desktop or `blob:...` on Web) for zero-copy streaming fetch.
- Run sandboxed inferences in web workers or the extension environment.

### 4. Voice Cloning & Audio Input Settings

For TTS extensions supporting Voice Cloning (e.g. F5-TTS, GPT-SoVITS, CosyVoice, XTTS), you can declare an `"audio"` setting field in `contributes.settings`. This provides a drag-and-drop audio input zone in the UI with live audio playback preview:

```json
{
  "contributes": {
    "settings": {
      "fields": [
        {
          "id": "voiceName",
          "label": "Cloned Voice Name",
          "type": "text",
          "placeholder": "e.g. My Custom Narrator",
          "required": true
        },
        {
          "id": "referenceAudio",
          "label": "Reference Sample Audio",
          "type": "audio",
          "description": "Drag and drop a 5-30s audio sample (.wav, .mp3, .ogg, .flac).",
          "required": true,
          "maxSizeMb": 15,
          "accept": ["audio/wav", "audio/mp3", "audio/ogg", ".wav", ".mp3", ".ogg", ".flac", ".m4a"]
        }
      ],
      "actions": [
        {
          "id": "cloneVoice",
          "label": "🎙️ Clone Voice",
          "style": "primary",
          "fields": ["voiceName", "referenceAudio"],
          "confirm": "Clone voice using the provided audio sample?",
          "longRunning": true
        }
      ]
    }
  }
}
```

Handle the action in your extension using `novel.settings.register`:

```ts
novel.settings.register({
  async cloneVoice(payload) {
    const { voiceName, referenceAudio } = payload
    // referenceAudio is a Base64 Data URL (data:audio/wav;base64,...)
    await novel.progress.report({ message: "Analyzing reference voice timbre...", percentage: 40 })

    // Process or send to Python / cloud inference server...

    return {
      success: true,
      message: `Voice "${voiceName}" cloned successfully!`
    }
  }
})
```

### 5. Automatic Resource Downloading on Installation (`resources`)

TTS extensions often require large assets such as ONNX model weights, WASM modules, voice tensors, Python binaries, or phonetic lexicons. To keep extension ZIP packages lightweight and avoid bloating package sizes, you can declare external downloadable resources in `contributes.tts.resources`.

During extension installation (via ZIP file or buffer), the host application automatically downloads these resources directly into the extension directory before final activation.

#### Manifest Configuration (`extension.json`)

```json
{
  "contributes": {
    "tts": {
      "name": "My Custom TTS",
      "mode": "wasm",
      "capabilities": ["getVoices", "speak", "stop"],
      "resources": [
        {
          "url": "https://cdn.example.com/models/voice-model.onnx",
          "path": "models/voice-model.onnx",
          "size": 15482390,
          "sha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
        },
        {
          "url": "https://cdn.example.com/dicts/lexicon.bin",
          "path": "data/lexicon.bin",
          "size": 2048576,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }
      ]
    }
  }
}
```

#### Resource Field Specifications & Security Constraints

| Field | Type | Description & Validation Rules |
| --- | --- | --- |
| `url` | `string` | **Must be a public HTTPS URL** (`https://...`). HTTP is disallowed, and private networks/loopback addresses (e.g. `localhost`, `127.0.0.1`, `192.168.x.x`, `10.x.x.x`) are strictly blocked to prevent SSRF vulnerabilities. |
| `path` | `string` | Safe relative destination path within the extension folder (e.g. `models/voice-model.onnx` or `bin/server`). Subdirectories are created automatically. Path traversal (`..`) or absolute paths (`/`) are prohibited. |
| `size` | `number` | Expected file size in bytes (positive integer `> 0`). Used for progress reporting and integrity verification. |
| `sha256` | `string` | SHA-256 checksum (64 hexadecimal characters). The host calculates the hash during streaming and rejects/deletes the resource if it does not match. |

#### Installation Lifecycle & Caching

1. **Extraction**: The ZIP is unpacked into the destination extension directory.
2. **Resource Check & Resume**: The host iterates through declared `resources`. If a resource file already exists at `path` and its file size matches `size`, downloading is skipped.
3. **Secure Streaming Download**: Downloads follow up to 5 HTTP redirects (re-checking URL safety on each hop) and compute the SHA-256 hash on-the-fly.
4. **Integrity Enforcement**: If the downloaded size or SHA-256 hash mismatches, the file is removed and installation aborts.

#### Accessing Downloaded Resources in Code

After installation, the downloaded files reside inside the extension root directory and can be consumed via standard SDK APIs:

- **WASM / Web Mode**:
  ```ts
  // 1. Read as in-memory DOM File object
  const modelFile = (await novel.storage.get('models/voice-model.onnx')) as File
  const arrayBuffer = await modelFile.arrayBuffer()

  // 2. Or create a streaming Virtual Asset URL (zero-copy)
  const assetUrl = await novel.storage.createAssetUrl('models/voice-model.onnx')
  const response = await fetch(assetUrl)
  const buffer = await response.arrayBuffer()
  ```

- **Process Mode (Desktop Electron)**:
  ```ts
  // Spawn downloaded binary directly
  await novel.process.spawn({ executable: 'bin/server' })
  ```

## Building and Packaging

Run the build script to package your extension:

```bash
npm run build
```

This creates a ZIP package ready to be loaded by the application.
