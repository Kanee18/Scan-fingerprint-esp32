import { useEffect, useState } from 'react'
import { formatTime, formatDateID } from '../lib/utils'

export function Clock({ showDate = true, className }: { showDate?: boolean; className?: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className={className}>
      <div className="font-mono text-2xl font-bold tabular-nums tracking-tight">{formatTime(now)}</div>
      {showDate && <div className="text-xs text-slate-500">{formatDateID(now)}</div>}
    </div>
  )
}

/** Hook waktu sekarang yang diperbarui tiap detik. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
