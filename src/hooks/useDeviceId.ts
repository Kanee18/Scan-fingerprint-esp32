import { useSearchParams } from 'react-router-dom'
import { DEFAULT_DEVICE_ID } from '../lib/firebase'

/**
 * ID perangkat aktif untuk halaman Kiosk/Enroll, dibaca dari query URL `?device=`.
 * Dengan begitu setiap layar (mis. tablet di tiap kelas) bisa dikunci ke alatnya
 * sendiri lewat URL/bookmark: `/kiosk?device=esp32-x-mipa-1`.
 * Jika tidak ada di URL, memakai VITE_DEFAULT_DEVICE_ID.
 */
export function useDeviceId(): [string, (id: string) => void] {
  const [params, setParams] = useSearchParams()
  const deviceId = params.get('device') || DEFAULT_DEVICE_ID
  const setDeviceId = (id: string) => {
    const p = new URLSearchParams(params)
    p.set('device', id)
    setParams(p, { replace: true })
  }
  return [deviceId, setDeviceId]
}
