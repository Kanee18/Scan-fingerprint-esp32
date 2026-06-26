import { getOne, setOne } from './db'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { SchoolSettings } from '../lib/types'

const SETTINGS_ID = 'school'

export async function getSettings(): Promise<SchoolSettings> {
  const s = await getOne<Partial<SchoolSettings>>('settings', SETTINGS_ID)
  // Gabungkan dengan default agar field yang hilang (mis. activeDays/periods) tidak menyebabkan error.
  return {
    ...(DEFAULT_SETTINGS as SchoolSettings),
    ...(s ?? {}),
    periods: s?.periods?.length ? s.periods : DEFAULT_SETTINGS.periods,
    activeDays: s?.activeDays?.length ? s.activeDays : DEFAULT_SETTINGS.activeDays,
  }
}

export async function saveSettings(data: Partial<SchoolSettings>): Promise<void> {
  await setOne('settings', SETTINGS_ID, data, true)
}

export async function ensureSettings(): Promise<void> {
  const s = await getOne<SchoolSettings>('settings', SETTINGS_ID)
  if (!s) await setOne('settings', SETTINGS_ID, DEFAULT_SETTINGS as unknown as Record<string, unknown>, false)
}
