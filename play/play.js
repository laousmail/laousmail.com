/* ORBIT · a playable by laousmail.
   Sound: 15 plucked strings (Karplus-Strong, rendered once into buffers) in
   D Hijaz, a synthesized bendir (dum / tek), an optional drone and a 6/8
   pulse, through echo and a generated reverb. Image: a canvas that draws the
   sound — a circular waveform, ripples and sparks for every note, and a
   centre glow that breathes with the low end. Takes can be recorded and
   downloaded. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ——— Language (shared with the main site) ——— */
  const lang = () => (document.documentElement.lang === 'fr' ? 'fr' : 'en')
  const t = (en, fr) => (lang() === 'fr' ? fr : en)

  function setLang(next) {
    document.documentElement.lang = next === 'fr' ? 'fr' : 'en'
    try {
      localStorage.setItem('laousmail-lang', document.documentElement.lang)
    } catch {
      /* private mode */
    }
    $$('[data-lang-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang())))
    renderRecLabel()
    layout()
  }

  /* ——— Notes: D Hijaz across two octaves, one per song ——— */
  const HIJAZ = [0, 1, 4, 5, 7, 8, 10]
  const NAMES = ['D', 'E♭', 'F♯', 'G', 'A', 'B♭', 'C']
  const ROOT = 50 // D3
  const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', 'q', 'w', 'e', 'r', 't']
  const NOTES = Array.from({ length: 15 }, (_, i) => {
    const midi = ROOT + 12 * Math.floor(i / 7) + HIJAZ[i % 7]
    return { midi, freq: 440 * Math.pow(2, (midi - 69) / 12), name: NAMES[i % 7], key: KEYS[i] }
  })

  // Songs out and the song in the studio, from the main site's data when available
  const released = 3
  const studio = 4

  /* ——— Audio ——— */
  let ac = null
  let bus, revSend, delaySend, master, analyser, recDest
  let plucks = []
  let noise = null
  let drone = null
  let pulseTimer = 0
  let nextStep = 0
  let step = 0
  const PULSE = ['D', '', 'T', 'D', 'T', '', 'D', '', 'T', '', 'T', 'T']
  const BPM = 104

  function makeImpulse(seconds, decay) {
    const len = Math.floor(ac.sampleRate * seconds)
    const buf = ac.createBuffer(2, len, ac.sampleRate)
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  // A plucked string, rendered once: a burst of filtered noise looping through a decaying delay line
  function pluckBuffer(freq) {
    const sr = ac.sampleRate
    const period = sr / freq
    const n = Math.max(2, Math.round(period))
    const len = Math.floor(sr * (freq < 200 ? 3.2 : 2.4))
    const buf = ac.createBuffer(1, len, sr)
    const out = buf.getChannelData(0)
    const line = new Float32Array(n)
    let prev = 0
    for (let i = 0; i < n; i += 1) {
      const r = Math.random() * 2 - 1
      prev = prev * 0.45 + r * 0.55 // soften the attack a little
      line[i] = prev
    }
    const damp = freq < 200 ? 0.9985 : 0.9965
    let idx = 0
    for (let i = 0; i < len; i += 1) {
      const next = (idx + 1) % n
      const v = damp * 0.5 * (line[idx] + line[next])
      out[i] = line[idx]
      line[idx] = v
      idx = next
    }
    // gentle fade-out and level
    const fade = Math.floor(sr * 0.25)
    for (let i = 0; i < fade; i += 1) out[len - 1 - i] *= i / fade
    return buf
  }

  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext
    ac = new AC({ latencyHint: 'interactive' })

    master = ac.createGain()
    master.gain.value = 0.9
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.2
    master.connect(comp)
    comp.connect(ac.destination)

    analyser = ac.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.82
    comp.connect(analyser)

    if (typeof ac.createMediaStreamDestination === 'function') {
      recDest = ac.createMediaStreamDestination()
      comp.connect(recDest)
    }

    // Dry bus, a hall reverb and a soft echo
    bus = ac.createGain()
    bus.connect(master)

    const reverb = ac.createConvolver()
    reverb.buffer = makeImpulse(3.2, 2.6)
    const revGain = ac.createGain()
    revGain.gain.value = 0.32
    reverb.connect(revGain)
    revGain.connect(master)
    revSend = ac.createGain()
    revSend.gain.value = 1
    revSend.connect(reverb)

    const delay = ac.createDelay(2)
    delay.delayTime.value = (60 / BPM) * 1.5 // a dotted quarter, in time with the 6/8 pulse
    const fb = ac.createGain()
    fb.gain.value = 0.3
    const tone = ac.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2400
    delay.connect(tone)
    tone.connect(fb)
    fb.connect(delay)
    const delayOut = ac.createGain()
    delayOut.gain.value = 0.22
    tone.connect(delayOut)
    delayOut.connect(master)
    delaySend = ac.createGain()
    delaySend.connect(delay)

    plucks = NOTES.map((n) => pluckBuffer(n.freq))

    const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1
    noise = nb
  }

  function voiceOut(pan, rev = 0.5, echo = 0.25) {
    const g = ac.createGain()
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null
    if (p) {
      p.pan.value = pan
      g.connect(p)
      p.connect(bus)
    } else {
      g.connect(bus)
    }
    const rs = ac.createGain()
    rs.gain.value = rev
    g.connect(rs)
    rs.connect(revSend)
    const ds = ac.createGain()
    ds.gain.value = echo
    g.connect(ds)
    ds.connect(delaySend)
    return g
  }

  function playNote(i, velocity = 0.9) {
    if (!ac) return
    const geo = padGeo[i]
    const src = ac.createBufferSource()
    src.buffer = plucks[i]
    src.detune.value = (Math.random() - 0.5) * 8 // strings are never perfectly in tune
    const out = voiceOut(geo ? Math.max(-0.8, Math.min(0.8, geo.dx)) : 0)
    out.gain.value = 0.55 * velocity
    src.connect(out)
    src.start()
    src.onended = () => out.disconnect()
    flashPad(i)
    burst(i)
  }

  function bendir(kind, when = 0, quiet = false) {
    if (!ac) return
    const t0 = when || ac.currentTime
    const dum = kind === 'D'
    const out = voiceOut(0, dum ? 0.35 : 0.25, dum ? 0.12 : 0.2)
    out.gain.value = quiet ? 0.55 : 0.9

    // the skin
    const osc = ac.createOscillator()
    osc.type = 'sine'
    const env = ac.createGain()
    osc.frequency.setValueAtTime(dum ? 118 : 290, t0)
    osc.frequency.exponentialRampToValueAtTime(dum ? 48 : 180, t0 + (dum ? 0.22 : 0.09))
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(dum ? 1 : 0.5, t0 + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + (dum ? 0.55 : 0.16))
    osc.connect(env)
    env.connect(out)
    osc.start(t0)
    osc.stop(t0 + 0.6)

    // the snares stretched under the skin
    const n = ac.createBufferSource()
    n.buffer = noise
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = dum ? 1900 : 3600
    bp.Q.value = 0.9
    const ne = ac.createGain()
    ne.gain.setValueAtTime(0.0001, t0)
    ne.gain.exponentialRampToValueAtTime(dum ? 0.28 : 0.42, t0 + 0.003)
    ne.gain.exponentialRampToValueAtTime(0.0001, t0 + (dum ? 0.32 : 0.12))
    n.connect(bp)
    bp.connect(ne)
    ne.connect(out)
    n.start(t0, Math.random() * 0.5)
    n.stop(t0 + 0.4)
    osc.onended = () => out.disconnect()

    const delayMs = Math.max(0, (t0 - ac.currentTime) * 1000)
    window.setTimeout(() => {
      hitCore(dum)
      if (!quiet) {
        const b = $('[data-bendir]')
        b?.classList.toggle('is-rim', !dum)
        b?.classList.add('is-hit')
        window.setTimeout(() => b?.classList.remove('is-hit', 'is-rim'), 120)
      }
    }, delayMs)
  }

  function setDrone(on) {
    if (!ac) return
    if (on && !drone) {
      const out = voiceOut(0, 0.6, 0)
      out.gain.value = 0
      const lp = ac.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 520
      lp.Q.value = 2
      const lfo = ac.createOscillator()
      lfo.frequency.value = 0.07
      const lfoAmt = ac.createGain()
      lfoAmt.gain.value = 260
      lfo.connect(lfoAmt)
      lfoAmt.connect(lp.frequency)
      const oscs = [36.71, 73.42, 110, 110.6].map((f, k) => {
        const o = ac.createOscillator()
        o.type = k < 2 ? 'sawtooth' : 'triangle'
        o.frequency.value = f
        const g = ac.createGain()
        g.gain.value = [0.5, 0.35, 0.25, 0.25][k]
        o.connect(g)
        g.connect(lp)
        o.start()
        return o
      })
      lp.connect(out)
      lfo.start()
      out.gain.setTargetAtTime(0.16, ac.currentTime, 0.8)
      drone = { out, oscs, lfo }
    } else if (!on && drone) {
      const d = drone
      drone = null
      d.out.gain.setTargetAtTime(0, ac.currentTime, 0.4)
      window.setTimeout(() => {
        d.oscs.forEach((o) => o.stop())
        d.lfo.stop()
        d.out.disconnect()
      }, 2500)
    }
  }

  // 6/8 pulse on the bendir, scheduled slightly ahead so it never drifts
  function setPulse(on) {
    if (!ac) return
    window.clearInterval(pulseTimer)
    pulseTimer = 0
    if (!on) return
    const stepDur = 60 / BPM / 2 // eighth notes
    nextStep = ac.currentTime + 0.08
    step = 0
    pulseTimer = window.setInterval(() => {
      while (nextStep < ac.currentTime + 0.12) {
        const hit = PULSE[step % PULSE.length]
        if (hit) bendir(hit, nextStep, true)
        nextStep += stepDur
        step += 1
      }
    }, 25)
  }

  /* ——— Recording a take ——— */
  let recorder = null
  let chunks = []
  let recStart = 0
  let recTick = 0
  let takeUrl = ''

  function recMime() {
    if (!window.MediaRecorder) return ''
    return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
  }

  function renderRecLabel() {
    const label = $('[data-rec-label]')
    if (!label) return
    if (recorder) {
      const s = Math.floor((performance.now() - recStart) / 1000)
      label.textContent = `${t('Stop', 'Stop')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    } else {
      label.textContent = t('Record', 'Enregistrer')
    }
    const take = $('[data-take]')
    if (take && takeUrl && !recorder) {
      take.hidden = false
      take.innerHTML = ''
      const a = document.createElement('a')
      a.href = takeUrl
      a.download = take.dataset.name || 'laousmail-orbit-take'
      a.textContent = t('Download your take', 'Télécharger ta prise')
      take.append(a)
    }
  }

  function toggleRecord() {
    const btn = $('[data-rec]')
    if (!ac || !recDest || !recMime()) {
      status(t('Recording is not supported in this browser.', 'L’enregistrement n’est pas pris en charge par ce navigateur.'))
      return
    }
    if (recorder) {
      recorder.stop()
      return
    }
    const mime = recMime()
    chunks = []
    recorder = new MediaRecorder(recDest.stream, { mimeType: mime })
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] })
      if (takeUrl) URL.revokeObjectURL(takeUrl)
      takeUrl = URL.createObjectURL(blob)
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
      const d = new Date()
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
      $('[data-take]').dataset.name = `laousmail-orbit-take-${stamp}.${ext}`
      recorder = null
      window.clearInterval(recTick)
      btn.setAttribute('aria-pressed', 'false')
      renderRecLabel()
      status(t('Take recorded. Download link ready.', 'Prise enregistrée. Lien de téléchargement prêt.'))
    }
    recorder.start()
    recStart = performance.now()
    btn.setAttribute('aria-pressed', 'true')
    recTick = window.setInterval(() => {
      renderRecLabel()
      if (performance.now() - recStart > 5 * 60 * 1000) recorder?.stop() // five minutes max
    }, 250)
    renderRecLabel()
    status(t('Recording.', 'Enregistrement.'))
  }

  function status(msg) {
    const s = $('[data-status]')
    if (s) s.textContent = msg
  }

  /* ——— Layout: the ring of pads ——— */
  const ring = $('[data-ring]')
  let padGeo = []
  let geo = { cx: 0, cy: 0, R: 100, pad: 56, core: 150, W: 0, H: 0 }

  function buildPads() {
    ring.innerHTML = ''
    NOTES.forEach((n, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'pad'
      if (i < released) b.classList.add('is-out')
      if (i === studio - 1) b.classList.add('is-studio')
      b.dataset.i = String(i)
      b.innerHTML = `<b>${n.name}</b><small>${n.key.toUpperCase()}</small>`
      ring.append(b)
    })
  }

  function layout() {
    const W = window.innerWidth
    const H = window.innerHeight
    const small = W <= 700
    const top = small ? 128 : 76
    const bottom = small ? 92 : 86
    const avail = H - top - bottom
    const cx = W / 2
    const cy = top + avail / 2
    let R = Math.min(W * (small ? 0.4 : 0.36), avail / 2 - 40)
    R = Math.max(R, 110)
    const pad = Math.round(Math.max(44, Math.min(68, R * 0.3)))
    const core = Math.round(Math.max(96, (R - pad / 2 - 18) * 2 * 0.78))
    geo = { cx, cy, R, pad, core, W, H }
    document.documentElement.style.setProperty('--pad', `${pad}px`)
    document.documentElement.style.setProperty('--core', `${core}px`)
    const stage = $('[data-stage]')
    $$('.pad', ring).forEach((b, i) => {
      const a = (Math.PI * 2 * i) / 15 - Math.PI / 2
      const x = cx + R * Math.cos(a)
      const y = cy + R * Math.sin(a)
      padGeo[i] = { x, y, a, dx: Math.cos(a) }
      b.style.left = `${x}px`
      b.style.top = `${y}px`
      b.setAttribute('aria-label', `${NOTES[i].name} · ${t('song', 'chanson')} ${i + 1}${i < released ? t(' (out)', ' (sortie)') : i === studio - 1 ? t(' (in the studio)', ' (en studio)') : ''}`)
    })
    const drum = $('[data-bendir]')
    drum.style.left = `${cx}px`
    drum.style.top = `${cy}px`
    stage.style.setProperty('--cx', `${cx}px`)
    sizeCanvas()
  }

  function flashPad(i) {
    const b = ring.children[i]
    if (!b) return
    b.classList.add('is-hit')
    window.setTimeout(() => b.classList.remove('is-hit'), 140)
  }

  /* ——— Input: tap, drag-to-strum (multi-touch), keyboard ——— */
  const lastPad = new Map()

  function padAt(x, y) {
    const el = document.elementFromPoint(x, y)
    const pad = el?.closest?.('.pad')
    return pad ? Number(pad.dataset.i) : -1
  }

  function initInput() {
    const stage = $('[data-stage]')
    stage.addEventListener('pointerdown', (e) => {
      if (!ac) return
      const drum = e.target.closest('[data-bendir]')
      if (drum) {
        // like a real bendir: the centre gives dum, the rim gives tek
        const r = drum.getBoundingClientRect()
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
        bendir(d > (r.width / 2) * 0.62 ? 'T' : 'D')
        return
      }
      const i = padAt(e.clientX, e.clientY)
      lastPad.set(e.pointerId, i)
      stage.setPointerCapture?.(e.pointerId)
      if (i >= 0) {
        e.preventDefault()
        playNote(i, e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure / 2 : 0.9)
      }
    })
    stage.addEventListener('pointermove', (e) => {
      if (!lastPad.has(e.pointerId)) return
      const i = padAt(e.clientX, e.clientY)
      if (i >= 0 && i !== lastPad.get(e.pointerId)) playNote(i, 0.75)
      lastPad.set(e.pointerId, i)
    })
    const end = (e) => lastPad.delete(e.pointerId)
    stage.addEventListener('pointerup', end)
    stage.addEventListener('pointercancel', end)

    // keyboard activation of the buttons themselves (Enter / Space while focused)
    stage.addEventListener('click', (e) => {
      if (e.detail !== 0 || !ac) return
      const pad = e.target.closest('.pad')
      if (pad) playNote(Number(pad.dataset.i))
      else if (e.target.closest('[data-bendir]')) bendir('D')
    })

    window.addEventListener('keydown', (e) => {
      if (!ac || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target.closest?.('button') && (e.key === 'Enter' || e.key === ' ')) return
      const k = e.key.toLowerCase()
      const i = KEYS.indexOf(k)
      if (i >= 0) {
        e.preventDefault()
        playNote(i)
      } else if (k === ' ') {
        e.preventDefault()
        bendir('D')
      } else if (k === 'b') {
        bendir('T')
      }
    })
  }

  /* ——— Image: the canvas draws the sound ——— */
  const canvas = $('[data-field]')
  const g = canvas.getContext('2d')
  let dpr = 1
  const ripples = []
  const sparks = []
  let coreKick = 0
  let wave = null
  let freqs = null
  let spin = 0

  function sizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(geo.W * dpr)
    canvas.height = Math.floor(geo.H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#070605'
    g.fillRect(0, 0, geo.W, geo.H)
  }

  function burst(i) {
    const p = padGeo[i]
    if (!p) return
    const studioPad = i === studio - 1
    const color = studioPad ? [255, 106, 19] : i < released ? [255, 179, 71] : [255, 214, 160]
    ripples.push({ x: p.x, y: p.y, r: geo.pad / 2, life: 1, color })
    const count = reduceMotion ? 0 : 16
    for (let k = 0; k < count; k += 1) {
      // sparks fly outward from the ring, away from the centre
      const spread = p.a + (Math.random() - 0.5) * 1.2
      const speed = 1.2 + Math.random() * 3.4
      sparks.push({ x: p.x, y: p.y, vx: Math.cos(spread) * speed, vy: Math.sin(spread) * speed, life: 1, color })
    }
  }

  function hitCore(dum) {
    coreKick = Math.max(coreKick, dum ? 1 : 0.55)
    ripples.push({ x: geo.cx, y: geo.cy, r: geo.core / 2, life: 1, color: dum ? [255, 140, 60] : [255, 214, 160], core: true })
  }

  function rgba(c, a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`
  }

  function frame() {
    const { W, H, cx, cy, R } = geo
    // trails: paint over with a little black instead of clearing
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = reduceMotion ? '#070605' : 'rgba(7,6,5,0.2)'
    g.fillRect(0, 0, W, H)

    let low = 0
    if (analyser) {
      if (!wave) {
        wave = new Uint8Array(analyser.fftSize)
        freqs = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteTimeDomainData(wave)
      analyser.getByteFrequencyData(freqs)
      for (let k = 1; k < 10; k += 1) low += freqs[k]
      low /= 9 * 255
    }

    // the centre breathes with the low end and kicks with the bendir.
    // Painted normally (not added), so it settles at a warm level instead of piling up.
    coreKick *= 0.9
    const glowR = geo.core * (0.6 + Math.min(low, 0.6) * 0.5 + coreKick * 0.35)
    const cg = g.createRadialGradient(cx, cy, 0, cx, cy, glowR)
    cg.addColorStop(0, `rgba(255,120,40,${0.05 + Math.min(low, 0.6) * 0.12 + coreKick * 0.16})`)
    cg.addColorStop(1, 'rgba(255,120,40,0)')
    g.fillStyle = cg
    g.beginPath()
    g.arc(cx, cy, glowR, 0, Math.PI * 2)
    g.fill()

    g.globalCompositeOperation = 'lighter'

    // the ring and a slowly turning crown of ticks
    spin += reduceMotion ? 0 : 0.0012
    g.strokeStyle = 'rgba(242,233,221,0.08)'
    g.lineWidth = 1
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,179,71,0.18)'
    for (let k = 0; k < 90; k += 1) {
      const a = spin + (k / 90) * Math.PI * 2
      const r1 = R + geo.pad * 0.75
      const r2 = r1 + (k % 6 === 0 ? 9 : 4)
      g.beginPath()
      g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a))
      g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a))
      g.stroke()
    }

    // the sound itself, drawn as a circle between the drum and the strings
    if (wave) {
      const base = (geo.core / 2 + (R - geo.pad / 2)) / 2
      const amp = (R - geo.pad / 2 - geo.core / 2) * 0.55
      g.strokeStyle = `rgba(255,179,71,${0.35 + low * 0.5})`
      g.lineWidth = 1.6
      g.beginPath()
      const n = wave.length
      for (let k = 0; k <= n; k += 2) {
        const v = (wave[k % n] - 128) / 128
        const a = (k / n) * Math.PI * 2 - Math.PI / 2
        const r = base + v * amp
        const x = cx + r * Math.cos(a)
        const y = cy + r * Math.sin(a)
        if (k === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      g.stroke()
    }

    // ripples from every note and drum hit
    for (let k = ripples.length - 1; k >= 0; k -= 1) {
      const rp = ripples[k]
      rp.r += rp.core ? 5 : 3.2
      rp.life -= rp.core ? 0.03 : 0.022
      if (rp.life <= 0) {
        ripples.splice(k, 1)
        continue
      }
      g.strokeStyle = rgba(rp.color, rp.life * 0.7)
      g.lineWidth = 2 * rp.life + 0.5
      g.beginPath()
      g.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
      g.stroke()
    }

    // sparks
    for (let k = sparks.length - 1; k >= 0; k -= 1) {
      const s = sparks[k]
      s.x += s.vx
      s.y += s.vy
      s.vx *= 0.97
      s.vy *= 0.97
      s.life -= 0.02
      if (s.life <= 0) {
        sparks.splice(k, 1)
        continue
      }
      g.fillStyle = rgba(s.color, s.life)
      g.beginPath()
      g.arc(s.x, s.y, 1.6 + s.life * 1.4, 0, Math.PI * 2)
      g.fill()
    }

    requestAnimationFrame(frame)
  }

  /* ——— iOS: play through the silent switch ——— */
  function unlockIOS() {
    try {
      const a = document.createElement('audio')
      a.setAttribute('playsinline', '')
      a.loop = true
      // a tiny silent WAV keeps the audio session in "playback" mode
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      a.volume = 0
      a.play().catch(() => {})
    } catch {
      /* not needed elsewhere */
    }
  }

  /* ——— Start ——— */
  function begin() {
    if (ac) return
    unlockIOS()
    initAudio()
    ac.resume?.()
    $('[data-start]').classList.add('is-gone')
    // a first chord so the room answers straight away
    ;[0, 4, 7].forEach((i, k) => window.setTimeout(() => playNote(i, 0.6), 120 + k * 140))
    status(t('Ready. Play the ring.', 'Prêt. Joue l’anneau.'))
  }

  function init() {
    let start = 'en'
    try {
      start = localStorage.getItem('laousmail-lang') === 'fr' ? 'fr' : 'en'
    } catch {
      /* private mode */
    }
    buildPads()
    setLang(start)
    $$('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)))
    $('[data-begin]').addEventListener('click', begin)
    $('[data-drone]').addEventListener('click', (e) => {
      begin()
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'
      e.currentTarget.setAttribute('aria-pressed', String(on))
      setDrone(on)
    })
    $('[data-pulse]').addEventListener('click', (e) => {
      begin()
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'
      e.currentTarget.setAttribute('aria-pressed', String(on))
      setPulse(on)
    })
    $('[data-rec]').addEventListener('click', () => {
      begin()
      toggleRecord()
    })
    initInput()
    window.addEventListener('resize', layout)
    document.addEventListener('visibilitychange', () => {
      if (!ac) return
      if (document.hidden && !recorder) ac.suspend?.()
      else ac.resume?.()
    })
    requestAnimationFrame(frame)
  }

  init()
})()
