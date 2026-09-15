import { useCallback, useEffect, useRef, useState } from 'react'

const DESKTOP_SRC = '/brand/intro-desktop.mp4?v=cool-intro'
const MOBILE_SRC = '/brand/intro-mobile.mp4'
const MOBILE_MQ = '(max-width: 767px)'

function pickIntroSrc() {
  if (typeof window === 'undefined') return DESKTOP_SRC
  return window.matchMedia(MOBILE_MQ).matches ? MOBILE_SRC : DESKTOP_SRC
}

export function LoginSplash({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const doneRef = useRef(false)
  const [src, setSrc] = useState(pickIntroSrc)
  const [exiting, setExiting] = useState(false)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    setExiting(true)
    window.setTimeout(() => onComplete(), 350)
  }, [onComplete])

  useEffect(() => {
    document.documentElement.classList.add('login-splash-open')
    return () => {
      document.documentElement.classList.remove('login-splash-open')
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => {
      const next = mq.matches ? MOBILE_SRC : DESKTOP_SRC
      setSrc((prev) => (prev === next ? prev : next))
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.load()
    void video.play().catch(() => {
      // Autoplay blocked — still allow Skip / tap to finish
    })
  }, [src])

  return (
    <div
      className={`login-splash${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-label="AGENT 58 introduction"
      aria-modal="true"
    >
      <video
        ref={videoRef}
        className="login-splash-video"
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onEnded={finish}
        onClick={finish}
      />
      <button type="button" className="login-splash-skip" onClick={finish}>
        Skip
      </button>
    </div>
  )
}

export const LOGIN_SPLASH_SEEN_KEY = 'agent58-login-splash-seen'

export function shouldShowLoginSplash() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(LOGIN_SPLASH_SEEN_KEY) === '1') return false
  } catch {
    /* ignore */
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

export function markLoginSplashSeen() {
  try {
    sessionStorage.setItem(LOGIN_SPLASH_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}
