import { getOne, setOne } from './db'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { SchoolSettings } from '../lib/types'

const SETTINGS_ID = 'school'

export async function getSettings(): Promise<SchoolSettings> {
  const s = await getOne<SchoolSettings>('settings', SETTINGS_ID)
  return s ?? (DEFAULT_SETTINGS as SchoolSettings)
}

export async function saveSettings(data: Partial<SchoolSettings>): Promise<void> {
  await setOne('settings', SETTINGS_ID, data, true)
}

export async function ensureSettings(): Promise<void> {
  const s = await getOne<SchoolSettings>('settings', SETTINGS_ID)
  if (!s) await setOne('settings', SETTINGS_ID, DEFAULT_SETTINGS as unknown as Record<string, unknown>, false)
}
