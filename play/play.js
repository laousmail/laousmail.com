/* ORBIT · Studio — a playable by laousmail.
   An instrument and a small looping studio in one page.

   Sound: 15 plucked strings (Karplus-Strong, rendered once) in D Hijaz, a
   synthesized bendir (dum / tek), a drone and a bendir groove, through echo
   and a generated reverb. The same engine runs live and offline, so a bounce
   sounds exactly like playback.

   Studio: a transport with count-in and click; four patterns (A–D), each a
   loop that records your playing into layers (overdub, mute, delete, undo,
   quantize); an arrangement that chains patterns into a song; a mixer; WAV
   bounce of the song or a seamless loop; projects that autosave and can be
   saved / opened as files.

   Image: the canvas draws the sound (waveform, ripples, sparks, a breathing
   centre) and, while the transport runs, the ring becomes a circular piano
   roll: time is the angle, pitch the distance from the centre. */
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
    renderAll()
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
  const released = 3
  const studio = 4

  const PATTERN_IDS = ['A', 'B', 'C', 'D']
  const PATTERN_COLORS = { A: '#ffb347', B: '#ff6a13', C: '#8fd3ff', D: '#c9a7ff' }
  const LAYER_COLORS = ['#ffb347', '#ff8a3d', '#ff8fa3', '#8fd3ff', '#c9a7ff', '#9ef0b6', '#ffe08a', '#7fe0d6']
  // bendir grooves, one bar of eighth notes
  const GROOVES = { '6/8': ['D', '', 'T', 'D', 'T', ''], '4/4': ['D', '', 'T', '', 'D', 'D', 'T', ''] }

  /* ——— The project (autosaved on this device) ——— */
  const STORE = 'laousmail-orbit-project-v1'

  function blankProject() {
    const patterns = {}
    PATTERN_IDS.forEach((id) => (patterns[id] = { layers: [], drone: false, groove: false }))
    patterns.A.drone = true
    return {
      v: 1,
      bpm: 104,
      meter: '6/8',
      bars: 2,
      quant: 0.25,
      click: true,
      song: false,
      current: 'A',
      patterns,
      arrangement: [],
      mix: { master: 0.9, strings: 0.85, bendir: 0.9, groove: 0.7, drone: 0.7, click: 0.5 },
      nextLayer: 1,
    }
  }

  const clamp = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d)

  // Accept only what ORBIT understands, so a damaged or foreign file can't break the page
  function sanitize(raw) {
    const p = blankProject()
    if (!raw || typeof raw !== 'object') return p
    p.bpm = Math.round(clamp(raw.bpm, 60, 160, 104))
    p.meter = raw.meter === '4/4' ? '4/4' : '6/8'
    p.bars = [1, 2, 4].includes(+raw.bars) ? +raw.bars : 2
    p.quant = [0, 0.5, 0.25].includes(+raw.quant) ? +raw.quant : 0.25
    p.click = raw.click !== false
    p.song = !!raw.song
    p.current = PATTERN_IDS.includes(raw.current) ? raw.current : 'A'
    p.nextLayer = Math.max(1, Math.floor(clamp(raw.nextLayer, 1, 1e6, 1)))
    for (const key of Object.keys(p.mix)) p.mix[key] = clamp(raw.mix?.[key], 0, 1, p.mix[key])
    for (const id of PATTERN_IDS) {
      const src = raw.patterns?.[id]
      if (!src) continue
      p.patterns[id].drone = !!src.drone
      p.patterns[id].groove = !!src.groove
      p.patterns[id].layers = (Array.isArray(src.layers) ? src.layers : []).slice(0, 32).map((l, n) => ({
        id: String(l?.id ?? `L${n}`).slice(0, 24),
        name: String(l?.name ?? '').slice(0, 40),
        color: /^#[0-9a-f]{6}$/i.test(l?.color) ? l.color : LAYER_COLORS[n % LAYER_COLORS.length],
        mute: !!l?.mute,
        events: (Array.isArray(l?.events) ? l.events : []).slice(0, 2000).flatMap((e) => {
          const tt = clamp(e?.t, 0, 16, -1)
          const v = clamp(e?.v, 0.05, 1, 0.9)
          if (tt < 0) return []
          if (e.type === 'n' && Number.isInteger(e.i) && e.i >= 0 && e.i < 15) return [{ t: tt, type: 'n', i: e.i, v }]
          if (e.type === 'd' && (e.k === 'D' || e.k === 'T')) return [{ t: tt, type: 'd', k: e.k, v }]
          return []
        }),
      }))
    }
    p.arrangement = (Array.isArray(raw.arrangement) ? raw.arrangement : []).filter((id) => PATTERN_IDS.includes(id)).slice(0, 64)
    return p
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE)
      return raw ? sanitize(JSON.parse(raw)) : null
    } catch {
      return null
    }
  }

  // underscore keys (like the "recorded this pass" marker) never leave the page
  const serialize = (p) => JSON.stringify(p, (k, v) => (k.startsWith('_') ? undefined : v))

  let saveTimer = 0
  function save() {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE, serialize(proj))
      } catch {
        /* storage full or private mode: the project just isn't kept */
      }
    }, 300)
  }

  let proj = load() || blankProject()
  const history = [] // layers created, newest last, for undo

  /* ——— Sound ——— */
  let ac = null
  let engine = null
  let analyser = null
  let plucks = null
  let noiseBuf = null

  // A plucked string, rendered once: filtered noise looping through a decaying delay line
  function pluckBuffer(ctx, freq) {
    const sr = ctx.sampleRate
    const n = Math.max(2, Math.round(sr / freq))
    const len = Math.floor(sr * (freq < 200 ? 3.2 : 2.4))
    const buf = ctx.createBuffer(1, len, sr)
    const out = buf.getChannelData(0)
    const line = new Float32Array(n)
    let prev = 0
    for (let i = 0; i < n; i += 1) {
      prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55
      line[i] = prev
    }
    const damp = freq < 200 ? 0.9985 : 0.9965
    let idx = 0
    for (let i = 0; i < len; i += 1) {
      const next = (idx + 1) % n
      out[i] = line[idx]
      line[idx] = damp * 0.5 * (line[idx] + line[next])
      idx = next
    }
    const fade = Math.floor(sr * 0.25)
    for (let i = 0; i < fade; i += 1) out[len - 1 - i] *= i / fade
    return buf
  }

  function impulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  /* One engine for live play and for offline bounces.
     Each instrument has its own fader; reverb and echo are fed after the faders. */
  function createEngine(ctx, dest, live) {
    const at = (when) => Math.max(when || 0, ctx.currentTime)

    const master = ctx.createGain()
    master.gain.value = proj.mix.master
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 18
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.2
    master.connect(comp)
    comp.connect(dest)

    const bus = ctx.createGain()
    bus.connect(master)

    const reverb = ctx.createConvolver()
    reverb.buffer = impulse(ctx, 3.2, 2.6)
    const revOut = ctx.createGain()
    revOut.gain.value = 0.32
    reverb.connect(revOut)
    revOut.connect(master)

    const delay = ctx.createDelay(4)
    delay.delayTime.value = (60 / proj.bpm) * 1.5
    const fb = ctx.createGain()
    fb.gain.value = 0.3
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2400
    delay.connect(tone)
    tone.connect(fb)
    fb.connect(delay)
    const delayOut = ctx.createGain()
    delayOut.gain.value = 0.22
    tone.connect(delayOut)
    delayOut.connect(master)

    // instrument faders, each with its own reverb and echo amount
    const sends = { strings: [0.5, 0.25], bendir: [0.35, 0.12], groove: [0.3, 0.1], drone: [0.6, 0] }
    const inst = {}
    for (const [name, [rv, ec]] of Object.entries(sends)) {
      const g = ctx.createGain()
      g.gain.value = proj.mix[name]
      g.connect(bus)
      const r = ctx.createGain()
      r.gain.value = rv
      g.connect(r)
      r.connect(reverb)
      if (ec) {
        const d = ctx.createGain()
        d.gain.value = ec
        g.connect(d)
        d.connect(delay)
      }
      inst[name] = g
    }

    function voice(target, pan) {
      const g = ctx.createGain()
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner()
        p.pan.value = pan
        g.connect(p)
        p.connect(inst[target])
      } else {
        g.connect(inst[target])
      }
      return g
    }

    function pluck(i, when, vel = 0.9, pan = 0) {
      const t0 = at(when)
      const src = ctx.createBufferSource()
      src.buffer = plucks[i]
      if (src.detune) src.detune.value = (Math.random() - 0.5) * 8 // strings are never perfectly in tune
      const out = voice('strings', Math.max(-0.8, Math.min(0.8, pan)))
      out.gain.value = 0.55 * vel
      src.connect(out)
      src.start(t0)
      src.onended = () => out.disconnect()
    }

    function drum(kind, when, vel = 0.9, target = 'bendir') {
      const t0 = at(when)
      const dum = kind === 'D'
      const out = voice(target, 0)
      out.gain.value = vel
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const env = ctx.createGain()
      osc.frequency.setValueAtTime(dum ? 118 : 290, t0)
      osc.frequency.exponentialRampToValueAtTime(dum ? 48 : 180, t0 + (dum ? 0.22 : 0.09))
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.exponentialRampToValueAtTime(dum ? 1 : 0.5, t0 + 0.004)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + (dum ? 0.55 : 0.16))
      osc.connect(env)
      env.connect(out)
      osc.start(t0)
      osc.stop(t0 + 0.6)
      const n = ctx.createBufferSource()
      n.buffer = noiseBuf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = dum ? 1900 : 3600
      bp.Q.value = 0.9
      const ne = ctx.createGain()
      ne.gain.setValueAtTime(0.0001, t0)
      ne.gain.exponentialRampToValueAtTime(dum ? 0.28 : 0.42, t0 + 0.003)
      ne.gain.exponentialRampToValueAtTime(0.0001, t0 + (dum ? 0.32 : 0.12))
      n.connect(bp)
      bp.connect(ne)
      ne.connect(out)
      n.start(t0, Math.random() * 0.5)
      n.stop(t0 + 0.4)
      osc.onended = () => out.disconnect()
    }

    // the drone runs from the start and is opened or closed per pattern
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    lp.Q.value = 2
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoAmt = ctx.createGain()
    lfoAmt.gain.value = 260
    lfo.connect(lfoAmt)
    lfoAmt.connect(lp.frequency)
    lfo.start(0)
    ;[36.71, 73.42, 110, 110.6].forEach((f, k) => {
      const o = ctx.createOscillator()
      o.type = k < 2 ? 'sawtooth' : 'triangle'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = [0.5, 0.35, 0.25, 0.25][k]
      o.connect(g)
      g.connect(lp)
      o.start(0)
    })
    lp.connect(droneGain)
    droneGain.connect(inst.drone)

    function gate(on, when) {
      droneGain.gain.setTargetAtTime(on ? 0.16 : 0, at(when), on ? 0.6 : 0.35)
    }

    // the click goes straight to the speakers: never into the mix, the visuals or a bounce
    const clickGain = ctx.createGain()
    clickGain.gain.value = proj.mix.click
    if (live) clickGain.connect(ctx.destination)

    function click(when, accent) {
      if (!live) return
      const t0 = at(when)
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = accent ? 1760 : 1175
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, t0 + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
      o.connect(g)
      g.connect(clickGain)
      o.start(t0)
      o.stop(t0 + 0.06)
    }

    function setMix(m) {
      const now = ctx.currentTime
      master.gain.setTargetAtTime(m.master, now, 0.03)
      for (const name of Object.keys(inst)) inst[name].gain.setTargetAtTime(m[name], now, 0.03)
      clickGain.gain.setTargetAtTime(m.click, now, 0.03)
    }

    function setTempo(bpm) {
      delay.delayTime.setTargetAtTime((60 / bpm) * 1.5, ctx.currentTime, 0.05)
    }

    return { pluck, drum, gate, click, setMix, setTempo, out: comp }
  }

  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext
    ac = new AC({ latencyHint: 'interactive' })
    plucks = NOTES.map((n) => pluckBuffer(ac, n.freq))
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1
    engine = createEngine(ac, ac.destination, true)
    analyser = ac.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.82
    engine.out.connect(analyser)
  }

  /* ——— Keeping the sound on (iPhone silent switch, paused audio) ——— */
  let keepAlive = null

  // A real, half-second silent WAV, looped: while an <audio> element plays,
  // iOS routes web audio through the speaker even with the silent switch on.
  function silentWav() {
    const rate = 8000
    const n = rate / 2
    const buf = new ArrayBuffer(44 + n)
    const v = new DataView(buf)
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
    str(36, 'data'); v.setUint32(40, n, true)
    for (let i = 0; i < n; i += 1) v.setUint8(44 + i, 128)
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  }

  function keepSoundOn() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'
    } catch {
      /* older browsers */
    }
    try {
      if (!keepAlive) {
        keepAlive = document.createElement('audio')
        keepAlive.setAttribute('playsinline', '')
        keepAlive.setAttribute('x-webkit-airplay', 'deny')
        keepAlive.loop = true
        keepAlive.preload = 'auto'
        keepAlive.src = silentWav()
      }
      if (keepAlive.paused) keepAlive.play().catch(() => {})
    } catch {
      /* not needed everywhere */
    }
  }

  // Called from every tap: if the phone paused the sound, start it again (needs a tap on iOS)
  function wake() {
    if (!ac) return
    keepSoundOn()
    if (ac.state !== 'running') {
      ac.resume?.().then(syncSoundNote, syncSoundNote)
      try {
        const s = ac.createBufferSource()
        s.buffer = ac.createBuffer(1, 1, ac.sampleRate)
        s.connect(ac.destination)
        s.start(0)
      } catch {
        /* fine */
      }
    }
    syncSoundNote()
  }

  function syncSoundNote() {
    const note = $('[data-sound-note]')
    if (note && ac) note.hidden = ac.state === 'running'
  }

  /* ——— Musical time ——— */
  const spb = () => 60 / proj.bpm // seconds per beat (quarter note)
  const barBeats = () => (proj.meter === '6/8' ? 3 : 4)
  const pulseBeats = () => (proj.meter === '6/8' ? 1.5 : 1) // where the click falls
  const loopBeats = () => proj.bars * barBeats()
  const songMode = () => proj.song && proj.arrangement.length > 0

  function patternIdFor(k) {
    if (songMode()) return proj.arrangement[((k % proj.arrangement.length) + proj.arrangement.length) % proj.arrangement.length]
    return proj.current
  }

  const audible = (layer) => !layer.mute

  /* ——— Transport and scheduler ——— */
  const T = { playing: false, start: 0, from: 0, rec: false, take: null, timer: 0, block: -1 }

  const nowBeat = () => (ac ? (ac.currentTime - T.start) / spb() : 0)
  const timeOf = (beat) => T.start + beat * spb()

  function clearPassMarks() {
    for (const id of PATTERN_IDS) for (const l of proj.patterns[id].layers) for (const e of l.events) delete e._pass
  }

  function play(countIn = false) {
    if (!ac) return
    clearPassMarks()
    T.playing = true
    const lead = countIn ? barBeats() * spb() : 0
    T.start = ac.currentTime + 0.08 + lead
    T.from = countIn ? -barBeats() : 0
    T.block = -1
    window.clearInterval(T.timer)
    T.timer = window.setInterval(tick, 25)
    tick()
    renderTransport()
  }

  function stop() {
    T.playing = false
    T.rec = false
    T.take = null
    window.clearInterval(T.timer)
    if (engine) engine.gate(false, 0)
    clearPassMarks()
    renderTransport()
    renderArrangement()
  }

  function toggleRecord() {
    if (!ac) return
    if (T.rec) {
      T.rec = false
      T.take = null
    } else {
      T.rec = true
      if (!T.playing) play(true)
    }
    renderTransport()
  }

  function tick() {
    if (!T.playing || !ac) return
    const ahead = 0.15 / spb()
    const to = nowBeat() + ahead
    let b = T.from
    if (to <= b) return
    const L = loopBeats()
    const groove = GROOVES[proj.meter]
    while (b < to) {
      const k = Math.floor(b / L)
      const blockStart = k * L
      const segEnd = Math.min(to, blockStart + L)
      if (k >= 0) {
        const pid = patternIdFor(k)
        const pat = proj.patterns[pid]
        if (b <= blockStart && blockStart < segEnd) {
          engine.gate(pat.drone, timeOf(blockStart))
          const shown = k
          window.setTimeout(() => {
            T.block = shown
            renderArrangement()
            renderPatterns()
          }, Math.max(0, (timeOf(blockStart) - ac.currentTime) * 1000))
        }
        for (const layer of pat.layers) {
          if (!audible(layer)) continue
          for (const ev of layer.events) {
            const atBeat = blockStart + ev.t
            if (atBeat >= b && atBeat < segEnd && ev._pass !== k) fire(ev, timeOf(atBeat), layer.color)
          }
        }
        if (pat.groove) {
          for (let s = Math.ceil((b - blockStart) / 0.5) * 0.5; blockStart + s < segEnd; s += 0.5) {
            const hit = groove[Math.round(s / 0.5) % groove.length]
            if (hit) engine.drum(hit, timeOf(blockStart + s), 0.6, 'groove')
          }
        }
      }
      // click: always during the count-in, otherwise when switched on
      const P = pulseBeats()
      for (let p = Math.ceil(b / P) * P; p < segEnd; p += P) {
        if (p < 0 || proj.click) engine.click(timeOf(p), Math.abs(p % barBeats()) < 1e-6)
      }
      b = segEnd
    }
    T.from = to
  }

  // play one stored event, and show it on the ring at the moment it sounds
  function fire(ev, when, color) {
    const ms = Math.max(0, (when - ac.currentTime) * 1000)
    if (ev.type === 'n') {
      engine.pluck(ev.i, when, ev.v, padGeo[ev.i]?.dx || 0)
      window.setTimeout(() => {
        flashPad(ev.i)
        burst(ev.i, color)
      }, ms)
    } else {
      engine.drum(ev.k, when, ev.v)
      window.setTimeout(() => drumVisual(ev.k, false), ms)
    }
  }

  /* ——— Recording into layers ——— */
  function capture(ev) {
    if (!T.rec || !T.playing) return
    const beat = nowBeat()
    if (beat < 0) return // still counting in
    const L = loopBeats()
    const k = Math.floor(beat / L)
    let local = beat - k * L
    if (proj.quant) {
      local = Math.round(local / proj.quant) * proj.quant
      if (local >= L - 1e-6) local = 0 // lands on the next downbeat
    }
    const pid = patternIdFor(k)
    // a new layer for each pass round the loop (overdub)
    if (!T.take || T.take.k !== k || T.take.pid !== pid) {
      const n = proj.nextLayer
      proj.nextLayer += 1
      const layer = { id: `L${n}`, name: '', color: LAYER_COLORS[(n - 1) % LAYER_COLORS.length], mute: false, events: [] }
      proj.patterns[pid].layers.push(layer)
      history.push({ pid, id: layer.id })
      T.take = { k, pid, layer }
    }
    // heard live already: don't play it again on this pass
    T.take.layer.events.push({ ...ev, t: +local.toFixed(4), _pass: k })
    renderLayers()
    renderPatterns()
    save()
  }

  function undo() {
    while (history.length) {
      const h = history.pop()
      const layers = proj.patterns[h.pid]?.layers
      const at = layers ? layers.findIndex((l) => l.id === h.id) : -1
      if (at >= 0) {
        layers.splice(at, 1)
        if (T.take?.layer.id === h.id) T.take = null
        toast(t('Last layer removed', 'Dernière couche supprimée'))
        renderAll()
        save()
        return
      }
    }
    // nothing recorded this session: remove the newest layer of the pattern on screen
    const layers = proj.patterns[proj.current].layers
    if (layers.length) {
      layers.pop()
      toast(t('Last layer removed', 'Dernière couche supprimée'))
      renderAll()
      save()
    } else {
      toast(t('Nothing to undo', 'Rien à annuler'))
    }
  }

  /* ——— Live input ——— */
  function playNote(i, vel = 0.9) {
    if (!ac) return
    engine.pluck(i, 0, vel, padGeo[i]?.dx || 0)
    flashPad(i)
    burst(i)
    capture({ type: 'n', i, v: +vel.toFixed(2) })
  }

  function hitDrum(kind) {
    if (!ac) return
    engine.drum(kind, 0, 0.9)
    drumVisual(kind, true)
    capture({ type: 'd', k: kind, v: 0.9 })
  }

  /* ——— Bounce: render offline to a WAV file ——— */
  function encodeWav(buffer) {
    const ch = buffer.numberOfChannels
    const len = buffer.length
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2))
    const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true)
    data.setUint32(24, buffer.sampleRate, true); data.setUint32(28, buffer.sampleRate * ch * 2, true)
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * ch * 2, true)
    const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c))
    let o = 44
    for (let i = 0; i < len; i += 1) {
      for (let c = 0; c < ch; c += 1) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        o += 2
      }
    }
    return new Blob([data], { type: 'audio/wav' })
  }

  let bouncing = false
  let takeUrl = ''

  async function bounce(what) {
    if (bouncing) return
    if (!ac) begin()
    const blocks = what === 'song' && proj.arrangement.length ? proj.arrangement.slice() : [proj.current, proj.current]
    const anything = blocks.some((id) => proj.patterns[id].layers.some((l) => audible(l) && l.events.length) || proj.patterns[id].drone || proj.patterns[id].groove)
    if (!anything) {
      toast(t('Nothing to bounce yet: record something first', 'Rien à exporter: enregistre quelque chose d’abord'))
      return
    }
    bouncing = true
    toast(t('Bouncing…', 'Export en cours…'), 60000)
    try {
      const sr = ac.sampleRate
      const sec = loopBeats() * spb()
      const total = what === 'loop' ? sec * 2 : blocks.length * sec + 3.5
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext
      const off = new OAC(2, Math.ceil(total * sr), sr)
      const eng = createEngine(off, off.destination, false)
      const groove = GROOVES[proj.meter]
      blocks.forEach((pid, j) => {
        const pat = proj.patterns[pid]
        const t0 = j * sec
        eng.gate(pat.drone, t0)
        for (const layer of pat.layers) {
          if (!audible(layer)) continue
          for (const ev of layer.events) {
            if (ev.t >= loopBeats()) continue
            const when = t0 + ev.t * spb()
            if (ev.type === 'n') eng.pluck(ev.i, when, ev.v, padGeo[ev.i]?.dx || 0)
            else eng.drum(ev.k, when, ev.v)
          }
        }
        if (pat.groove) {
          for (let s = 0; s < loopBeats(); s += 0.5) {
            const hit = groove[Math.round(s / 0.5) % groove.length]
            if (hit) eng.drum(hit, t0 + s * spb(), 0.6, 'groove')
          }
        }
      })
      eng.gate(false, blocks.length * sec)
      let buf = await off.startRendering()

      // a loop bounce keeps only the second pass, so reverb tails wrap and it loops seamlessly
      if (what === 'loop') {
        const startAt = Math.round(sec * sr)
        const length = Math.round(sec * sr)
        const cut = ac.createBuffer(2, length, sr)
        for (let c = 0; c < 2; c += 1) cut.getChannelData(c).set(buf.getChannelData(c).subarray(startAt, startAt + length))
        buf = cut
      }
      // bring the peak to -1 dBFS
      let peak = 0
      for (let c = 0; c < buf.numberOfChannels; c += 1) {
        const d = buf.getChannelData(c)
        for (let i = 0; i < d.length; i += 1) peak = Math.max(peak, Math.abs(d[i]))
      }
      if (peak > 0) {
        const gain = 0.89 / peak
        for (let c = 0; c < buf.numberOfChannels; c += 1) {
          const d = buf.getChannelData(c)
          for (let i = 0; i < d.length; i += 1) d[i] *= gain
        }
      }
      const blob = encodeWav(buf)
      if (takeUrl) URL.revokeObjectURL(takeUrl)
      takeUrl = URL.createObjectURL(blob)
      const d = new Date()
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
      const name = `laousmail-orbit-${what}-${stamp}.wav`
      const secs = Math.round(buf.length / sr)
      const take = $('[data-take]')
      take.hidden = false
      take.innerHTML = ''
      const a = document.createElement('a')
      a.href = takeUrl
      a.download = name
      a.textContent = `${t('Download', 'Télécharger')} ${name} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
      take.append(a)
      toast(t('Bounce ready', 'Export prêt'))
      status(t('Bounce ready. Download link in File.', 'Export prêt. Lien dans Fichier.'))
    } catch {
      toast(t('This browser could not render the file', 'Ce navigateur n’a pas pu créer le fichier'))
    } finally {
      bouncing = false
    }
  }

  /* ——— Project files ——— */
  function saveProjectFile() {
    const blob = new Blob([serialize(proj)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const d = new Date()
    a.download = `orbit-project-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`
    document.body.append(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  function openProjectFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replaceProject(sanitize(JSON.parse(String(reader.result))))
        toast(t('Project opened', 'Projet ouvert'))
      } catch {
        toast(t('That file is not an ORBIT project', 'Ce fichier n’est pas un projet ORBIT'))
      }
    }
    reader.readAsText(file)
  }

  function replaceProject(next) {
    if (T.playing) stop()
    proj = next
    history.length = 0
    if (engine) {
      engine.setMix(proj.mix)
      engine.setTempo(proj.bpm)
    }
    save()
    renderAll()
  }

  // destructive buttons ask twice, without a pop-up
  function confirmTap(btn, action) {
    if (btn.dataset.armed === '1') {
      btn.dataset.armed = ''
      btn.querySelectorAll('[data-confirm]').forEach((n) => n.remove())
      action()
      return
    }
    btn.dataset.armed = '1'
    const note = document.createElement('span')
    note.dataset.confirm = ''
    note.textContent = ` · ${t('tap again', 'touche encore')}`
    btn.append(note)
    window.setTimeout(() => {
      btn.dataset.armed = ''
      note.remove()
    }, 3000)
  }

  /* ——— Studio UI ——— */
  function status(msg) {
    const s = $('[data-status]')
    if (s) s.textContent = msg
  }

  let toastTimer = 0
  function toast(msg, ms = 2200) {
    const el = $('[data-toast]')
    if (!el) return
    el.textContent = msg
    el.hidden = false
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (el.hidden = true), ms)
  }

  function renderTransport() {
    $('[data-play]').setAttribute('aria-pressed', String(T.playing))
    $('[data-play]').setAttribute('aria-label', T.playing ? t('Stop', 'Stop') : t('Play', 'Lecture'))
    $('[data-rec]').setAttribute('aria-pressed', String(T.rec))
    $('[data-rec]').setAttribute('aria-label', T.rec ? t('Stop recording', 'Arrêter l’enregistrement') : t('Record', 'Enregistrer'))
    const mode = $('[data-mode]')
    mode.setAttribute('aria-pressed', String(proj.song))
    $('[data-mode-label]').textContent = proj.song ? t('Song', 'Chanson') : t('Loop', 'Boucle')
    mode.setAttribute('aria-label', proj.song ? t('Song mode: plays the arrangement', 'Mode chanson: joue l’arrangement') : t('Loop mode: plays the current pattern', 'Mode boucle: joue le motif courant'))
    renderReadout()
  }

  function renderReadout() {
    const pos = $('[data-pos]')
    const sub = $('[data-pos-sub]')
    const ro = pos.parentElement
    const bars = proj.bars === 1 ? t('1 bar', '1 mesure') : t(`${proj.bars} bars`, `${proj.bars} mesures`)
    let line = `${proj.bpm} BPM · ${proj.meter} · ${bars}`
    if (T.rec) line = `REC · ${line}`
    if (!T.playing || !ac) {
      pos.textContent = proj.song && proj.arrangement.length ? `${t('Song', 'Chanson')} · ${proj.arrangement.length}×` : `${t('Pattern', 'Motif')} ${proj.current}`
      ro.classList.remove('is-counting')
      sub.textContent = line
      return
    }
    const beat = nowBeat()
    if (beat < 0) {
      pos.textContent = `${t('Count', 'Décompte')} ${Math.ceil(-beat / pulseBeats())}`
      ro.classList.add('is-counting')
      sub.textContent = line
      return
    }
    ro.classList.remove('is-counting')
    const L = loopBeats()
    const k = Math.floor(beat / L)
    const local = beat - k * L
    const bar = Math.floor(local / barBeats()) + 1
    const pulse = Math.floor((local % barBeats()) / pulseBeats()) + 1
    const pid = patternIdFor(k)
    pos.textContent = songMode() ? `${pid} · ${bar}.${pulse}` : `${bar}.${pulse}`
    sub.textContent = line
  }

  function renderPatterns() {
    const showing = T.playing && T.block >= 0 ? patternIdFor(T.block) : proj.current
    $('[data-patterns]').innerHTML = PATTERN_IDS.map((id) => {
      const has = proj.patterns[id].layers.some((l) => l.events.length)
      const playing = T.playing && showing === id && id !== proj.current ? ' ▸' : ''
      return `<button type="button" data-pat="${id}" aria-pressed="${id === proj.current}" class="${has ? 'has-content' : ''}" style="--c:${PATTERN_COLORS[id]}">${id}${playing}</button>`
    }).join('')
    const pat = proj.patterns[proj.current]
    $('[data-pat-drone]').setAttribute('aria-pressed', String(pat.drone))
    $('[data-pat-groove]').setAttribute('aria-pressed', String(pat.groove))
  }

  function renderLayers() {
    const pat = proj.patterns[proj.current]
    const list = $('[data-layers]')
    if (!pat.layers.length) {
      list.innerHTML = `<li class="layers-empty">${t(
        `Pattern ${proj.current} is empty. Press ● to record: one bar of count-in, then play the ring and the bendir. Each pass round the loop adds a layer.`,
        `Le motif ${proj.current} est vide. Appuie sur ● pour enregistrer: une mesure de décompte, puis joue l’anneau et le bendir. Chaque tour de boucle ajoute une couche.`,
      )}</li>`
      return
    }
    list.innerHTML = pat.layers
      .map((l, n) => {
        const notes = l.events.filter((e) => e.type === 'n').length
        const hits = l.events.length - notes
        const parts = []
        if (notes) parts.push(t(`${notes} notes`, `${notes} notes`))
        if (hits) parts.push(t(`${hits} hits`, `${hits} frappes`))
        const name = l.name || `${t('Layer', 'Couche')} ${n + 1}`
        return `<li class="layer${l.mute ? ' is-muted' : ''}" style="--c:${l.color}">
          <span class="layer-dot" aria-hidden="true"></span>
          <span class="layer-name">${name}<small>${parts.join(' · ') || t('empty', 'vide')}</small></span>
          <button type="button" data-layer-mute="${l.id}" aria-pressed="${l.mute}">${l.mute ? t('Unmute', 'Activer') : t('Mute', 'Muet')}</button>
          <button type="button" data-layer-del="${l.id}" aria-label="${t('Delete', 'Supprimer')} ${name}">✕</button>
        </li>`
      })
      .join('')
  }

  function renderArrangement() {
    const list = $('[data-arrangement]')
    const nowIdx = songMode() && T.playing && T.block >= 0 ? T.block % proj.arrangement.length : -1
    if (!proj.arrangement.length) {
      list.innerHTML = `<li class="arr-empty">${t('Empty. Add patterns below.', 'Vide. Ajoute des motifs ci-dessous.')}</li>`
    } else {
      list.innerHTML = proj.arrangement
        .map((id, n) => `<li class="block${n === nowIdx ? ' is-now' : ''}" style="--c:${PATTERN_COLORS[id]}">${id}<button type="button" data-arr-del="${n}" aria-label="${t('Remove block', 'Retirer le bloc')} ${n + 1}">✕</button></li>`)
        .join('')
    }
    $('[data-arr-add]').innerHTML = PATTERN_IDS.map((id) => `<button type="button" data-arr-push="${id}" style="--c:${PATTERN_COLORS[id]}">+${id}</button>`).join('')
    const secs = Math.round(proj.arrangement.length * loopBeats() * spb())
    $('[data-arr-length]').textContent = proj.arrangement.length
      ? t(`${proj.arrangement.length} blocks · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, `${proj.arrangement.length} blocs · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`)
      : ''
  }

  const FADERS = [
    ['master', 'Master', 'Général'],
    ['strings', 'Strings', 'Cordes'],
    ['bendir', 'Bendir', 'Bendir'],
    ['groove', 'Groove', 'Groove'],
    ['drone', 'Drone', 'Bourdon'],
    ['click', 'Click', 'Métronome'],
  ]

  function renderMixer() {
    $('[data-mixer]').innerHTML = FADERS.map(
      ([key, en, fr]) => `<label class="fader"><span>${t(en, fr)}</span><input type="range" min="0" max="100" step="1" value="${Math.round(proj.mix[key] * 100)}" data-fader="${key}" aria-label="${t(en, fr)}" /><output>${Math.round(proj.mix[key] * 100)}</output></label>`,
    ).join('')
  }

  function renderSetup() {
    $('[data-bpm]').value = proj.bpm
    $('[data-bpm-val]').textContent = proj.bpm
    $$('[data-meter] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === proj.meter)))
    $$('[data-bars] button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === proj.bars)))
    $$('[data-quant] button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === proj.quant)))
    $('[data-click]').setAttribute('aria-pressed', String(proj.click))
  }

  function renderAll() {
    renderTransport()
    renderPatterns()
    renderLayers()
    renderArrangement()
    renderMixer()
    renderSetup()
  }

  function setTempo(bpm) {
    const next = Math.round(clamp(bpm, 60, 160, proj.bpm))
    if (T.playing && ac) {
      const b = nowBeat()
      proj.bpm = next
      T.start = ac.currentTime - b * spb() // keep the playhead where it is
    } else {
      proj.bpm = next
    }
    engine?.setTempo(next)
    renderSetup()
    renderReadout()
    renderArrangement()
    save()
  }

  // changing the shape of the loop while playing restarts it cleanly
  function reshape(fn) {
    const was = T.playing
    if (was) stop()
    fn()
    renderAll()
    save()
    if (was) play(false)
  }

  function initStudioUI() {
    $('[data-play]').addEventListener('click', () => {
      begin()
      if (T.playing) stop()
      else play(false)
    })
    $('[data-rec]').addEventListener('click', () => {
      begin()
      toggleRecord()
    })
    $('[data-undo]').addEventListener('click', undo)
    $('[data-mode]').addEventListener('click', () => {
      proj.song = !proj.song
      if (proj.song && !proj.arrangement.length) toast(t('Song mode: add patterns in Arrange', 'Mode chanson: ajoute des motifs dans Arranger'))
      if (T.playing) {
        stop()
        play(false)
      }
      renderTransport()
      renderArrangement()
      save()
    })
    const expand = $('[data-expand]')
    expand.addEventListener('click', () => {
      const open = expand.getAttribute('aria-expanded') !== 'true'
      expand.setAttribute('aria-expanded', String(open))
      expand.setAttribute('aria-label', open ? t('Close studio', 'Fermer le studio') : t('Open studio', 'Ouvrir le studio'))
      $('[data-panels]').hidden = !open
      layout()
    })
    $$('[data-tab]').forEach((tab) =>
      tab.addEventListener('click', () => {
        $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === tab)))
        $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab))
        layout()
      }),
    )

    // Loop panel
    $('[data-patterns]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pat]')
      if (!b) return
      proj.current = b.dataset.pat
      if (T.playing && !songMode()) T.take = null
      renderPatterns()
      renderLayers()
      renderReadout()
      save()
    })
    $('[data-pat-drone]').addEventListener('click', () => {
      const pat = proj.patterns[proj.current]
      pat.drone = !pat.drone
      if (T.playing && !songMode()) engine.gate(pat.drone, 0)
      renderPatterns()
      save()
    })
    $('[data-pat-groove]').addEventListener('click', () => {
      const pat = proj.patterns[proj.current]
      pat.groove = !pat.groove
      renderPatterns()
      save()
    })
    $('[data-layers]').addEventListener('click', (e) => {
      const pat = proj.patterns[proj.current]
      const mute = e.target.closest('[data-layer-mute]')
      const del = e.target.closest('[data-layer-del]')
      if (mute) {
        const l = pat.layers.find((x) => x.id === mute.dataset.layerMute)
        if (l) l.mute = !l.mute
      } else if (del) {
        const at = pat.layers.findIndex((x) => x.id === del.dataset.layerDel)
        if (at >= 0) pat.layers.splice(at, 1)
        if (T.take?.layer.id === del.dataset.layerDel) T.take = null
      } else {
        return
      }
      renderLayers()
      renderPatterns()
      save()
    })
    $('[data-copy-pattern]').addEventListener('click', () => {
      const target = PATTERN_IDS.find((id) => id !== proj.current && !proj.patterns[id].layers.length)
      if (!target) {
        toast(t('No empty pattern left', 'Plus de motif vide'))
        return
      }
      const copy = JSON.parse(serialize(proj.patterns[proj.current]))
      copy.layers.forEach((l) => {
        l.id = `L${proj.nextLayer}`
        proj.nextLayer += 1
      })
      proj.patterns[target] = copy
      proj.current = target
      toast(t(`Copied to ${target}`, `Copié vers ${target}`))
      renderAll()
      save()
    })
    $('[data-clear-pattern]').addEventListener('click', (e) =>
      confirmTap(e.currentTarget, () => {
        proj.patterns[proj.current].layers = []
        T.take = null
        renderAll()
        save()
      }),
    )

    // Arrange panel
    $('[data-arr-add]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-arr-push]')
      if (!b || proj.arrangement.length >= 64) return
      proj.arrangement.push(b.dataset.arrPush)
      renderArrangement()
      renderReadout()
      save()
    })
    $('[data-arrangement]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-arr-del]')
      if (!b) return
      proj.arrangement.splice(+b.dataset.arrDel, 1)
      renderArrangement()
      renderReadout()
      save()
    })
    $('[data-arr-clear]').addEventListener('click', (e) =>
      confirmTap(e.currentTarget, () => {
        proj.arrangement = []
        renderArrangement()
        renderReadout()
        save()
      }),
    )

    // Mix panel
    $('[data-mixer]').addEventListener('input', (e) => {
      const f = e.target.closest('[data-fader]')
      if (!f) return
      proj.mix[f.dataset.fader] = +f.value / 100
      f.nextElementSibling.textContent = f.value
      engine?.setMix(proj.mix)
      save()
    })

    // Setup panel
    $('[data-bpm]').addEventListener('input', (e) => setTempo(+e.target.value))
    $('[data-bpm-down]').addEventListener('click', () => setTempo(proj.bpm - 1))
    $('[data-bpm-up]').addEventListener('click', () => setTempo(proj.bpm + 1))
    $('[data-meter]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]')
      if (b && b.dataset.v !== proj.meter) reshape(() => (proj.meter = b.dataset.v))
    })
    $('[data-bars]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]')
      if (b && +b.dataset.v !== proj.bars) reshape(() => (proj.bars = +b.dataset.v))
    })
    $('[data-quant]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]')
      if (!b) return
      proj.quant = +b.dataset.v
      renderSetup()
      save()
    })
    $('[data-click]').addEventListener('click', () => {
      proj.click = !proj.click
      renderSetup()
      save()
    })

    // File panel
    $$('[data-bounce]').forEach((b) => b.addEventListener('click', () => bounce(b.dataset.bounce)))
    $('[data-save]').addEventListener('click', saveProjectFile)
    $('[data-open]').addEventListener('change', (e) => {
      openProjectFile(e.target.files?.[0])
      e.target.value = ''
    })
    $('[data-new]').addEventListener('click', (e) =>
      confirmTap(e.currentTarget, () => {
        replaceProject(blankProject())
        toast(t('New project', 'Nouveau projet'))
      }),
    )
  }

  /* ——— Layout: the ring of pads fits the space the dock leaves ——— */
  const ring = $('[data-ring]')
  const padGeo = []
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
    const dock = $('[data-dock]')
    const box = dock ? dock.getBoundingClientRect() : { height: 72, left: W }
    const dockH = box.height
    document.documentElement.style.setProperty('--dock-h', `${Math.round(dockH)}px`)
    // on a phone held sideways the dock sits on the right and the ring takes the left
    const side = window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches
    const top = H < 700 ? 64 : 78
    const bottom = side ? 16 : dockH + 26
    const avail = Math.max(160, H - top - bottom)
    const width = side ? Math.max(200, box.left - 12) : W
    const cx = width / 2
    const cy = top + avail / 2
    // the ring fits the room left; 96px is the smallest radius where 15 pads don't touch
    let R = Math.min(width * (width <= 700 ? 0.4 : 0.36), avail / 2 - 26)
    R = Math.max(R, 96)
    const pad = Math.round(Math.max(38, Math.min(66, R * 0.3)))
    const core = Math.round(Math.max(80, (R - pad / 2 - 18) * 2 * 0.74))
    geo = { cx, cy, R, pad, core, W, H }
    document.documentElement.style.setProperty('--pad', `${pad}px`)
    document.documentElement.style.setProperty('--core', `${core}px`)
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
    sizeCanvas()
  }

  function flashPad(i) {
    const b = ring.children[i]
    if (!b) return
    b.classList.add('is-hit')
    window.setTimeout(() => b.classList.remove('is-hit'), 140)
  }

  function drumVisual(kind, pressed) {
    hitCore(kind === 'D')
    if (!pressed) return
    const b = $('[data-bendir]')
    b.classList.toggle('is-rim', kind !== 'D')
    b.classList.add('is-hit')
    window.setTimeout(() => b.classList.remove('is-hit', 'is-rim'), 120)
  }

  /* ——— Input: tap, drag-to-strum (multi-touch), keyboard ——— */
  const lastPad = new Map()

  function padAt(x, y) {
    const pad = document.elementFromPoint(x, y)?.closest?.('.pad')
    return pad ? Number(pad.dataset.i) : -1
  }

  function initInput() {
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, wake, { capture: true, passive: true })
    }
    const stage = $('[data-stage]')
    stage.addEventListener('pointerdown', (e) => {
      if (!ac) return
      const drum = e.target.closest('[data-bendir]')
      if (drum) {
        // like a real bendir: the centre gives dum, the rim gives tek
        const r = drum.getBoundingClientRect()
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
        hitDrum(d > (r.width / 2) * 0.62 ? 'T' : 'D')
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
      else if (e.target.closest('[data-bendir]')) hitDrum('D')
    })

    window.addEventListener('keydown', (e) => {
      if (!ac || e.repeat || e.altKey) return
      if (e.target.tagName === 'INPUT') return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (e.metaKey || e.ctrlKey) return
      const onButton = e.target.closest?.('button, label')
      const k = e.key.toLowerCase()
      if (e.shiftKey && k === 'r') {
        e.preventDefault()
        begin()
        toggleRecord()
        return
      }
      if (k === ' ') {
        if (onButton) return
        e.preventDefault()
        if (T.playing) stop()
        else play(false)
        return
      }
      if (onButton && e.key === 'Enter') return
      const i = KEYS.indexOf(k)
      if (i >= 0) {
        e.preventDefault()
        playNote(i)
      } else if (k === 'v') hitDrum('D')
      else if (k === 'b') hitDrum('T')
    })
  }

  /* ——— Image: the canvas draws the sound, and the loop as a circle ——— */
  const canvas = $('[data-field]')
  const g = canvas.getContext('2d')
  const ripples = []
  const sparks = []
  let coreKick = 0
  let wave = null
  let freqs = null
  let spin = 0

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.floor(geo.W * dpr)
    canvas.height = Math.floor(geo.H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#070605'
    g.fillRect(0, 0, geo.W, geo.H)
  }

  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

  function burst(i, color) {
    const p = padGeo[i]
    if (!p) return
    const c = color ? hex(color) : i === studio - 1 ? [255, 106, 19] : i < released ? [255, 179, 71] : [255, 214, 160]
    ripples.push({ x: p.x, y: p.y, r: geo.pad / 2, life: 1, color: c })
    if (reduceMotion) return
    for (let k = 0; k < 14; k += 1) {
      const spread = p.a + (Math.random() - 0.5) * 1.2
      const speed = 1.2 + Math.random() * 3.2
      sparks.push({ x: p.x, y: p.y, vx: Math.cos(spread) * speed, vy: Math.sin(spread) * speed, life: 1, color: c })
    }
  }

  function hitCore(dum) {
    coreKick = Math.max(coreKick, dum ? 1 : 0.55)
    ripples.push({ x: geo.cx, y: geo.cy, r: geo.core / 2, life: 1, color: dum ? [255, 140, 60] : [255, 214, 160], core: true })
  }

  // where an event sits on the circular piano roll
  function rollPoint(ev, L) {
    const inner = geo.core / 2 + 10
    const outer = geo.R - geo.pad / 2 - 10
    const span = Math.max(8, outer - inner)
    const r = ev.type === 'n' ? inner + span * (0.24 + 0.76 * (ev.i / 14)) : inner + span * (ev.k === 'D' ? 0.05 : 0.13)
    const a = (ev.t / L) * Math.PI * 2 - Math.PI / 2
    return { x: geo.cx + r * Math.cos(a), y: geo.cy + r * Math.sin(a), a }
  }

  function frame() {
    const { W, H, cx, cy, R } = geo
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = reduceMotion ? '#070605' : 'rgba(7,6,5,0.22)'
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

    // the centre breathes with the low end and kicks with the bendir (painted, never piled up)
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

    // the sound itself, as a circle between the drum and the strings
    if (wave) {
      const base = (geo.core / 2 + (R - geo.pad / 2)) / 2
      const amp = (R - geo.pad / 2 - geo.core / 2) * 0.5
      g.strokeStyle = `rgba(255,179,71,${(T.playing ? 0.18 : 0.35) + low * 0.4})`
      g.lineWidth = 1.4
      g.beginPath()
      const n = wave.length
      for (let k = 0; k <= n; k += 2) {
        const v = (wave[k % n] - 128) / 128
        const a = (k / n) * Math.PI * 2 - Math.PI / 2
        const r = base + v * amp
        if (k === 0) g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
        else g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
      }
      g.closePath()
      g.stroke()
    }

    // the loop as a circle: bar lines, recorded events, playhead
    const L = loopBeats()
    const beat = T.playing && ac ? nowBeat() : -1
    const k = beat >= 0 ? Math.floor(beat / L) : -1
    const local = beat >= 0 ? beat - k * L : -1
    const pat = proj.patterns[k >= 0 ? patternIdFor(k) : proj.current]
    const inner = geo.core / 2 + 10
    const outer = R - geo.pad / 2 - 10
    if (T.playing || pat.layers.length) {
      for (let bb = 0; bb < L; bb += barBeats()) {
        const a = (bb / L) * Math.PI * 2 - Math.PI / 2
        g.strokeStyle = 'rgba(242,233,221,0.1)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a))
        g.lineTo(cx + outer * Math.cos(a), cy + outer * Math.sin(a))
        g.stroke()
      }
      for (const layer of pat.layers) {
        const c = hex(layer.color)
        for (const ev of layer.events) {
          const p = rollPoint(ev, L)
          let near = 0
          if (local >= 0) {
            let d = (local - ev.t) / L
            d -= Math.floor(d)
            near = d < 0.04 ? 1 - d / 0.04 : 0
          }
          g.fillStyle = rgba(c, layer.mute ? 0.18 : 0.55 + near * 0.45)
          g.beginPath()
          g.arc(p.x, p.y, 2.4 + near * 3, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    if (local >= 0) {
      const a = (local / L) * Math.PI * 2 - Math.PI / 2
      const grad = g.createLinearGradient(cx + inner * Math.cos(a), cy + inner * Math.sin(a), cx + outer * Math.cos(a), cy + outer * Math.sin(a))
      grad.addColorStop(0, T.rec ? 'rgba(255,75,75,0.15)' : 'rgba(255,179,71,0.1)')
      grad.addColorStop(1, T.rec ? 'rgba(255,75,75,0.9)' : 'rgba(255,179,71,0.85)')
      g.strokeStyle = grad
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a))
      g.lineTo(cx + outer * Math.cos(a), cy + outer * Math.sin(a))
      g.stroke()
    }

    // ripples from every note and drum hit
    for (let n = ripples.length - 1; n >= 0; n -= 1) {
      const rp = ripples[n]
      rp.r += rp.core ? 5 : 3.2
      rp.life -= rp.core ? 0.03 : 0.022
      if (rp.life <= 0) {
        ripples.splice(n, 1)
        continue
      }
      g.strokeStyle = rgba(rp.color, rp.life * 0.7)
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
      g.fillStyle = rgba(s.color, s.life)
      g.beginPath()
      g.arc(s.x, s.y, 1.6 + s.life * 1.4, 0, Math.PI * 2)
      g.fill()
    }

    if (T.playing) renderReadout()
    requestAnimationFrame(frame)
  }

  /* ——— Start ——— */
  function begin() {
    if (ac) return wake()
    keepSoundOn()
    initAudio()
    wake()
    ac.onstatechange = syncSoundNote
    $('[data-start]').classList.add('is-gone')
    ;[0, 4, 7].forEach((i, k) => window.setTimeout(() => playNote(i, 0.6), 120 + k * 140))
    status(t('Ready. Play the ring, or press record.', 'Prêt. Joue l’anneau, ou enregistre.'))
  }

  function init() {
    let start = 'en'
    try {
      start = localStorage.getItem('laousmail-lang') === 'fr' ? 'fr' : 'en'
    } catch {
      /* private mode */
    }
    buildPads()
    initStudioUI()
    setLang(start)
    $$('[data-lang-btn]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.langBtn)))
    $('[data-begin]').addEventListener('click', begin)
    initInput()
    window.addEventListener('resize', layout)
    if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe($('[data-dock]'))
    document.addEventListener('visibilitychange', () => {
      if (ac && !document.hidden) syncSoundNote()
    })
    requestAnimationFrame(frame)
  }

  init()
})()
