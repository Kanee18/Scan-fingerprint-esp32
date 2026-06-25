import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from '../components/ui'

interface ConfirmOptions {
  title?: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ message: '' })
  const resolver = useRef<(v: boolean) => void>()

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (val: boolean) => {
    setOpen(false)
    resolver.current?.(val)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => close(false)}
        title={opts.title ?? 'Konfirmasi'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {opts.cancelText ?? 'Batal'}
            </Button>
            <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {opts.confirmText ?? 'Ya, lanjutkan'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {opts.danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div className="text-sm text-slate-600">{opts.message}</div>
        </div>
      </Modal>
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam ConfirmProvider')
  return ctx
}
