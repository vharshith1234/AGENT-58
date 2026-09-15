import { useEffect, useRef } from 'react'

function isBgWhite(r: number, g: number, b: number) {
  return r >= 245 && g >= 245 && b >= 245
}

/** Clear the solid white plate connected to the frame edges (keeps white robot body). */
function keyWhitePlate(data: Uint8ClampedArray, w: number, h: number) {
  const n = w * h
  const seen = new Uint8Array(n)
  const stack: number[] = []

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (seen[i]) return
    const o = i * 4
    if (!isBgWhite(data[o], data[o + 1], data[o + 2])) return
    seen[i] = 1
    stack.push(i)
  }

  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }

  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = (i / w) | 0
    const o = i * 4
    data[o + 3] = 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  // Soften fringe next to keyed plate
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const o = i * 4
      if (data[o + 3] === 0) continue
      if (!isBgWhite(data[o], data[o + 1], data[o + 2])) continue
      let nearClear = false
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (data[((y + dy) * w + (x + dx)) * 4 + 3] === 0) {
          nearClear = true
          break
        }
      }
      if (nearClear) data[o + 3] = 0
    }
  }
}

/** Decorative robot loop with real transparent background. */
export function LoginRobot({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let raf = 0
    let running = true

    const draw = () => {
      if (!running) return
      const w = video.videoWidth
      const h = video.videoHeight
      if (w > 0 && h > 0 && !video.paused) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(video, 0, 0, w, h)
        const frame = ctx.getImageData(0, 0, w, h)
        keyWhitePlate(frame.data, w, h)
        ctx.putImageData(frame, 0, 0)
      }
      raf = requestAnimationFrame(draw)
    }

    const start = () => {
      void video.play().catch(() => {})
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }

    video.addEventListener('loadeddata', start)
    if (video.readyState >= 2) start()

    return () => {
      running = false
      cancelAnimationFrame(raf)
      video.removeEventListener('loadeddata', start)
    }
  }, [])

  return (
    <span className={['login-robot-wrap', className].filter(Boolean).join(' ')} aria-hidden>
      <video
        ref={videoRef}
        className="login-robot-source"
        src="/brand/ai-robot.mp4"
        muted
        loop
        playsInline
        preload="auto"
      />
      <canvas ref={canvasRef} className="login-robot" />
    </span>
  )
}
