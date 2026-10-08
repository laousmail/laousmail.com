(() => {
  const LANG_KEY = 'laousmail-lang'
  const THEME_KEY = 'laousmail-theme'

  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

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
    $$('[data-theme-toggle]').forEach((btn) => {
      const fr = document.documentElement.lang === 'fr'
      const label =
        next === 'dark'
          ? fr
            ? 'Passer en mode clair'
            : 'Switch to light mode'
          : fr
            ? 'Passer en mode sombre'
            : 'Switch to dark mode'
      btn.setAttribute('aria-label', label)
      btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false')
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

  function setLang(lang) {
    const next = lang === 'fr' ? 'fr' : 'en'
    document.documentElement.lang = next
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* private mode */
    }
    $$('[data-lang-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang-btn') === next ? 'true' : 'false')
    })
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
    renderReleases()
    renderOrbit()
  }

  function initLang() {
    let start = 'en'
    try {
      const saved = localStorage.getItem(LANG_KEY) || localStorage.getItem('eclipsetone-lang')
      if (saved === 'fr' || saved === 'en') start = saved
    } catch {
      /* private mode */
    }
    setLang(start)
    $$('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang-btn')))
    })
  }

  function lang() {
    return document.documentElement.lang === 'fr' ? 'fr' : 'en'
  }

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

  function releases() {
    return Array.isArray(window.LAOUSMAIL_RELEASES) ? window.LAOUSMAIL_RELEASES : []
  }

  function journeyGoal() {
    return Number(window.LAOUSMAIL_JOURNEY?.goal) || 15
  }

  let activeTrack = 0
  let previewRelease = null

  function artFor(r) {
    return (r?.artworkRemote && isSafeHttps(r.artworkRemote) && r.artworkRemote) || r?.artwork || ''
  }

  function syncStage(index) {
    const list = releases()
    const r = list[index]
    if (!r) return
    activeTrack = index
    const art = artFor(r)
    const stageArt = $('[data-stage-art]')
    const stageTitle = $('[data-stage-title]')
    if (stageArt && art) stageArt.src = art
    if (stageTitle) stageTitle.textContent = r.title || ''
    $$('[data-track-tab]').forEach((btn) => {
      const on = Number(btn.getAttribute('data-track-tab')) === index
      btn.setAttribute('aria-selected', on ? 'true' : 'false')
      btn.classList.toggle('is-active', on)
    })
    $$('[data-play-track]').forEach((btn) => {
      btn.classList.toggle('is-playing', Number(btn.getAttribute('data-play-track')) === index)
    })
  }

  function openExternal(url) {
    if (!url || !isSafeHttps(url)) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openSpotifyDestination(r) {
    const webUrl =
      (r?.spotify && isSafeHttps(r.spotify) && r.spotify) ||
      (r?.spotifyId ? `https://open.spotify.com/track/${encodeURIComponent(r.spotifyId)}` : '')
    if (!webUrl) return
    if (r?.spotifyId) {
      const appUrl = `spotify:track:${r.spotifyId}`
      const started = Date.now()
      window.location.href = appUrl
      window.setTimeout(() => {
        if (document.hidden || Date.now() - started > 1600) return
        openExternal(webUrl)
      }, 850)
      return
    }
    openExternal(webUrl)
  }

  function openListenDestination(platform) {
    const r = previewRelease
    if (!r) return
    if (platform === 'spotify') {
      openSpotifyDestination(r)
      return
    }
    if (platform === 'youtube') {
      openExternal(r.youtube)
      return
    }
    if (platform === 'apple') {
      openExternal(r.appleMusic)
    }
  }

  function syncPlatformButtons(r) {
    $$('[data-listen-on]').forEach((btn) => {
      const platform = btn.getAttribute('data-listen-on')
      const available =
        (platform === 'spotify' && !!(r?.spotifyId || (r?.spotify && isSafeHttps(r.spotify)))) ||
        (platform === 'youtube' && !!(r?.youtube && isSafeHttps(r.youtube))) ||
        (platform === 'apple' && !!(r?.appleMusic && isSafeHttps(r.appleMusic)))
      btn.disabled = !available
      btn.hidden = !available
    })
  }

  function closePreviewModal() {
    const modal = $('[data-preview-modal]')
    const audio = $('[data-preview-audio]')
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    previewRelease = null
    document.body.classList.remove('preview-open')
    $('[data-preview-wave]')?.classList.remove('is-playing')
    if (modal?.open) modal.close()
  }

  function openPreviewModal(index) {
    const list = releases()
    const r = list[index]
    const modal = $('[data-preview-modal]')
    const audio = $('[data-preview-audio]')
    if (!r || !modal || !audio) return

    syncStage(index)
    previewRelease = r

    const art = artFor(r)
    const artEl = $('[data-preview-art]')
    const titleEl = $('[data-preview-title]')
    if (artEl) artEl.src = art
    if (titleEl) titleEl.textContent = r.title || ''
    syncPlatformButtons(r)

    if (r.preview && isSafeHttps(r.preview)) {
      audio.src = r.preview
      audio.currentTime = 0
      const play = audio.play()
      if (play?.catch) play.catch(() => {})
      $('[data-preview-wave]')?.classList.add('is-playing')
    } else {
      audio.removeAttribute('src')
      $('[data-preview-wave]')?.classList.remove('is-playing')
    }

    document.body.classList.add('preview-open')
    if (typeof modal.showModal === 'function') modal.showModal()
    else modal.setAttribute('open', '')
  }

  function initPreviewModal() {
    const modal = $('[data-preview-modal]')
    if (!modal) return

    $('[data-open-preview]')?.addEventListener('click', () => openPreviewModal(activeTrack))
    $('[data-preview-close]')?.addEventListener('click', closePreviewModal)
    $$('[data-listen-on]').forEach((btn) => {
      btn.addEventListener('click', () => openListenDestination(btn.getAttribute('data-listen-on')))
    })

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePreviewModal()
    })
    modal.addEventListener('cancel', (e) => {
      e.preventDefault()
      closePreviewModal()
    })

    const audio = $('[data-preview-audio]')
    audio?.addEventListener('ended', () => {
      $('[data-preview-wave]')?.classList.remove('is-playing')
    })
    audio?.addEventListener('pause', () => {
      if (audio.ended || audio.currentTime === 0) return
      $('[data-preview-wave]')?.classList.remove('is-playing')
    })
    audio?.addEventListener('play', () => {
      $('[data-preview-wave]')?.classList.add('is-playing')
    })
  }

  function renderPlayerTabs() {
    const tabs = $('[data-player-tabs]')
    if (!tabs) return
    tabs.innerHTML = releases()
      .map((r, i) => {
        const label = r.title || String(i + 1)
        return `<button type="button" role="tab" class="player-tab${i === 0 ? ' is-active' : ''}" data-track-tab="${i}" aria-selected="${i === 0 ? 'true' : 'false'}">${escapeHtml(label)}</button>`
      })
      .join('')
    tabs.querySelectorAll('[data-track-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-track-tab'))
        syncStage(i)
        openPreviewModal(i)
      })
    })
    syncStage(activeTrack)
  }

  function renderReleases() {
    const root = $('[data-releases]')
    if (!root) return
    const L = lang()
    root.innerHTML = releases()
      .map((r, i) => {
        const art = artFor(r)
        const desc = r.description?.[L] || r.description?.en || ''
        const meta = r.lang?.[L] || r.lang?.en || ''
        const n = String(r.number).padStart(2, '0')
        const listen = L === 'fr' ? 'Écouter l’extrait' : 'Play preview'
        return `<button type="button" class="release reveal${i === 0 ? ' is-playing' : ''}" data-play-track="${i}">
          <div class="release-art">
            <img src="${escapeHtml(art)}" alt="" width="640" height="640" loading="lazy" decoding="async" />
            <i class="release-wave" aria-hidden="true"></i>
          </div>
          <div class="release-meta">
            <div class="release-num">${n} · ${escapeHtml(String(r.year || ''))}</div>
            <h3>${escapeHtml(r.title || '')}</h3>
            ${meta ? `<div class="release-lang">${escapeHtml(meta)}</div>` : ''}
            ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
            <span class="release-go">${listen}</span>
          </div>
        </button>`
      })
      .join('')
    root.querySelectorAll('[data-play-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPreviewModal(Number(btn.getAttribute('data-play-track')))
      })
    })
    renderPlayerTabs()
    observeReveals(root)
  }

  function yearProgressThrough2026() {
    const start = Date.UTC(2026, 0, 1)
    const end = Date.UTC(2026, 11, 31, 23, 59, 59, 999)
    const now = Date.now()
    if (now <= start) return 0
    if (now >= end) return 1
    return (now - start) / (end - start)
  }

  function renderOrbit() {
    const orbit = $('[data-orbit]')
    const nodesRoot = $('[data-orbit-nodes]')
    const countEl = $('[data-orbit-count]')
    if (!orbit || !nodesRoot) return

    const goal = journeyGoal()
    const out = releases().length
    const yearPct = yearProgressThrough2026()
    const L = lang()

    if (countEl) countEl.textContent = `${out} / ${goal}`

    const pctEl = $('[data-orbit-year-pct]')
    if (pctEl) {
      const pct = Math.round(yearPct * 100)
      pctEl.textContent =
        L === 'fr' ? `${pct}% de l’année 2026` : `${pct}% of 2026`
    }

    // Bright arc = songs released (circle filling). Traveler = where we are in 2026.
    const songPct = goal ? out / goal : 0
    const yearRing = $('[data-orbit-year]')
    if (yearRing) {
      const radius = 42
      const circ = 2 * Math.PI * radius
      yearRing.style.strokeDasharray = `${circ}`
      yearRing.style.strokeDashoffset = `${circ}`
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          yearRing.style.strokeDashoffset = `${circ * (1 - songPct)}`
        })
      })
    }

    orbit.style.setProperty('--year-progress', String(yearPct))
    orbit.style.setProperty('--song-progress', String(songPct))

    const traveler = $('[data-orbit-traveler]')
    if (traveler) {
      // Year clock — moves around the ring toward Dec 31, 2026.
      traveler.style.setProperty('--travel-angle', `${yearPct * 360}deg`)
      traveler.title = L === 'fr' ? 'Position dans l’année 2026' : 'Place in the year 2026'
    }

    nodesRoot.innerHTML = ''
    const cx = 50
    const cy = 50
    const radius = 42
    for (let i = 0; i < goal; i++) {
      const angle = (Math.PI * 2 * i) / goal - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      const node = document.createElement('span')
      const lit = i < out
      node.className = 'orbit-node' + (lit ? ' lit' : ' waiting')
      node.style.left = `${x}%`
      node.style.top = `${y}%`
      node.style.setProperty('--i', String(i))
      node.title = lit ? releases()[i]?.title || String(i + 1) : `${i + 1}`
      nodesRoot.appendChild(node)
    }

    // Stagger lit nodes on every render when hero is visible.
    $$('.orbit-node.lit', nodesRoot).forEach((n, i) => {
      n.classList.remove('in')
      window.setTimeout(() => n.classList.add('in'), 180 + i * 110)
    })
  }

  function observeReveals(scope = document) {
    const nodes = $$('.reveal', scope)
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
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' },
    )
    nodes.forEach((n) => observer.observe(n))
  }

  function initOrbitObserve() {
    const orbit = $('[data-orbit]')
    if (!orbit) return
    // Hero orbit is in-view on load — breathe life immediately.
    orbit.classList.add('is-alive')
    renderOrbit()
  }

  /* ——— Mobile menu ——— */
  function initMenu() {
    const menu = $('[data-menu]')
    const openBtn = $('[data-nav-open]')
    const closeBtn = $('[data-nav-close]')
    if (!menu || !openBtn) return

    const focusables = () =>
      $$('a[href], button:not([disabled])', menu).filter((el) => !el.hasAttribute('disabled'))

    function open() {
      menu.hidden = false
      document.body.classList.add('menu-open')
      openBtn.setAttribute('aria-expanded', 'true')
      closeBtn?.focus()
    }

    function close() {
      menu.hidden = true
      document.body.classList.remove('menu-open')
      openBtn.setAttribute('aria-expanded', 'false')
      openBtn.focus()
    }

    openBtn.addEventListener('click', open)
    closeBtn?.addEventListener('click', close)
    $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('click', close))

    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
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

  /* ——— Pointer glow (desktop only) ——— */
  function initPointerGlow() {
    const glow = $('.pointer-glow')
    if (!glow) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    window.addEventListener(
      'pointermove',
      (e) => {
        if (raf) return
        raf = requestAnimationFrame(() => {
          document.documentElement.style.setProperty('--mx', `${e.clientX}px`)
          document.documentElement.style.setProperty('--my', `${e.clientY}px`)
          raf = 0
        })
      },
      { passive: true },
    )
  }

  /* ——— Fan form (real provider endpoint) ——— */
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
            ? 'La liste n’est pas encore connectée. Reviens bientôt — ou écris à @laousmail sur Instagram.'
            : 'The list isn’t connected yet. Check back soon — or message @laousmail on Instagram.',
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

      submitBtn && (submitBtn.disabled = true)
      try {
        const body = new FormData()
        body.set('email', email.value.trim())
        body.set('consent', '1')
        body.set('source', 'laousmail.com')
        body.set('interest', 'songs+show')

        const res = await fetch(endpoint, {
          method: 'POST',
          body,
          headers: { Accept: 'application/json' },
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        if (fields) fields.hidden = true
        if (success) success.hidden = false
      } catch {
        showError(
          lang() === 'fr'
            ? 'Ça n’a pas fonctionné. Réessaie dans un moment — ou écris à @laousmail sur Instagram.'
            : 'That didn’t work. Try again in a moment — or message @laousmail on Instagram.',
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

  /* ——— Live TikTok-style comments ——— */
  function initLiveComments() {
    const layer = $('[data-live-comments]')
    const toggle = $('[data-live-toggle]')
    if (!layer) return

    const pool = Array.isArray(window.LAOUSMAIL_COMMENTS) ? window.LAOUSMAIL_COMMENTS.slice() : []
    if (!pool.length) {
      toggle && (toggle.hidden = true)
      return
    }

    let on = true
    let timer = 0
    let idx = Math.floor(Math.random() * pool.length)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    try {
      const saved = localStorage.getItem('laousmail-live-comments')
      if (saved === 'off') on = false
    } catch {
      /* private mode */
    }

    function setToggle() {
      if (!toggle) return
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false')
      toggle.classList.toggle('is-off', !on)
    }

    function spawn() {
      if (!on || document.body.classList.contains('menu-open') || document.body.classList.contains('preview-open')) return
      const item = pool[idx % pool.length]
      idx += 1

      const bubble = document.createElement('div')
      bubble.className = 'live-bubble'
      const side = Math.random() > 0.45 ? 'left' : 'right'
      bubble.dataset.side = side
      const top = 12 + Math.random() * 62
      bubble.style.top = `${top}%`
      bubble.innerHTML = `<span class="live-handle">${escapeHtml(item.handle || '@fan')}</span><span class="live-text">${escapeHtml(item.text || '')}</span>${
        item.heart ? '<span class="live-heart" aria-hidden="true">♥</span>' : ''
      }`

      layer.appendChild(bubble)
      // force reflow for enter anim
      void bubble.offsetWidth
      bubble.classList.add('in')

      const life = reduce ? 5200 : 4200 + Math.random() * 1800
      window.setTimeout(() => {
        bubble.classList.add('out')
        window.setTimeout(() => bubble.remove(), 700)
      }, life)

      // keep DOM light
      while (layer.children.length > 10) layer.firstChild?.remove()
    }

    function schedule() {
      window.clearTimeout(timer)
      if (!on) return
      const gap = reduce ? 2800 : 900 + Math.random() * 1100
      timer = window.setTimeout(() => {
        spawn()
        schedule()
      }, gap)
    }

    function start() {
      on = true
      setToggle()
      try {
        localStorage.setItem('laousmail-live-comments', 'on')
      } catch {
        /* private mode */
      }
      // burst on load
      spawn()
      window.setTimeout(spawn, 350)
      window.setTimeout(spawn, 800)
      schedule()
    }

    function stop() {
      on = false
      setToggle()
      window.clearTimeout(timer)
      try {
        localStorage.setItem('laousmail-live-comments', 'off')
      } catch {
        /* private mode */
      }
    }

    toggle?.addEventListener('click', () => (on ? stop() : start()))
    setToggle()
    if (on) start()
  }

  initTheme()
  initLang()
  initPreviewModal()
  renderReleases()
  renderOrbit()
  initOrbitObserve()
  observeReveals()
  initMenu()
  initPointerGlow()
  initJoinForm()
  initYear()
  initLiveComments()
})()
