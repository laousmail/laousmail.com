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
    if (!r) return
    const art = $('[data-player-art]', box)
    art.src = artFor(r)
    withArtFallback(art, r)
    $('[data-player-title]', box).textContent = r.title
    $('.player-sub', box).textContent = t('30s preview', 'Extrait 30s')
    $('[data-player-links]', box).innerHTML = platformLinks(r)
      .map(([name, url]) => `<a class="chip" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${name}</a>`)
      .join('')
    $('[data-player-progress]', box).style.width = '0%'
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
    const src = r ? artFor(r) : 'media/portrait-circle.webp'
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
      img.classList.toggle('is-face', !r)
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
        return `<li class="track" data-track="${i}" data-title="${escapeHtml(r.title)}">
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

  function initStudioScroll() {
    const root = $('[data-studio]')
    if (!root || reduceMotion) return
    const tall = window.matchMedia('(min-height: 640px)')
    let raf = 0

    function update() {
      raf = 0
      if (!root.classList.contains('is-pinned')) return
      const rect = root.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / (travel * 0.8))) : 1
      paintStudio(p)
    }

    function setMode() {
      root.classList.toggle('is-pinned', tall.matches)
      if (tall.matches) update()
      else paintStudio(1)
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!raf) raf = requestAnimationFrame(update)
      },
      { passive: true },
    )
    tall.addEventListener?.('change', setMode)
    setMode()
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
  initStudioScroll()
  observeReveals()
  initMenu()
  initJoinForm()
  initYear()
})()
