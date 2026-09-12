export function IconMail({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 13.5 21 7.5M5.25 18h13.5A1.75 1.75 0 0 0 20.5 16.25v-8.5A1.75 1.75 0 0 0 18.75 6H5.25A1.75 1.75 0 0 0 3.5 7.75v8.5A1.75 1.75 0 0 0 5.25 18Z" />
    </svg>
  )
}

export function IconLock({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5V8.25a4.5 4.5 0 1 1 9 0v2.25M6.75 10.5h10.5A1.75 1.75 0 0 1 19 12.25v6A1.75 1.75 0 0 1 17.25 20H6.75A1.75 1.75 0 0 1 5 18.25v-6A1.75 1.75 0 0 1 6.75 10.5Z" />
    </svg>
  )
}

export function IconEye({ open, className = 'h-5 w-5' }: { open: boolean; className?: string }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 10.6A2.5 2.5 0 0 0 13.4 13.5M9.9 5.6A9.4 9.4 0 0 1 12 5.5C17.5 5.5 21 12 21 12a16 16 0 0 1-3.1 3.9M6.2 6.3A16.3 16.3 0 0 0 3 12s3.5 6.5 9 6.5c1.1 0 2.1-.2 3.1-.5" />
    </svg>
  )
}

export function IconUsers({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19v-1.2c0-2 3-3.1 5-3.1s5 1.1 5 3.1V19H3.5Zm9 0v-1.2c0-.7.2-1.3.6-1.8 1.1-.5 2.4-.7 3.4-.7 2 0 5 1.1 5 3.1V19h-9Z" />
    </svg>
  )
}

export function IconUser({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.5c-3.1 0-7 1.6-7 3.7V20h14v-2.8c0-2.1-3.9-3.7-7-3.7Z" />
    </svg>
  )
}

export function IconBuilding({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M4 20V10l8-5 8 5v10h-5v-6H9v6H4Z" />
    </svg>
  )
}

export function IconCap({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 10 L58 22 L32 34 L6 22 Z" fill="#1e3a8a" />
      <path d="M16 26 V40 C16 46 24 50 32 50 C40 50 48 46 48 40 V26" fill="none" stroke="#1e3a8a" strokeWidth="4" strokeLinejoin="round" />
      <path d="M54 22 V38" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="54" cy="40" r="3.5" fill="#2563eb" />
    </svg>
  )
}

export function AcademicIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 220" className={className} aria-hidden>
      <ellipse cx="210" cy="198" rx="150" ry="14" fill="#dbeafe" />
      <g fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M155 140 V95 H265 V140" />
        <path d="M170 95 V72 H250 V95" />
        <path d="M190 72 L210 52 L230 72" />
        <rect x="178" y="108" width="20" height="18" rx="2" />
        <rect x="222" y="108" width="20" height="18" rx="2" />
        <path d="M140 140 H280" />
      </g>
      <g transform="translate(60 130)">
        <rect width="72" height="14" y="36" rx="2" fill="#2563eb" />
        <rect width="66" height="14" x="3" y="22" rx="2" fill="#3b82f6" />
        <rect width="60" height="14" x="6" y="8" rx="2" fill="#60a5fa" />
      </g>
      <g transform="translate(150 118)">
        <rect x="16" y="6" width="110" height="70" rx="5" fill="#93c5fd" />
        <rect x="24" y="14" width="94" height="50" rx="3" fill="#eff6ff" />
        <circle cx="48" cy="36" r="7" fill="#60a5fa" />
        <circle cx="71" cy="36" r="7" fill="#3b82f6" />
        <circle cx="94" cy="36" r="7" fill="#2563eb" />
        <path d="M6 78 H136" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
      </g>
      <g transform="translate(310 138)">
        <rect x="14" y="40" width="24" height="18" rx="3" fill="#fb923c" />
        <path d="M26 40 C16 24 8 20 12 14 C22 18 24 28 26 40 Z" fill="#22c55e" />
        <path d="M26 40 C36 24 44 20 40 14 C30 18 28 28 26 40 Z" fill="#16a34a" />
      </g>
    </svg>
  )
}
