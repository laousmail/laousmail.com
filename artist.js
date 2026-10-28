(() => {
  const LANG_KEY = 'laousmail-lang'
  const THEME_KEY = 'laousmail-theme'

  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ——— Theme ——— */
  function preferredTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('eclipsetone-theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* private mode */
    }
    return 'dark'
  }

  function setTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private mode */
    }
    const fr = lang() === 'fr'
    $$('.mode[data-theme-toggle]').forEach((btn) => {
      const label =
        next === 'dark'
          ? fr
            ? 'Passer en mode clair'
            : 'Switch to light mode'
          : fr
            ? 'Passer en mode sombre'
            : 'Switch to dark mode'
      btn.setAttribute('aria-label', label)
    })
  }

  function initTheme() {
    setTheme(preferredTheme())
    $$('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current =
          document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
        setTheme(current === 'dark' ? 'light' : 'dark')
      })
    })
  }

  /* ——— Language ——— */
  function lang() {
    return document.documentElement.lang === 'fr' ? 'fr' : 'en'
  }

  function t(en, fr) {
    return lang() === 'fr' ? fr : en
  }

  function setLang(next) {
    next = next === 'fr' ? 'fr' : 'en'
    document.documentElement.lang = next
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* private mode */
    }
    $$('[data-lang-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang-btn') === next ? 'true' : 'false')
    })
    setTheme(document.documentElement.getAttribute('data-theme'))
    renderAll()
  }

  function initLang() {
    let start = 'en'
    try {
      const saved = localStorage.getItem(LANG_KEY) || localStorage.getItem('eclipsetone-lang')
      if (saved === 'fr' || saved === 'en') start = saved
    } catch {
      /* private mode */
    }
    $$('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang-btn')))
    })
    setLang(start)
  }

  /* ——— Helpers ——— */
  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  }

  function isSafeHttps(url) {
    try {
      return new URL(url).protocol === 'https:'
    } catch {
      return false
    }
  }

  const pad = (n) => String(n).padStart(2, '0')

  /* ——— Data ——— */
  function releases() {
    return Array.isArray(window.LAOUSMAIL_RELEASES) ? window.LAOUSMAIL_RELEASES : []
  }

  function journeyGoal() {
    return Number(window.LAOUSMAIL_JOURNEY?.goal) || 15
  }

  /** The song in the studio, only if it is the next one not yet out. */
  function brewing() {
    const b = window.LAOUSMAIL_IN_PRODUCTION
    if (!b || !b.title) return null
    const n = Number(b.number)
    if (!(n > releases().length && n <= journeyGoal())) return null
    return b
  }

  const STEP_LABELS = {
    writing: { en: 'Writing', fr: 'Écriture' },
    recording: { en: 'Recording', fr: 'Enregistrement' },
    mixing: { en: 'Mixing', fr: 'Mixage' },
    mastering: { en: 'Mastering', fr: 'Mastering' },
  }

  function studioState(b = brewing()) {
    if (!b) return null
    const steps = Array.isArray(b.steps) && b.steps.length ? b.steps : Object.keys(STEP_LABELS)
    const stepIndex = Math.max(0, steps.indexOf(String(b.step || steps[0]).toLowerCase()))
    const within = Math.min(1, Math.max(0, Number(b.stepProgress) || 0))
    return { steps, stepIndex, within, overall: (stepIndex + within) / steps.length }
  }

  function stepLabel(key) {
    return STEP_LABELS[key]?.[lang()] || STEP_LABELS[key]?.en || key
  }

  function artFor(r) {
    return (r?.artworkRemote && isSafeHttps(r.artworkRemote) && r.artworkRemote) || r?.artwork || ''
  }

  /** Falls back to the local artwork when the remote cover can't load. */
  function withArtFallback(img, r) {
    img.addEventListener(
      'error',
      () => {
        if (r?.artwork && !img.src.endsWith(r.artwork)) img.src = r.artwork
      },
      { once: true },
    )
  }

  function platformLinks(r) {
    return [
      ['Spotify', r.spotify],
      ['YouTube', r.youtube],
      ['Apple Music', r.appleMusic],
    ].filter(([, url]) => url && isSafeHttps(url))
  }

  /* ——— Player: one audio element shared by orbit, track list and mini-player ——— */
  const audio = $('[data-audio]')
  let current = -1

  function isPlaying() {
    return !!audio && current >= 0 && !audio.paused && !audio.ended
  }

  function play(index) {
    const r = releases()[index]
    if (!audio || !r) return
    if (index === current && audio.src) {
      if (audio.paused) audio.play().catch(() => {})
      return
    }
    current = index
    renderPlayer()
    if (r.preview && isSafeHttps(r.preview)) {
      audio.src = r.preview
      audio.currentTime = 0
      // A tap is a user gesture, so the preview plays with sound straight away.
      audio.play().catch(() => markPreviewMissing())
    } else {
      audio.removeAttribute('src')
      markPreviewMissing()
    }
    syncPlaying()
    guide.onPlay()
  }

  function togglePlay() {
    if (!audio || current < 0) return
    if (audio.paused) audio.play().catch(() => markPreviewMissing())
    else audio.pause()
  }

  function closePlayer() {
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    current = -1
    renderPlayer()
    syncPlaying()
  }

  function markPreviewMissing() {
    const sub = $('[data-player] .player-sub')
    if (sub) sub.textContent = t('Preview unavailable · listen below', 'Extrait indisponible · écoute ci-dessous')
    syncPlaying()
  }

  function renderPlayer() {
    const box = $('[data-player]')
    if (!box) return
    const r = releases()[current]
    box.hidden = !r
    document.body.classList.toggle('player-on', !!r)
    if (!r) return relayoutStudio()
    const art = $('[data-player-art]', box)
    art.src = artFor(r)
    withArtFallback(art, r)
    $('[data-player-title]', box).textContent = r.title
    $('.player-sub', box).textContent = t('30s preview', 'Extrait 30s')
    $('[data-player-links]', box).innerHTML = platformLinks(r)
      .map(([name, url]) => `<a class="chip" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${name}</a>`)
      .join('')
    $('[data-player-progress]', box).style.width = '0%'
    relayoutStudio()
  }

  function syncPlaying() {
    const playing = isPlaying()
    $('[data-player]')?.classList.toggle('is-playing', playing)
    const toggle = $('[data-player-toggle]')
    toggle?.setAttribute('aria-label', playing ? t('Pause', 'Pause') : t('Play', 'Lecture'))

    $$('[data-track]').forEach((row) => {
      const on = Number(row.getAttribute('data-track')) === current && playing
      row.classList.toggle('is-playing', on)
      $$('[data-play]', row).forEach((b) => {
        b.classList.toggle('is-playing', on)
        b.setAttribute('aria-label', `${on ? t('Pause', 'Pause') : t('Play', 'Écouter')} ${row.dataset.title}`)
      })
    })

    $$('[data-orbit-song]').forEach((n) => {
      n.classList.toggle('is-active', Number(n.getAttribute('data-orbit-song')) === current)
    })

    const core = $('[data-orbit-core]')
    core?.classList.toggle('is-playing', playing)
    $('[data-orbit]')?.classList.toggle('is-playing', playing)
    const corePlay = $('[data-core-play]')
    if (corePlay) {
      const latest = releases()[releases().length - 1]
      corePlay.setAttribute(
        'aria-label',
        playing ? t('Pause', 'Pause') : `${t('Play', 'Écouter')} ${releases()[current]?.title || latest?.title || ''}`,
      )
    }
    if (!hovering) showCore(current >= 0 ? current : null)
  }

  function initPlayer() {
    if (!audio) return
    audio.addEventListener('play', syncPlaying)
    audio.addEventListener('pause', syncPlaying)
    audio.addEventListener('ended', syncPlaying)
    audio.addEventListener('error', () => {
      if (current >= 0 && audio.getAttribute('src')) markPreviewMissing()
    })
    audio.addEventListener('timeupdate', () => {
      const bar = $('[data-player-progress]')
      if (bar && audio.duration) bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`
    })
    $('[data-player-toggle]')?.addEventListener('click', togglePlay)
    $('[data-player-close]')?.addEventListener('click', closePlayer)
    $('[data-play-latest]')?.addEventListener('click', () => play(releases().length - 1))
    $('[data-core-play]')?.addEventListener('click', () => {
      if (current >= 0) togglePlay()
      else play(releases().length - 1)
    })
  }

  /* ——— Hero proof row ——— */
  function renderProof() {
    const list = releases()
    const out = $('[data-proof-out]')
    if (out) out.textContent = String(list.length)
    const b = brewing()
    const s = studioState(b)
    const next = $('[data-proof-next]')
    const step = $('[data-proof-step]')
    if (next && step) {
      next.closest('li').hidden = !b
      if (b) {
        next.textContent = pad(b.number)
        step.textContent = t(`${stepLabel(s.steps[s.stepIndex]).toLowerCase()} now`, `en ${stepLabel(s.steps[s.stepIndex]).toLowerCase()}`)
      }
    }
    const latest = list[list.length - 1]
    const label = $('[data-play-latest-label]')
    if (label && latest) label.textContent = `${t('Play', 'Écouter')} ${latest.title}`
  }

  /* ——— Live countdown to the end of December 31 ——— */
  let countdownTimer = 0
  let countedUp = false

  function countdownParts() {
    const year = Number(window.LAOUSMAIL_JOURNEY?.year) || new Date().getFullYear()
    // Midnight at the end of December 31, in the visitor's own time zone
    const end = new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime()
    const left = Math.max(0, end - Date.now())
    const sec = Math.floor(left / 1000)
    return {
      year,
      left,
      days: Math.floor(sec / 86400),
      h: Math.floor((sec % 86400) / 3600),
      m: Math.floor((sec % 3600) / 60),
      s: sec % 60,
    }
  }

  function setDigit(el, value) {
    const text = pad(value)
    if (el.textContent === text) return
    el.textContent = text
    if (reduceMotion) return
    el.classList.remove('tick')
    void el.offsetWidth
    el.classList.add('tick')
  }

  function tickCountdown() {
    const root = $('[data-days-left]')
    if (!root) return
    const c = countdownParts()
    if (c.left <= 0) {
      root.hidden = true
      window.clearInterval(countdownTimer)
      return
    }
    root.hidden = false
    if (!countingUp) $('[data-cd-days]').textContent = String(c.days)
    $('[data-cd-days-unit]').textContent = c.days === 1 ? t('day', 'jour') : t('days', 'jours')
    setDigit($('[data-cd-h]'), c.h)
    setDigit($('[data-cd-m]'), c.m)
    setDigit($('[data-cd-s]'), c.s)
  }

  let countingUp = false

  function renderDaysLeft() {
    const root = $('[data-days-left]')
    if (!root) return
    const c = countdownParts()
    $('[data-cd-caption]').textContent = t(`left in ${c.year} · until December 31`, `restants en ${c.year} · jusqu’au 31 décembre`)
    $('[data-cd-unit="h"]').textContent = t('hrs', 'h')
    $('[data-cd-unit="m"]').textContent = 'min'
    $('[data-cd-unit="s"]').textContent = t('sec', 's')
    root.setAttribute(
      'aria-label',
      t(`${c.days} days left in ${c.year}, until December 31`, `${c.days} jours restants en ${c.year}, jusqu’au 31 décembre`),
    )
    tickCountdown()
    if (!countdownTimer) {
      // Tick on each new second
      window.setTimeout(() => {
        tickCountdown()
        countdownTimer = window.setInterval(tickCountdown, 1000)
      }, 1000 - (Date.now() % 1000))
    }
    if (countedUp || reduceMotion) return
    // The day count rolls up once as the hero arrives; the clock ticks from the start
    countedUp = true
    countingUp = true
    const days = c.days
    const daysEl = $('[data-cd-days]')
    const start = performance.now() + 700
    const roll = (now) => {
      const k = Math.min(1, Math.max(0, (now - start) / 1300))
      daysEl.textContent = String(Math.round(days * (1 - Math.pow(1 - k, 3))))
      if (k < 1) requestAnimationFrame(roll)
      else countingUp = false
    }
    requestAnimationFrame(roll)
  }

  /* ——— The orbit ——— */
  const RADIUS = 42 // % of the stage; matches r=168 in the 400 viewBox
  let hovering = false

  function slotPosition(i, goal) {
    const angle = (Math.PI * 2 * i) / goal - Math.PI / 2
    return { x: 50 + RADIUS * Math.cos(angle), y: 50 + RADIUS * Math.sin(angle) }
  }

  function showCore(index) {
    const core = $('[data-orbit-core]')
    if (!core) return
    const img = $('[data-core-img]', core)
    const title = $('[data-core-title]', core)
    const sub = $('[data-core-sub]', core)
    const r = index == null ? null : releases()[index]
    const src = r ? artFor(r) : 'media/portrait-core.webp'
    if (r) {
      title.textContent = r.title
      sub.textContent =
        index === current && isPlaying()
          ? t('Now playing', 'En écoute')
          : `${t('Song', 'Chanson')} ${pad(r.number || index + 1)} · ${t('tap to play', 'touche pour écouter')}`
    } else {
      title.textContent = `${releases().length} / ${journeyGoal()}`
      sub.textContent = t('songs out · toward the show', 'sorties · vers le spectacle')
    }
    if (img.getAttribute('src') === src) return
    core.classList.add('is-swapping')
    window.setTimeout(() => {
      img.src = src
      if (r) withArtFallback(img, r)
      core.classList.remove('is-swapping')
    }, reduceMotion ? 0 : 180)
  }

  function renderOrbit() {
    const orbit = $('[data-orbit]')
    const nodesRoot = $('[data-orbit-nodes]')
    if (!orbit || !nodesRoot) return

    const goal = journeyGoal()
    const list = releases()
    const out = list.length
    const b = brewing()
    const s = studioState(b)

    nodesRoot.innerHTML = ''
    for (let i = 0; i < goal; i += 1) {
      const { x, y } = slotPosition(i, goal)
      const li = document.createElement('li')
      li.style.setProperty('--x', `${x}%`)
      li.style.setProperty('--y', `${y}%`)

      let node
      if (i < out) {
        const r = list[i]
        node = document.createElement('button')
        node.type = 'button'
        node.className = 'node node-out'
        node.setAttribute('data-orbit-song', String(i))
        node.setAttribute('aria-label', `${t('Play', 'Écouter')} ${r.title}`)
        const img = document.createElement('img')
        img.src = artFor(r)
        img.alt = ''
        img.width = 64
        img.height = 64
        withArtFallback(img, r)
        node.append(img)
        const num = document.createElement('span')
        num.className = 'node-num'
        num.setAttribute('aria-hidden', 'true')
        num.textContent = String(i + 1)
        node.append(num)
        node.addEventListener('click', () => (i === current ? togglePlay() : play(i)))
        const peek = () => {
          hovering = true
          showCore(i)
        }
        const unpeek = () => {
          hovering = false
          showCore(current >= 0 ? current : null)
        }
        node.addEventListener('pointerenter', peek)
        node.addEventListener('pointerleave', unpeek)
        node.addEventListener('focus', peek)
        node.addEventListener('blur', unpeek)
      } else if (b && i === Number(b.number) - 1) {
        node = document.createElement('a')
        node.href = '#studio'
        node.className = 'node node-studio'
        node.style.setProperty('--p', String(s.overall))
        node.textContent = pad(i + 1)
        const label = `${b.title}: ${t('in the studio', 'en studio')} · ${stepLabel(s.steps[s.stepIndex]).toLowerCase()}`
        node.setAttribute('aria-label', label)
        const tip = document.createElement('span')
        tip.className = 'node-tip'
        tip.setAttribute('aria-hidden', 'true')
        tip.textContent = label
        if (x > 50) tip.classList.add('to-left')
        node.append(tip)
      } else {
        node = document.createElement('span')
        node.className = 'node node-future'
        node.setAttribute('aria-label', `${t('Song', 'Chanson')} ${i + 1}: ${t('still to come', 'à venir')}`)
        node.setAttribute('role', 'img')
      }
      node.style.setProperty('--i', String(i))
      li.append(node)
      nodesRoot.append(li)
    }

    // Lit arc runs from song 1 to the latest release; a thinner ember arc reaches the studio song.
    const per = 1000 / goal
    const arcLen = out <= 0 ? 0 : out >= goal ? 1000 : (out - 1) * per
    const arc = $('[data-orbit-arc]')
    const studioArc = $('[data-orbit-studio-arc]')
    const draw = () => {
      if (arc) arc.style.strokeDasharray = `${arcLen} 1000`
      if (studioArc) {
        if (b && out > 0) {
          const start = (out - 1) * per
          const len = (Number(b.number) - out) * per
          studioArc.style.strokeDasharray = `0 ${start} ${len} 1000`
        } else {
          studioArc.style.strokeDasharray = '0 1000'
        }
      }
    }
    if (orbit.classList.contains('is-in')) draw()
    else orbit._draw = draw

    showCore(current >= 0 ? current : null)
    syncPlaying()
  }

  function initOrbitObserve() {
    const orbit = $('[data-orbit]')
    if (!orbit) return
    const go = () => {
      orbit.classList.add('is-in')
      requestAnimationFrame(() => orbit._draw?.())
    }
    if (reduceMotion || !('IntersectionObserver' in window)) return go()
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        go()
      }
    })
    io.observe(orbit)
  }

  /* ——— Track list ——— */
  function renderTracks() {
    const root = $('[data-tracks]')
    if (!root) return
    const L = lang()
    const list = releases()
    const goal = journeyGoal()
    const b = brewing()
    const s = studioState(b)
    root.innerHTML = list
      .map((r, i) => {
        const links = platformLinks(r)
          .map(([name, url]) => `<a class="chip" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${name}</a>`)
          .join('')
        const playIcons =
          '<svg class="i-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' +
          '<svg class="i-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
        return `<li class="track" style="--n:${i}" data-track="${i}" data-title="${escapeHtml(r.title)}">
          <div class="track-art">
            <img src="${escapeHtml(artFor(r))}" alt="" width="104" height="104" loading="lazy" decoding="async" data-art="${i}" />
            <button type="button" class="track-play" data-play="${i}">${playIcons}</button>
          </div>
          <div>
            <span class="track-num">${pad(r.number || i + 1)} · ${escapeHtml(r.year || '')}</span>
            <h3>${escapeHtml(r.title)}</h3>
            <p class="track-meta"><b>${escapeHtml(r.lang?.[L] || r.lang?.en || '')}</b> · ${escapeHtml(r.description?.[L] || r.description?.en || '')}</p>
          </div>
          <div class="track-actions">
            <button type="button" class="play-btn" data-play="${i}">${playIcons}</button>
            <div class="track-listen">${links}</div>
          </div>
        </li>`
      })
      .join('')

    if (b) {
      root.insertAdjacentHTML(
        'beforeend',
        `<li class="track track-studio">
          <div class="track-art" aria-hidden="true">${pad(b.number)}</div>
          <div>
            <span class="track-num">${pad(b.number)} · ${escapeHtml(t('In the studio', 'En studio'))}</span>
            <h3>${escapeHtml(b.title)}</h3>
            <p class="track-meta">${escapeHtml(stepLabel(s.steps[s.stepIndex]))} · <a href="#studio">${escapeHtml(t('See where it is', 'Voir où elle en est'))}</a></p>
          </div>
        </li>`,
      )
    }
    const done = list.length + (b ? 1 : 0)
    if (done < goal) {
      root.insertAdjacentHTML(
        'beforeend',
        `<li class="track-rest">${pad(done + 1)}–${goal} · ${escapeHtml(
          t(`${goal - done} more songs still to come.`, `${goal - done} autres chansons à venir.`),
        )}</li>`,
      )
    }

    $$('img[data-art]', root).forEach((img) => withArtFallback(img, list[Number(img.dataset.art)]))
    $$('[data-play]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-play'))
        if (i === current) togglePlay()
        else play(i)
      })
    })
    syncPlaying()
  }

  /* ——— Studio: progress builds as you scroll ——— */
  let studioShown = 1

  function renderStudio() {
    const root = $('[data-studio]')
    const b = brewing() || window.LAOUSMAIL_IN_PRODUCTION
    const s = studioState(b)
    if (!root) return
    if (!b || !b.title || !s) {
      root.hidden = true
      return
    }
    root.hidden = false
    const L = lang()
    $('[data-studio-number]').textContent = pad(b.number || s.stepIndex + 1)
    $('[data-studio-title]').textContent = b.title
    const tr = b.translation?.[L] || b.translation?.en || ''
    $('[data-studio-translation]').textContent = tr ? `“${tr}”` : ''
    $('[data-studio-lang]').textContent = b.lang?.[L] || b.lang?.en || ''
    $('[data-studio-note]').textContent = b.note?.[L] || b.note?.en || ''
    const updated = $('[data-studio-updated]')
    if (updated && b.updated) {
      updated.setAttribute('datetime', b.updated)
      try {
        updated.textContent = new Intl.DateTimeFormat(L === 'fr' ? 'fr-CA' : 'en-CA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(`${b.updated}T12:00:00`))
      } catch {
        updated.textContent = b.updated
      }
    }
    const stepsRoot = $('[data-studio-steps]')
    stepsRoot.innerHTML = s.steps
      .map((key) => `<li data-step="${escapeHtml(key)}">${escapeHtml(stepLabel(key))}<small></small></li>`)
      .join('')
    paintStudio(studioShown)
  }

  /** f = 0…1: how much of the real progress to show (scroll-driven when pinned). */
  function paintStudio(f) {
    const root = $('[data-studio]')
    const s = studioState(brewing() || window.LAOUSMAIL_IN_PRODUCTION)
    if (!root || !s) return
    studioShown = f
    const shown = s.overall * f
    root.style.setProperty('--p', f.toFixed(3))
    // Cue and note take turns; whichever is faded out is also hidden from layout checks and taps
    root.style.setProperty('--cue-vis', f > 0.33 ? 'hidden' : 'visible')
    root.style.setProperty('--note-vis', f < 0.42 ? 'hidden' : 'visible')
    $('[data-studio-fill]')?.style.setProperty('--fill', (shown * 100).toFixed(1))
    const n = s.steps.length
    $$('[data-studio-steps] li', root).forEach((li, i) => {
      const local = Math.min(1, Math.max(0, shown * n - i))
      const isCurrent = i === s.stepIndex && f > 0.98
      const done = local >= 1 || (i < s.stepIndex && f > 0.98)
      li.className = done ? 'is-done' : isCurrent || (local > 0 && local < 1) ? 'is-current' : ''
      const small = $('small', li)
      if (done) small.textContent = t('Done', 'Fait')
      else if (local > 0) small.textContent = `${Math.round(local * 100)}%`
      else small.textContent = t('Next', 'À venir')
    })
  }

  /** Re-checks whether the studio scene can pin (set up by initStudioScroll). */
  let relayoutStudio = () => {}

  function initStudioScroll() {
    const root = $('[data-studio]')
    if (!root || reduceMotion) return
    let raf = 0
    let pending = false

    function update() {
      raf = 0
      const rect = root.getBoundingClientRect()
      const outOfView = rect.bottom < 0 || rect.top > window.innerHeight
      if (pending && outOfView) setMode()
      if (!root.classList.contains('is-pinned')) return
      const travel = rect.height - window.innerHeight
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / (travel * 0.8))) : 1
      paintStudio(p)
    }

    // Pin only when everything fits on screen, leaving room for the mini-player
    function setMode() {
      pending = false
      const navH = $('.nav')?.offsetHeight || 64
      const player = $('[data-player]')
      const playerRoom = player && !player.hidden ? player.offsetHeight + 16 : 0
      const inner = $('.studio-inner', root)?.offsetHeight || 0
      const fits = inner + 48 + playerRoom <= window.innerHeight - navH
      root.style.setProperty('--player-room', `${playerRoom}px`)
      root.classList.toggle('is-pinned', fits)
      if (fits) update()
      else playOnce()
    }

    // When the scene can't pin, the progress still builds up once, as the section arrives
    let played = false
    let watcher = null
    function playOnce() {
      if (played || !('IntersectionObserver' in window)) return paintStudio(1)
      paintStudio(0)
      watcher?.disconnect()
      watcher = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        watcher.disconnect()
        played = true
        const start = performance.now()
        const step = (now) => {
          if (root.classList.contains('is-pinned')) return
          const k = Math.min(1, (now - start) / 1800)
          paintStudio(1 - Math.pow(1 - k, 3))
          if (k < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }, { threshold: 0.35 })
      watcher.observe(root)
    }

    relayoutStudio = () => {
      const rect = root.getBoundingClientRect()
      // Changing the layout under the reader would make the page jump: wait until they leave
      if (rect.bottom < 0 || rect.top > window.innerHeight) setMode()
      else pending = true
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!raf) raf = requestAnimationFrame(update)
      },
      { passive: true },
    )
    window.addEventListener('resize', setMode)
    setMode()
  }

  /* ——— Guide: a short first-visit tour of the orbit, plus one-time tips ——— */
  const GUIDE_KEY = 'laousmail-guide-v1'
  const guide = (() => {
    const box = $('[data-guide]')
    const ring = document.createElement('div')
    ring.className = 'guide-target-ring'
    ring.hidden = true
    ring.setAttribute('aria-hidden', 'true')
    document.body.append(ring)

    let seen = {}
    try {
      const raw = localStorage.getItem(GUIDE_KEY)
      seen = raw === 'done' ? { tour: 1, player: 1 } : JSON.parse(raw || '{}') || {}
    } catch {
      seen = {}
    }

    let steps = []
    let index = 0
    let kind = ''
    let target = null
    let raf = 0
    const queue = []

    function remember(key) {
      seen[key] = 1
      try {
        localStorage.setItem(GUIDE_KEY, JSON.stringify(seen))
      } catch {
        /* private mode */
      }
    }

    function visible(sel) {
      return $$(sel).find((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
    }

    function place() {
      raf = 0
      if (!box || box.hidden || !target) return
      const r = target.getBoundingClientRect()
      const navH = $('.nav')?.offsetHeight || 64
      // Targets in the sticky header are always on screen; others hide behind it
      const inNav = !!target.closest('.nav')
      const offscreen = (!inNav && r.bottom < navH) || r.top > window.innerHeight || !r.width
      box.style.visibility = offscreen ? 'hidden' : ''
      ring.hidden = offscreen
      if (offscreen) return

      const pad = 6
      const round = target.matches('.node, .orbit-core, .lang, .mode')
      Object.assign(ring.style, {
        left: `${r.left - pad}px`,
        top: `${r.top - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
        borderRadius: round ? '999px' : '16px',
      })

      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const bw = box.offsetWidth
      const bh = box.offsetHeight
      const gap = 16
      // Some tips sit beside a whole area (the orbit) instead of on top of it
      const areaEl = steps[index]?.area && target.closest(steps[index].area)
      let a = areaEl ? areaEl.getBoundingClientRect() : r
      if (areaEl && vh - a.bottom - gap < bh && a.top - navH - gap < bh) a = r
      const spaceBelow = vh - a.bottom - gap
      const spaceAbove = inNav ? -1 : a.top - navH - gap
      const side = spaceBelow >= bh || spaceBelow >= spaceAbove ? 'below' : 'above'
      const top = side === 'below' ? a.bottom + gap : a.top - gap - bh
      const cx = r.left + r.width / 2
      const left = Math.min(Math.max(12, cx - bw / 2), vw - bw - 12)
      box.dataset.side = side
      box.style.left = `${left}px`
      box.style.top = `${Math.max(inNav ? top : navH + 8, Math.min(top, vh - bh - 8))}px`
      const arrow = $('[data-guide-arrow]', box)
      if (arrow) arrow.style.left = `${Math.min(Math.max(16, cx - left - 7), bw - 30)}px`
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(place)
    }

    function onTargetClick() {
      if (kind !== 'tour') return close()
      const leaves = target?.matches('a[href^="#"]')
      if (leaves || index >= steps.length - 1) finish()
      else show(index + 1)
    }

    function show(i) {
      index = i
      const step = steps[i]
      target?.removeEventListener('click', onTargetClick)
      target = visible(step.target)
      if (!target) {
        // Nothing to point at (e.g. no song in the studio): skip ahead
        if (i < steps.length - 1) return show(i + 1)
        return finish()
      }
      target.addEventListener('click', onTargetClick)
      const last = i === steps.length - 1
      $('[data-guide-step]', box).textContent =
        kind === 'tour' ? `${t('How it works', 'Comment ça marche')} · ${i + 1}/${steps.length}` : t('Tip', 'Astuce')
      $('[data-guide-text]', box).textContent = step.text()
      $('[data-guide-skip]', box).textContent = t('Skip', 'Passer')
      $('[data-guide-skip]', box).hidden = kind !== 'tour' || last
      $('[data-guide-next]', box).textContent = last ? t('Got it', 'Compris') : t('Next', 'Suivant')
      box.hidden = false
      ring.hidden = false
      const r = target.getBoundingClientRect()
      const areaEl = step.area && target.closest(step.area)
      const a = areaEl ? areaEl.getBoundingClientRect() : r
      const navH = $('.nav')?.offsetHeight || 64
      const room = window.innerHeight - navH
      const need = a.height + box.offsetHeight + 40
      if (!target.closest('.nav')) {
        if (need <= room && (a.top < navH + 8 || a.bottom + box.offsetHeight + 32 > window.innerHeight)) {
          // Scroll so the area and its tip both fit below the header
          window.scrollBy({ top: a.top - navH - 12, behavior: 'auto' })
        } else if (a.top < 70 || a.bottom > window.innerHeight - 40) {
          target.scrollIntoView({ block: 'center', behavior: 'auto' })
        }
      }
      place()
    }

    function close() {
      target?.removeEventListener('click', onTargetClick)
      target = null
      if (box) box.hidden = true
      ring.hidden = true
      if (kind && kind !== 'tour') remember(kind)
      kind = ''
      const next = queue.shift()
      if (next) window.setTimeout(next, 400)
    }

    function finish() {
      remember('tour')
      close()
    }

    function start(k, list, focus = false) {
      if (!box) return
      if (kind) {
        if (k !== 'tour') queue.push(() => !seen[k] && start(k, list))
        return
      }
      kind = k
      steps = list
      show(0)
      if (focus) $('[data-guide-next]', box)?.focus()
    }

    const TOUR = [
      {
        target: '.node-out:last-of-type, [data-orbit-nodes] li:nth-child(3) .node-out',
        area: '.orbit-stage',
        text: () =>
          t(
            'Each lit circle is a song that’s out. Tap one to hear a 30-second preview.',
            'Chaque cercle allumé est une chanson sortie. Touche-en un pour écouter un extrait de 30 secondes.',
          ),
      },
      {
        target: '.node-studio',
        area: '.orbit-stage',
        text: () =>
          t(
            'The glowing ring is the song in the studio right now. Tap it to see how far along it is.',
            'L’anneau qui brille, c’est la chanson en studio en ce moment. Touche-le pour voir où elle en est.',
          ),
      },
      {
        target: '[data-orbit-core]',
        area: '.orbit-stage',
        text: () =>
          t(
            'The circle fills as songs come out. When all 15 are lit, it’s show time. Press play to start with the latest.',
            'Le cercle se remplit au fil des sorties. Quand les 15 sont allumées, place au spectacle. Appuie sur lecture pour commencer par la dernière.',
          ),
      },
      {
        target: '.nav .lang',
        text: () => t('Prefer French? Switch language here anytime.', 'Tu préfères l’anglais? Change de langue ici, à tout moment.'),
      },
    ]

    function tour(focus) {
      const last = releases().length - 1
      TOUR[0].target = `[data-orbit-song="${last}"]`
      if (kind === 'tour') return
      if (kind) close()
      start('tour', TOUR, focus)
    }

    if (box) {
      $('[data-guide-next]', box).addEventListener('click', () => {
        if (kind === 'tour' && index < steps.length - 1) show(index + 1)
        else if (kind === 'tour') finish()
        else close()
      })
      $('[data-guide-skip]', box).addEventListener('click', finish)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !box.hidden) kind === 'tour' ? finish() : close()
      })
      window.addEventListener('scroll', schedule, { passive: true })
      window.addEventListener('resize', schedule)
    }

    return {
      tour,
      /** First visit: start the tour once the orbit has finished arriving. */
      autoStart() {
        if (seen.tour || !box) return
        window.setTimeout(() => !seen.tour && tour(false), reduceMotion ? 600 : 2600)
      },
      onPlay() {
        if (seen.player) return
        window.setTimeout(() => {
          if (seen.player || $('[data-player]')?.hidden) return
          start('player', [
            {
              target: '[data-player-links]',
              text: () =>
                t(
                  'This is a 30-second preview. For the full song, pick where you listen.',
                  'Ceci est un extrait de 30 secondes. Pour la chanson complète, choisis où tu écoutes.',
                ),
            },
          ])
        }, 700)
      },
      refresh() {
        if (kind && steps[index]) {
          $('[data-guide-text]', box).textContent = steps[index].text()
          show(index)
        }
      },
    }
  })()

  function initGuide() {
    $('[data-guide-replay]')?.addEventListener('click', () => guide.tour(true))
    const orbit = $('[data-orbit]')
    if (!orbit) return
    if (!('IntersectionObserver' in window)) return guide.autoStart()
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.5)) {
        io.disconnect()
        guide.autoStart()
      }
    }, { threshold: [0.5] })
    io.observe(orbit)
  }

  /* ——— Menu ——— */
  function initMenu() {
    const menu = $('[data-menu]')
    const openBtn = $('[data-nav-open]')
    if (!menu || !openBtn) return

    const focusables = () => $$('a[href], button:not([disabled])', menu)

    function open() {
      menu.hidden = false
      document.body.classList.add('menu-open')
      openBtn.setAttribute('aria-expanded', 'true')
      focusables()[0]?.focus()
    }

    function close(restoreFocus = true) {
      menu.hidden = true
      document.body.classList.remove('menu-open')
      openBtn.setAttribute('aria-expanded', 'false')
      if (restoreFocus) openBtn.focus()
    }

    openBtn.addEventListener('click', () => (menu.hidden ? open() : close()))
    $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('click', () => close(false)))
    window.matchMedia('(min-width: 861px)').addEventListener?.('change', (e) => {
      if (e.matches && !menu.hidden) close(false)
    })

    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const items = [openBtn, ...focusables()]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    })
  }

  /* ——— In-page links: scroll there without putting #section in the address,
     so a refresh always starts on the landing view ——— */
  function initInPageLinks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return
      const id = link.getAttribute('href').slice(1)
      const target = id ? document.getElementById(id) : null
      if (!target) return
      e.preventDefault()
      if (id === 'top') window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      // Move keyboard focus with the scroll, without a second jump
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    })
    window.addEventListener('pageshow', () => {
      if (!location.hash) window.scrollTo(0, 0)
    })
  }

  /* ——— Reveal on scroll ——— */
  function observeReveals() {
    const nodes = $$('.reveal')
    if (!nodes.length) return
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('in'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    nodes.forEach((n) => observer.observe(n))
  }

  function renderAll() {
    renderProof()
    renderDaysLeft()
    renderOrbit()
    renderTracks()
    renderStudio()
    if (current >= 0) {
      const wasPlaying = isPlaying()
      const box = $('[data-player]')
      const sub = box && $('.player-sub', box)
      if (sub) sub.textContent = t('30s preview', 'Extrait 30s')
      if (!wasPlaying) syncPlaying()
    }
    guide.refresh()
  }

  /* ——— Fan form (MailerLite / Formspree / custom) ——— */
  async function mailerLiteSubscribe(endpoint, emailValue) {
    const body = new FormData()
    body.set('fields[email]', emailValue)
    body.set('ml-submit', '1')
    body.set('anticsrf', 'true')

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body,
        headers: { Accept: 'application/json' },
        mode: 'cors',
      })
      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (data && data.success === true) return data
      if (data && data.success === false) {
        const msg =
          data?.errors?.fields?.email?.[0] ||
          data?.errors?.email?.[0] ||
          data?.message ||
          'MailerLite rejected the signup'
        throw new Error(msg)
      }
      if (res.ok) return data || { success: true }
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      const message = String(err?.message || '')
      if (message.includes('MailerLite rejected') || message.includes('email')) throw err
      return mailerLiteSubscribeJsonp(endpoint, emailValue)
    }
  }

  function mailerLiteSubscribeJsonp(endpoint, emailValue) {
    return new Promise((resolve, reject) => {
      const cb = `__mlCb${Date.now().toString(36)}`
      const params = new URLSearchParams()
      params.set('fields[email]', emailValue)
      params.set('ml-submit', '1')
      params.set('anticsrf', 'true')
      params.set('callback', cb)
      const joiner = endpoint.includes('?') ? '&' : '?'
      const script = document.createElement('script')
      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error('timeout'))
      }, 12000)

      function cleanup() {
        window.clearTimeout(timer)
        try {
          delete window[cb]
        } catch {
          window[cb] = undefined
        }
        script.remove()
      }

      window[cb] = (res) => {
        cleanup()
        if (res && res.success === true) resolve(res)
        else reject(new Error(res?.message || 'MailerLite signup failed'))
      }
      script.onerror = () => {
        cleanup()
        reject(new Error('network'))
      }
      script.src = `${endpoint}${joiner}${params.toString()}`
      document.body.appendChild(script)
    })
  }


  function initJoinForm() {
    const form = $('#join-form')
    if (!form) return
    const fields = $('.join-fields', form)
    const success = $('.join-success', form)
    const error = $('.join-error', form)
    const submitBtn = $('[data-submit]', form)
    const cfg = window.LAOUSMAIL_FORM || {}

    function showError(message) {
      if (!error) return
      error.hidden = false
      error.textContent = message
    }

    function clearError() {
      if (!error) return
      error.hidden = true
      error.textContent = ''
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      clearError()

      const email = form.querySelector('input[type="email"]')
      const consent = form.querySelector('input[name="consent"]')
      const hp = form.querySelector(`input[name="${cfg.honeypot || 'website'}"]`)

      if (hp && hp.value) {
        // bot
        if (fields) fields.hidden = true
        if (success) success.hidden = false
        return
      }

      if (!email?.checkValidity()) {
        email?.reportValidity()
        return
      }
      if (consent && !consent.checked) {
        showError(
          lang() === 'fr'
            ? 'Coche la case pour recevoir les nouvelles des chansons et du spectacle.'
            : 'Please check the box to receive song and show updates.',
        )
        return
      }

      const endpoint = String(cfg.endpoint || '').trim()
      if (!endpoint) {
        showError(
          lang() === 'fr'
            ? 'La liste n’est pas encore connectée. Reviens bientôt, ou écris à @laousmail sur Instagram.'
            : 'The list isn’t connected yet. Check back soon, or message @laousmail on Instagram.',
        )
        return
      }

      if (!isSafeHttps(endpoint)) {
        showError(
          lang() === 'fr'
            ? 'Configuration invalide. Contacte l’équipe du site.'
            : 'Invalid form configuration. Please contact the site owner.',
        )
        return
      }

      const provider = String(cfg.provider || '').toLowerCase()
      const emailValue = email.value.trim()

      submitBtn && (submitBtn.disabled = true)
      try {
        if (provider === 'mailerlite') {
          await mailerLiteSubscribe(endpoint, emailValue)
        } else {
          const body = new FormData()
          body.set('email', emailValue)
          body.set('consent', '1')
          body.set('source', 'laousmail.com')
          body.set('interest', 'songs+show')

          const res = await fetch(endpoint, {
            method: 'POST',
            body,
            headers: { Accept: 'application/json' },
          })

          if (!res.ok) throw new Error(`HTTP ${res.status}`)
        }

        if (fields) fields.hidden = true
        if (success) success.hidden = false
      } catch {
        showError(
          lang() === 'fr'
            ? 'Ça n’a pas fonctionné. Réessaie dans un moment, ou écris à @laousmail sur Instagram.'
            : 'That didn’t work. Try again in a moment, or message @laousmail on Instagram.',
        )
      } finally {
        submitBtn && (submitBtn.disabled = false)
      }
    })
  }

  function initYear() {
    const el = $('[data-year]')
    if (el) el.textContent = String(new Date().getFullYear())
  }


  initTheme()
  initPlayer()
  initLang()
  initOrbitObserve()
  initGuide()
  initStudioScroll()
  observeReveals()
  initMenu()
  initInPageLinks()
  initJoinForm()
  initYear()
})()
