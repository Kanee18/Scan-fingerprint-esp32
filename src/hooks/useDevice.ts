import { useEffect, useState } from 'react'
import { limitToLast, onValue, query, ref } from 'firebase/database'
import { rtdb } from '../lib/firebase'
import type { DeviceCommand, DeviceState, EnrollStatus, ScanEvent } from '../lib/types'

const OFFLINE_AFTER_MS = 30_000

/** State satu perangkat + penentuan online/offline berbasis lastSeen. */
export function useDeviceState(deviceId: string | null) {
  const [device, setDevice] = useState<DeviceState | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    if (!deviceId) return
    const unsub = onValue(ref(rtdb, `devices/${deviceId}`), (snap) => {
      setDevice(snap.exists() ? ({ id: deviceId, ...(snap.val() as object) } as DeviceState) : null)
    })
    return unsub
  }, [deviceId])

  // refresh tiap 10 dtk agar status online/offline akurat
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  const isOnline = !!device?.lastSeen && Date.now() - device.lastSeen < OFFLINE_AFTER_MS
  return { device, isOnline }
}

/** Semua perangkat terdaftar. */
export function useDevicesList() {
  const [devices, setDevices] = useState<DeviceState[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onValue(ref(rtdb, 'devices'), (snap) => {
      const val = (snap.val() as Record<string, object>) || {}
      setDevices(
        Object.entries(val).map(([id, v]) => {
          const d = v as DeviceState
          return {
            ...d,
            id,
            status: d.lastSeen && Date.now() - d.lastSeen < OFFLINE_AFTER_MS ? 'online' : 'offline',
          }
        }),
      )
      setLoading(false)
    })
    return unsub
  }, [])
  return { devices, loading }
}

/** Aliran scan terbaru dari sebuah perangkat. */
export function useScans(deviceId: string | null, max = 20) {
  const [scans, setScans] = useState<ScanEvent[]>([])
  useEffect(() => {
    if (!deviceId) return
    const q = query(ref(rtdb, `scans/${deviceId}`), limitToLast(max))
    const unsub = onValue(q, (snap) => {
      const val = (snap.val() as Record<string, ScanEvent>) || {}
      const arr = Object.entries(val).map(([id, v]) => ({ id, ...v }))
      arr.sort((a, b) => b.timestamp - a.timestamp)
      setScans(arr)
    })
    return unsub
  }, [deviceId, max])
  return scans
}

export function useDeviceCommand(deviceId: string | null) {
  const [command, setCommand] = useState<DeviceCommand | null>(null)
  useEffect(() => {
    if (!deviceId) return
    const unsub = onValue(ref(rtdb, `commands/${deviceId}`), (snap) => {
      setCommand(snap.exists() ? (snap.val() as DeviceCommand) : null)
    })
    return unsub
  }, [deviceId])
  return command
}

export function useEnrollStatus(deviceId: string | null) {
  const [status, setStatus] = useState<EnrollStatus | null>(null)
  useEffect(() => {
    if (!deviceId) return
    const unsub = onValue(ref(rtdb, `enroll_status/${deviceId}`), (snap) => {
      setStatus(snap.exists() ? (snap.val() as EnrollStatus) : null)
    })
    return unsub
  }, [deviceId])
  return status
}
