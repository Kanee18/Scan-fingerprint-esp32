import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from 'react'
import { Loader2, X } from 'lucide-react'
import { cn, avatarColor, initials } from '../lib/utils'
import { STATUS_META } from '../lib/constants'
import type { AttendanceStatus } from '../lib/types'

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
}
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('btn', VARIANT_CLASS[variant], size === 'lg' && 'btn-lg', size === 'sm' && 'px-3 py-1.5 text-xs', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---------------- Card ----------------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>
}

// ---------------- Badge ----------------
export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('badge bg-slate-100 text-slate-700', className)}>{children}</span>
}

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={cn('badge', m.bg, m.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

// ---------------- Inputs ----------------
interface FieldProps {
  label?: string
  hint?: string
  error?: string
}
export function Input({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input className={cn('input', error && 'ring-red-400', className)} {...rest} />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Select({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className={cn('input pr-10', error && 'ring-red-400', className)} {...rest}>
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Textarea({
  label,
  hint,
  error,
  className,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className={cn('input min-h-[90px]', error && 'ring-red-400', className)} {...rest} />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

// ---------------- Avatar ----------------
export function Avatar({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-24 w-24 text-3xl',
  }
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={cn('rounded-full object-cover', sizes[size])} />
  }
  return (
    <div className={cn('flex items-center justify-center rounded-full font-bold text-white', sizes[size], avatarColor(name))}>
      {initials(name)}
    </div>
  )
}

// ---------------- Spinner / Loading ----------------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />
}

export function LoadingScreen({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

// ---------------- StatCard ----------------
export function StatCard({
  label,
  value,
  icon,
  accent = 'brand',
  sub,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: 'brand' | 'green' | 'amber' | 'red' | 'violet'
  sub?: ReactNode
}) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon && <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', accents[accent])}>{icon}</div>}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  )
}

// ---------------- EmptyState ----------------
export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      {desc && <p className="max-w-sm text-sm text-slate-400">{desc}</p>}
      {action}
    </div>
  )
}

// ---------------- PageHeader ----------------
export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className={cn(
          'flex max-h-[92vh] w-full animate-scale-in flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl',
          sizes[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <button onClick={onClose} className="touch-target rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------- Skeleton ----------------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}
