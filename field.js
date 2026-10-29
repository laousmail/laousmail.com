/* laousmail.com — the field. The living canvas from ORBIT (play/), behind the
   whole page: trails that scroll with the page, slow embers, ripples and
   sparks wherever you tap, a turning crown of ticks and a sound-wave round
   the orbit that swells while a song plays, and a burst from every song you
   touch. Drawn under the content, never over it. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const canvas = document.createElement('canvas')
  canvas.className = 'field'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)
  const g = canvas.getContext('2d')
  if (!g) return

  const stage = document.querySelector('.orbit-stage')
  const orbit = document.querySelector('[data-orbit]')
  const ripples = []
  const sparks = []
  const embers = []
  let W = 0
  let H = 0
  let dpr = 1
  let lastY = window.scrollY
  let spin = 0
  let kick = 0
  let swell = 0
  let lastBeat = 0
  let running = false

  const light = () => document.documentElement.getAttribute('data-theme') === 'light'
  const HOT = [255, 106, 19]
  const GOLD = [255, 179, 71]
  const PALE = [255, 214, 160]
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = light() ? '#f6f1ea' : '#070605'
    g.fillRect(0, 0, W, H)
    const want = Math.round(Math.min(60, (W * H) / 26000))
    while (embers.length < want) embers.push(ember(true))
    embers.length = want
  }

  function ember(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      vy: 0.15 + Math.random() * 0.45,
      drift: Math.random() * Math.PI * 2,
      r: 0.6 + Math.random() * 1.4,
      a: 0.25 + Math.random() * 0.5,
      c: Math.random() < 0.5 ? GOLD : HOT,
    }
  }

  // sparks fly outward from a point, along an angle if one is given
  function burst(x, y, opts = {}) {
    const { angle = null, count = 14, color = GOLD, ring = 18 } = opts
    ripples.push({ x, y, r: ring, life: 1, color })
    if (reduce) return
    for (let k = 0; k < count; k += 1) {
      const a = angle === null ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * 1.2
      const speed = 1.2 + Math.random() * 3.2
      sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, color: Math.random() < 0.3 ? PALE : color })
    }
    wakeUp()
  }

  function orbitGeo() {
    if (!stage) return null
    const r = stage.getBoundingClientRect()
    if (r.bottom < -80 || r.top > H + 80 || !r.width) return null
    const fade = orbit ? Number(orbit.dataset.fade ?? 1) : 1
    if (fade < 0.02) return null
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, fade }
  }

  function frame(now) {
    running = false
    const isLight = light()

    // trails travel with the page instead of smearing when you scroll
    const dy = window.scrollY - lastY
    lastY = window.scrollY
    // a long jump (a link, the keyboard) starts the trails afresh instead of dragging them
    if (Math.abs(dy) > H * 0.25) {
      g.fillStyle = isLight ? '#f6f1ea' : '#070605'
      g.fillRect(0, 0, W, H)
      ripples.length = 0
      sparks.length = 0
    } else if (dy) {
      g.save()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'copy'
      g.drawImage(canvas, 0, -dy * dpr)
      g.restore()
      for (const p of ripples) p.y -= dy
      for (const p of sparks) p.y -= dy
      // embers move a little with the page (parallax) and wrap round, so none bunch up
      for (const p of embers) p.y = ((((p.y - dy * 0.3 + 10) % (H + 20)) + H + 20) % (H + 20)) - 10
    }

    g.globalCompositeOperation = 'source-over'
    g.fillStyle = isLight ? 'rgba(246,241,234,0.28)' : 'rgba(7,6,5,0.22)'
    g.fillRect(0, 0, W, H)

    const playing = !!orbit?.classList.contains('is-playing')
    swell += ((playing ? 1 : 0) - swell) * 0.04
    kick *= 0.9
    // while a song plays, the orbit pulses on a slow beat
    if (playing && !reduce && now - lastBeat > 625) {
      lastBeat = now
      kick = Math.max(kick, 0.7)
    }

    const o = orbitGeo()
    const add = isLight ? 'source-over' : 'lighter'
    const k = isLight ? 0.55 : 1

    if (o) {
      const { cx, cy, w } = o
      // everything round the orbit fades with it (k is shadowed for this block)
      const k = (isLight ? 0.55 : 1) * o.fade
      const core = w * 0.28
      const ring = w * 0.42
      // the centre breathes
      const glowR = w * (0.42 + swell * 0.08 + kick * 0.06)
      const cg = g.createRadialGradient(cx, cy, core * 0.6, cx, cy, glowR)
      cg.addColorStop(0, rgba(HOT, (0.08 + swell * 0.08 + kick * 0.08) * k))
      cg.addColorStop(1, rgba(HOT, 0))
      g.fillStyle = cg
      g.beginPath()
      g.arc(cx, cy, glowR, 0, Math.PI * 2)
      g.fill()

      g.globalCompositeOperation = add
      // a slowly turning crown of ticks outside the ring
      spin += reduce ? 0 : 0.0012 + swell * 0.002
      g.lineWidth = 1
      g.strokeStyle = rgba(isLight ? HOT : GOLD, (0.16 + swell * 0.12) * k)
      const r1 = w * 0.5 + 6
      for (let n = 0; n < 90; n += 1) {
        const a = spin + (n / 90) * Math.PI * 2
        const r2 = r1 + (n % 6 === 0 ? 9 : 4) + (n % 6 === 0 ? kick * 6 : 0)
        g.beginPath()
        g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))
        g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
        g.stroke()
      }

      // the sound-wave between the face and the ring of songs
      const base = (core + ring) / 2 + 4
      const amp = (ring - core) * (0.06 + swell * 0.2 + kick * 0.1)
      const t = now / 1000
      g.strokeStyle = rgba(GOLD, (0.22 + swell * 0.3) * k)
      g.lineWidth = 1.3
      g.beginPath()
      for (let n = 0; n <= 180; n += 1) {
        const a = (n / 180) * Math.PI * 2
        const v = Math.sin(a * 7 + t * 1.9) * 0.5 + Math.sin(a * 13 - t * 2.7) * 0.3 + Math.sin(a * 23 + t * 4.1) * 0.2
        const r = base + v * amp
        const x = cx + r * Math.cos(a - Math.PI / 2)
        const y = cy + r * Math.sin(a - Math.PI / 2)
        if (n === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      g.stroke()
      if (kick > 0.69) ripples.push({ x: cx, y: cy, r: core, life: 0.8, color: HOT })
    }

    g.globalCompositeOperation = add

    // embers rise slowly across the page
    if (!reduce) {
      for (const e of embers) {
        e.y -= e.vy
        e.drift += 0.01
        e.x += Math.sin(e.drift) * 0.25
        if (e.y < -10) Object.assign(e, ember(false))
        g.fillStyle = rgba(e.c, e.a * k * (0.7 + 0.3 * Math.sin(now / 400 + e.drift * 5)))
        g.beginPath()
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        g.fill()
      }
    }

    for (let n = ripples.length - 1; n >= 0; n -= 1) {
      const rp = ripples[n]
      rp.r += 3.2
      rp.life -= 0.022
      if (rp.life <= 0) {
        ripples.splice(n, 1)
        continue
      }
      g.strokeStyle = rgba(rp.color, rp.life * 0.7 * k)
      g.lineWidth = 2 * rp.life + 0.5
      g.beginPath()
      g.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
      g.stroke()
    }

    for (let n = sparks.length - 1; n >= 0; n -= 1) {
      const s = sparks[n]
      s.x += s.vx
      s.y += s.vy
      s.vx *= 0.97
      s.vy *= 0.97
      s.life -= 0.02
      if (s.life <= 0) {
        sparks.splice(n, 1)
        continue
      }
      g.fillStyle = rgba(s.color, s.life * k)
      g.beginPath()
      g.arc(s.x, s.y, 1.6 + s.life * 1.4, 0, Math.PI * 2)
      g.fill()
    }
    g.globalCompositeOperation = 'source-over'

    // with reduced motion, draw only when something changed
    if (!reduce || ripples.length || dy) wakeUp()
  }

  function wakeUp() {
    if (running || document.hidden) return
    running = true
    requestAnimationFrame(frame)
  }

  // a tap anywhere sends out a ripple and sparks
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      burst(e.clientX, e.clientY)
    },
    { passive: true },
  )

  // touching a song in the orbit throws sparks outward from it
  const touched = new WeakMap()
  document.addEventListener('pointerover', (e) => {
    const node = e.target.closest?.('.node-out, .node-studio')
    if (!node) return
    const at = performance.now()
    if (at - (touched.get(node) || 0) < 600) return
    touched.set(node, at)
    const r = node.getBoundingClientRect()
    const o = orbitGeo()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const studio = node.classList.contains('node-studio')
    burst(x, y, { angle: o ? Math.atan2(y - o.cy, x - o.cx) : null, ring: r.width / 2, color: studio ? HOT : GOLD })
  })

  // a song starting sends a wave out of the orbit's centre
  if (orbit && 'MutationObserver' in window) {
    let was = orbit.classList.contains('is-playing')
    new MutationObserver(() => {
      const is = orbit.classList.contains('is-playing')
      if (is && !was) {
        const o = orbitGeo()
        if (o) {
          kick = 1
          burst(o.cx, o.cy, { count: 28, ring: o.w * 0.28, color: HOT })
        }
      }
      was = is
    }).observe(orbit, { attributes: true, attributeFilter: ['class'] })
  }

  // a new theme repaints the stage at once
  new MutationObserver(size).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  window.addEventListener('resize', size)
  window.addEventListener('scroll', wakeUp, { passive: true })
  document.addEventListener('visibilitychange', wakeUp)
  size()
  wakeUp()
})()
