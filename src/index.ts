import { initExtensionApi, logger } from './utilities'
import { registerTranslatorProfile } from './translator'

export * from './utilities'
export * from './translator'

export async function activate(novel: NovelExtensionApi): Promise<void> {
  initExtensionApi(novel)
  registerTranslatorProfile(novel)
  await logger.info(`Activated ${novel.extension.id}`)
}

export async function deactivate(): Promise<void> {
  return
}