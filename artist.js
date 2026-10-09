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
    renderStudio()
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

  /** Local avatars/… paths or https image URLs only (no javascript:). */
  function safeAvatarSrc(url) {
    const raw = String(url || '').trim()
    if (!raw) return ''
    if (/^avatars\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i.test(raw)) return raw
    if (isSafeHttps(raw) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(raw)) return raw
    return ''
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

  function setPreviewMutePrompt(visible) {
    const prompt = $('[data-preview-mute-prompt]')
    if (!prompt) return
    prompt.hidden = !visible
  }

  function unmutePreviewAudio() {
    const audio = $('[data-preview-audio]')
    if (!audio) return
    audio.muted = false
    audio.volume = 1
    if (audio.paused && audio.src) {
      const play = audio.play()
      if (play?.catch) play.catch(() => {})
    }
    setPreviewMutePrompt(false)
  }

  function closePreviewModal() {
    const modal = $('[data-preview-modal]')
    const audio = $('[data-preview-audio]')
    if (audio) {
      audio.pause()
      audio.muted = true
      audio.removeAttribute('src')
      audio.load()
    }
    previewRelease = null
    document.body.classList.remove('preview-open')
    $('[data-preview-wave]')?.classList.remove('is-playing')
    setPreviewMutePrompt(false)
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
      // Always start muted so cards + orbit dots open the same quiet preview.
      audio.muted = true
      audio.volume = 1
      audio.src = r.preview
      audio.currentTime = 0
      const play = audio.play()
      if (play?.catch) play.catch(() => {})
      $('[data-preview-wave]')?.classList.add('is-playing')
      setPreviewMutePrompt(true)
    } else {
      audio.removeAttribute('src')
      $('[data-preview-wave]')?.classList.remove('is-playing')
      setPreviewMutePrompt(false)
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
    $('[data-preview-unmute]')?.addEventListener('click', unmutePreviewAudio)
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

  function daysLeftIn2026() {
    const end = Date.UTC(2026, 11, 31, 23, 59, 59, 999)
    const now = Date.now()
    if (now >= end) return 0
    return Math.max(0, Math.ceil((end - now) / 86400000))
  }

  function renderDaysLeft() {
    const root = $('[data-days-left]')
    const countEl = $('[data-days-left-count]')
    if (!root || !countEl) return
    const days = daysLeftIn2026()
    const yearPct = yearProgressThrough2026()
    const L = lang()
    countEl.textContent = String(days)
    root.setAttribute(
      'aria-label',
      L === 'fr'
        ? `${days} jours restants en 2026`
        : `${days} days left in 2026`,
    )
    const pctEl = $('[data-orbit-year-pct]')
    if (pctEl) {
      const pct = Math.round(yearPct * 100)
      pctEl.textContent =
        L === 'fr' ? `${pct}% de l’année déjà passée` : `${pct}% of the year already gone`
    }
  }

  const STUDIO_STEP_LABELS = {
    writing: { en: 'Writing', fr: 'Écriture' },
    recording: { en: 'Recording', fr: 'Enregistrement' },
    mixing: { en: 'Mixing', fr: 'Mixage' },
    mastering: { en: 'Mastering', fr: 'Mastering' },
  }

  function renderStudio() {
    const data = window.LAOUSMAIL_IN_PRODUCTION
    const root = $('[data-making]')
    if (!root || !data || !data.title) {
      if (root) root.hidden = true
      return
    }
    root.hidden = false
    const L = lang()
    const steps = Array.isArray(data.steps) && data.steps.length
      ? data.steps
      : ['writing', 'recording', 'mixing', 'mastering']
    const step = String(data.step || steps[0]).toLowerCase()
    const stepIndex = Math.max(0, steps.indexOf(step))
    const within = Math.min(1, Math.max(0, Number(data.stepProgress) || 0))
    const overall = ((stepIndex + within) / steps.length) * 100

    const num = $('[data-studio-number]')
    if (num) num.textContent = String(data.number || stepIndex + 1).padStart(2, '0')

    const title = $('[data-studio-title]')
    if (title) title.textContent = data.title

    const translation = $('[data-studio-translation]')
    if (translation) {
      const t = data.translation?.[L] || data.translation?.en || ''
      translation.textContent = t ? `“${t}”` : ''
      translation.hidden = !t
    }

    const langEl = $('[data-studio-lang]')
    if (langEl) {
      langEl.textContent = data.lang?.[L] || data.lang?.en || ''
    }

    const fill = $('[data-studio-bar-fill]')
    if (fill) fill.style.width = `${Math.round(overall)}%`

    const stepsRoot = $('[data-studio-steps]')
    if (stepsRoot) {
      stepsRoot.innerHTML = ''
      steps.forEach((key, i) => {
        const li = document.createElement('li')
        li.className = 'studio-step'
        if (i < stepIndex) li.classList.add('is-done')
        if (i === stepIndex) li.classList.add('is-current')
        li.setAttribute('data-step', key)
        const label = STUDIO_STEP_LABELS[key]?.[L] || STUDIO_STEP_LABELS[key]?.en || key
        li.innerHTML = `<span>${label}</span>`
        stepsRoot.appendChild(li)
      })
    }

    const note = $('[data-studio-note]')
    if (note) {
      note.textContent = data.note?.[L] || data.note?.en || ''
    }

    const updated = $('[data-studio-updated]')
    if (updated && data.updated) {
      updated.setAttribute('datetime', data.updated)
      try {
        updated.textContent = new Intl.DateTimeFormat(L === 'fr' ? 'fr-CA' : 'en-CA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(`${data.updated}T12:00:00`))
      } catch {
        updated.textContent = data.updated
      }
    }
  }

  function renderOrbit() {
    const orbit = $('[data-orbit]')
    const nodesRoot = $('[data-orbit-nodes]')
    const countEl = $('[data-orbit-count]')
    if (!orbit || !nodesRoot) return

    const goal = journeyGoal()
    const list = releases()
    const out = list.length
    const yearPct = yearProgressThrough2026()
    const L = lang()

    if (countEl) countEl.textContent = `${out} / ${goal}`

    renderDaysLeft()

    // Bright arc follows released dots: from first song through the last lit node.
    // One song → small tick; 3 songs → arc ends on the 3rd dot (not past it).
    // All songs out → full ring.
    const songPct = goal ? out / goal : 0
    const arcPct =
      !goal || out <= 0
        ? 0
        : out >= goal
          ? 1
          : out === 1
            ? 0.035
            : (out - 1) / goal
    const yearRing = $('[data-orbit-year]')
    if (yearRing) {
      const radius = 42
      const circ = 2 * Math.PI * radius
      yearRing.style.strokeDasharray = `${circ}`
      yearRing.style.strokeDashoffset = `${circ}`
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          yearRing.style.strokeDashoffset = `${circ * (1 - arcPct)}`
        })
      })
    }

    orbit.style.setProperty('--year-progress', String(yearPct))
    orbit.style.setProperty('--song-progress', String(songPct))
    orbit.style.setProperty('--arc-progress', String(arcPct))

    const traveler = $('[data-orbit-traveler]')
    if (traveler) {
      // Year clock — moves around the ring toward Dec 31, 2026.
      traveler.style.setProperty('--travel-angle', `${yearPct * 360}deg`)
      traveler.title = L === 'fr' ? 'Position dans l’année 2026' : 'Place in the year 2026'
    }

    // Only place dots for songs released so far (no empty waiting nodes).
    nodesRoot.innerHTML = ''
    const cx = 50
    const cy = 50
    const radius = 42
    list.forEach((release, i) => {
      const angle = (Math.PI * 2 * i) / goal - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)

      const node = document.createElement('button')
      node.type = 'button'
      node.className = 'orbit-node lit'
      node.style.left = `${x}%`
      node.style.top = `${y}%`
      node.style.setProperty('--i', String(i))
      node.setAttribute('data-orbit-song', String(i))
      node.setAttribute('aria-label', release.title || `Song ${i + 1}`)
      node.title = release.title || String(i + 1)

      const label = document.createElement('span')
      label.className = 'orbit-node-label'
      label.textContent = release.title || String(i + 1)
      node.appendChild(label)

      node.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        openPreviewModal(i)
      })

      nodesRoot.appendChild(node)
    })

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

  /* ——— Comments rail: shared backend + local fallback ——— */
  function initLiveComments() {
    const rail = $('[data-live-rail]')
    const layer = $('[data-live-comments]')
    const toggle = $('[data-live-toggle]')
    const browseBtn = $('[data-live-browse]')
    const minBtn = $('[data-live-minimize]')
    const fab = $('[data-live-fab]')
    const fabCount = $('[data-live-fab-count]')
    const toasts = $('[data-live-toasts]')
    const compose = $('[data-live-compose]')
    if (!layer || !rail) return

    const STORAGE_KEY = 'laousmail-user-comments'
    const apiCfg = window.LAOUSMAIL_COMMENTS_API || {}
    const apiEndpoint = String(apiCfg.endpoint || '').trim()
    const pollMs = Math.max(8000, Number(apiCfg.pollMs) || 20000)
    function shuffle(list) {
      const arr = list.slice()
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
      }
      return arr
    }

    /** Seed pool shuffled once per page load so visitors see a fresh order. */
    const seed = shuffle(Array.isArray(window.LAOUSMAIL_COMMENTS) ? window.LAOUSMAIL_COMMENTS.slice() : [])
    let remoteComments = []
    let localComments = []
    let apiOnline = false
    let displayPool = null
    let livePoolSig = ''

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          localComments = parsed
            .filter((c) => c && typeof c.text === 'string' && c.text.trim())
            .map((c) => ({
              handle: String(c.handle || '@fan').slice(0, 32),
              name: String(c.name || '').slice(0, 48),
              avatar: safeAvatarSrc(c.avatar),
              text: String(c.text).slice(0, 220),
              heart: !!c.heart,
              ts: Number(c.ts) || Date.now(),
              id: c.id || '',
            }))
            .slice(0, 100)
        }
      }
    } catch {
      localComments = []
    }

    function commentKey(item) {
      return `${item.id || ''}|${item.handle || ''}|${item.text || ''}|${item.ts || ''}`
    }

    function textKey(item) {
      return String(item.text || '')
        .trim()
        .toLowerCase()
    }

    /**
     * Merge live comments with the ~100 seed pool, then shuffle for this load.
     * Sparse remote/local still yields a full visible set from the seed pool.
     */
    function rebuildDisplayPool() {
      const seen = new Set()
      const seenText = new Set()
      const live = []
      for (const item of remoteComments.concat(localComments)) {
        const key = commentKey(item)
        const t = textKey(item)
        if (!t || seen.has(key) || seenText.has(t)) continue
        seen.add(key)
        seenText.add(t)
        live.push(item)
      }

      const fromSeed = []
      for (const item of seed) {
        const key = commentKey(item)
        const t = textKey(item)
        if (!t || seen.has(key) || seenText.has(t)) continue
        seen.add(key)
        seenText.add(t)
        fromSeed.push(item)
      }

      // Live comments + full seed pool (seed fills when remote is sparse), then shuffle.
      const merged = live.concat(fromSeed)
      displayPool = shuffle(merged)
      idx = 0
      return displayPool
    }

    function pool() {
      const nextLiveSig = remoteComments.concat(localComments).map(commentKey).join('\n')
      if (!displayPool || livePoolSig !== nextLiveSig) {
        livePoolSig = nextLiveSig
        return rebuildDisplayPool()
      }
      return displayPool
    }

    function persistLocal() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localComments.slice(0, 100)))
      } catch {
        /* private mode */
      }
    }

    const messageCta = { type: 'cta', handle: '@you', text: '' }

    let on = true
    let minimized = false
    let browsing = false
    let timer = 0
    let pollTimer = 0
    let unseen = 0
    let idx = 0
    let spawnCount = 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const BROWSE_COUNT = 36

    try {
      const saved = localStorage.getItem('laousmail-live-comments')
      if (saved === 'off') on = false
      const minSaved = localStorage.getItem('laousmail-live-minimized')
      if (minSaved === '1') minimized = true
      const browseSaved = localStorage.getItem('laousmail-live-browse')
      if (browseSaved === '1') browsing = true
    } catch {
      /* private mode */
    }

    function syncComposePlaceholders() {
      if (!compose) return
      const L = lang()
      $$('input[data-ph-en]', compose).forEach((input) => {
        input.placeholder = L === 'fr' ? input.getAttribute('data-ph-fr') || '' : input.getAttribute('data-ph-en') || ''
      })
    }

    function updateFab() {
      if (!fab) return
      if (fabCount) {
        const n = Math.min(unseen, 99)
        fabCount.textContent = String(n)
        fabCount.hidden = n < 1
      }
      fab.classList.toggle('has-new', unseen > 0)
      fab.hidden = !(on && minimized)
    }

    function syncBrowseBtn() {
      if (!browseBtn) return
      browseBtn.setAttribute('aria-pressed', browsing ? 'true' : 'false')
      browseBtn.title = browsing ? 'Back to live comments' : 'Scroll through comments'
      browseBtn.innerHTML = browsing
        ? '<span data-lang="en">Live</span><span data-lang="fr">Live</span>'
        : '<span data-lang="en">Scroll</span><span data-lang="fr">Parcourir</span>'
    }

    function setChrome() {
      if (toggle) {
        toggle.setAttribute('aria-pressed', on ? 'true' : 'false')
        toggle.classList.toggle('is-off', !on)
        toggle.hidden = false
      }
      rail.hidden = !(on && !minimized)
      rail.setAttribute('aria-hidden', on && !minimized ? 'false' : 'true')
      rail.classList.toggle('is-browse', browsing && on && !minimized)
      document.body.classList.toggle('live-rail-on', on && !minimized)
      document.body.classList.toggle('live-rail-min', on && minimized)
      document.body.classList.remove('live-dim')
      if (minBtn) {
        minBtn.setAttribute('aria-expanded', minimized ? 'false' : 'true')
        minBtn.innerHTML = minimized
          ? '<span data-lang="en">Open</span><span data-lang="fr">Ouvrir</span>'
          : '<span data-lang="en">Hide</span><span data-lang="fr">Réduire</span>'
      }
      syncBrowseBtn()
      updateFab()
      syncComposePlaceholders()
    }

    function fillBrowseLayer() {
      const list = pool().filter((item) => item && item.type !== 'cta')
      const take = Math.min(BROWSE_COUNT, Math.max(list.length, 0))
      const frag = document.createDocumentFragment()
      for (let i = 0; i < take; i += 1) {
        const bubble = buildBubble(list[i])
        bubble.classList.add('in')
        frag.appendChild(bubble)
      }
      layer.innerHTML = ''
      layer.appendChild(frag)
      layer.scrollTop = 0
    }

    function setBrowsing(next) {
      browsing = !!next
      try {
        localStorage.setItem('laousmail-live-browse', browsing ? '1' : '0')
      } catch {
        /* private mode */
      }
      if (browsing) {
        window.clearTimeout(timer)
        fillBrowseLayer()
        setChrome()
        layer.focus?.({ preventScroll: true })
      } else {
        layer.innerHTML = ''
        setChrome()
        if (on && !minimized) {
          spawn()
          window.setTimeout(spawn, 500)
          schedule()
        }
      }
    }

    function startLive() {
      on = true
      setChrome()
      try {
        localStorage.setItem('laousmail-live-comments', 'on')
      } catch {
        /* private mode */
      }
      if (!minimized) {
        if (browsing) {
          fillBrowseLayer()
        } else {
          spawn()
          window.setTimeout(spawn, 500)
          schedule()
        }
      }
      schedulePoll()
      fetchRemoteComments()
    }

    function stopLive() {
      on = false
      minimized = false
      browsing = false
      unseen = 0
      window.clearTimeout(timer)
      window.clearTimeout(pollTimer)
      layer.innerHTML = ''
      if (toasts) toasts.innerHTML = ''
      setChrome()
      try {
        localStorage.setItem('laousmail-live-comments', 'off')
        localStorage.setItem('laousmail-live-minimized', '0')
        localStorage.setItem('laousmail-live-browse', '0')
      } catch {
        /* private mode */
      }
    }

    function ctaCopy() {
      return lang() === 'fr' ? 'Laisse un commentaire pour Smail' : 'Leave a comment for Smail'
    }

    function buildBubble(item) {
      const isCta = item.type === 'cta'
      if (isCta) {
        const bubble = document.createElement('button')
        bubble.type = 'button'
        bubble.className = 'live-bubble is-cta'
        bubble.innerHTML = `<span class="live-cta-mark" aria-hidden="true">✦</span><span class="live-text">${escapeHtml(
          ctaCopy(),
        )}</span>`
        bubble.addEventListener('click', () => {
          const input = $('#live-text')
          input?.focus()
          input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
        return bubble
      }
      const bubble = document.createElement('div')
      bubble.className = 'live-bubble'
      const handle = item.handle || '@fan'
      const name = String(item.name || '').trim()
      const avatar = safeAvatarSrc(item.avatar)
      const label = name || handle
      const initial = (name || handle.replace(/^@/, '') || '?').trim().charAt(0).toUpperCase()
      const avatarHtml = avatar
        ? `<img class="live-avatar" src="${escapeHtml(avatar)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="${escapeHtml(initial)}" />`
        : `<span class="live-avatar is-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`
      bubble.innerHTML = `<div class="live-bubble-row">${avatarHtml}<div class="live-bubble-body"><span class="live-handle" title="${escapeHtml(
        handle,
      )}">${escapeHtml(label)}</span><span class="live-text">${escapeHtml(
        item.text || '',
      )}</span></div></div>`
      const img = bubble.querySelector('img.live-avatar')
      img?.addEventListener('error', () => {
        const fb = document.createElement('span')
        fb.className = 'live-avatar is-fallback'
        fb.setAttribute('aria-hidden', 'true')
        fb.textContent = img.getAttribute('data-fallback') || '?'
        img.replaceWith(fb)
      })
      return bubble
    }

    function nextItem() {
      spawnCount += 1
      const list = pool()
      if (spawnCount === 1 || spawnCount % 5 === 0) return messageCta
      if (!list.length) return messageCta
      const item = list[idx % list.length]
      idx += 1
      return item
    }

    function showBubble(item, { sticky = false } = {}) {
      if (!item) return
      if (browsing && !sticky) return
      const bubble = buildBubble(item)
      if (sticky) bubble.classList.add('is-fresh')
      layer.appendChild(bubble)
      layer.scrollTop = layer.scrollHeight
      void bubble.offsetWidth
      bubble.classList.add('in')

      if (browsing) {
        while (layer.children.length > BROWSE_COUNT + 2) layer.firstChild?.remove()
        return
      }

      const life = sticky
        ? reduce
          ? 16000
          : 14000
        : item.type === 'cta'
          ? reduce
            ? 12000
            : 10000
          : reduce
            ? 10000
            : 8000 + Math.random() * 3000

      window.setTimeout(() => {
        if (!bubble.isConnected || browsing) return
        bubble.classList.add('out')
        window.setTimeout(() => {
          if (!browsing) bubble.remove()
        }, 500)
      }, life)

      while (layer.children.length > 8) layer.firstChild?.remove()
    }

    function spawn() {
      if (!on || document.hidden || minimized || browsing) return
      if (document.body.classList.contains('menu-open') || document.body.classList.contains('preview-open')) {
        return
      }
      showBubble(nextItem())
    }

    function schedule() {
      window.clearTimeout(timer)
      if (!on || minimized || browsing) return
      const gap = reduce ? 3400 : 1600 + Math.random() * 1800
      timer = window.setTimeout(() => {
        spawn()
        schedule()
      }, gap)
    }

    async function fetchRemoteComments() {
      if (!apiEndpoint || !isSafeHttps(apiEndpoint)) return
      try {
        const res = await fetch(apiEndpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          mode: 'cors',
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        const list = Array.isArray(data?.comments) ? data.comments : []
        remoteComments = list
          .filter((c) => c && typeof c.text === 'string' && c.text.trim())
          .map((c) => ({
            id: c.id || '',
            handle: String(c.handle || '@fan').slice(0, 32),
            name: String(c.name || '').slice(0, 48),
            avatar: safeAvatarSrc(c.avatar),
            text: String(c.text).slice(0, 220),
            heart: c.heart !== false,
            ts: Number(c.ts) || Date.now(),
            source: c.source || 'site',
          }))
        apiOnline = true
      } catch {
        apiOnline = false
      }
    }

    function schedulePoll() {
      window.clearTimeout(pollTimer)
      if (!apiEndpoint) return
      pollTimer = window.setTimeout(async () => {
        await fetchRemoteComments()
        schedulePoll()
      }, pollMs)
    }

    function setMinimized(next) {
      minimized = !!next
      if (!minimized) unseen = 0
      if (minimized) {
        window.clearTimeout(timer)
        if (toasts) toasts.innerHTML = ''
        layer.innerHTML = ''
      }
      setChrome()
      try {
        localStorage.setItem('laousmail-live-minimized', minimized ? '1' : '0')
      } catch {
        /* private mode */
      }
      if (on && !minimized) {
        if (browsing) {
          fillBrowseLayer()
        } else {
          spawn()
          schedule()
        }
      }
    }

    function normalizeHandle(value) {
      const raw = String(value || '').trim().replace(/\s+/g, '')
      if (!raw) return '@fan'
      return (raw.startsWith('@') ? raw : `@${raw}`).slice(0, 32)
    }

    compose?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const handleInput = compose.querySelector('[name="handle"]')
      const textInput = compose.querySelector('[name="text"]')
      const hp = compose.querySelector('[name="website"]')
      const postBtn = compose.querySelector('[data-live-post]')
      const text = String(textInput?.value || '').trim()
      if (!text) {
        textInput?.focus()
        return
      }
      const entry = {
        handle: normalizeHandle(handleInput?.value),
        text: text.slice(0, 160),
        heart: true,
        ts: Date.now(),
      }

      if (postBtn) postBtn.disabled = true

      let saved = entry
      let postedRemote = false
      if (apiEndpoint && isSafeHttps(apiEndpoint)) {
        try {
          const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            mode: 'cors',
            body: JSON.stringify({
              handle: entry.handle,
              text: entry.text,
              website: hp?.value || '',
            }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.comment) {
              saved = {
                id: data.comment.id || '',
                handle: data.comment.handle || entry.handle,
                text: data.comment.text || entry.text,
                heart: true,
                ts: data.comment.ts || entry.ts,
                source: 'site',
              }
              postedRemote = true
              apiOnline = true
              remoteComments.unshift(saved)
            }
          }
        } catch {
          postedRemote = false
        }
      }

      if (!postedRemote) {
        localComments.unshift(entry)
        persistLocal()
      }

      if (handleInput) handleInput.value = saved.handle
      if (textInput) textInput.value = ''
      if (minimized) setMinimized(false)
      showBubble(saved, { sticky: true })
      if (postBtn) postBtn.disabled = false
      textInput?.focus()
    })

    toggle?.addEventListener('click', () => (on ? stopLive() : startLive()))
    browseBtn?.addEventListener('click', () => {
      if (!on || minimized) return
      setBrowsing(!browsing)
    })
    minBtn?.addEventListener('click', () => setMinimized(!minimized))
    fab?.addEventListener('click', () => setMinimized(false))

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.clearTimeout(timer)
        window.clearTimeout(pollTimer)
      } else if (on) {
        if (!minimized && !browsing) schedule()
        schedulePoll()
        fetchRemoteComments()
      }
    })

    $$('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => window.setTimeout(syncComposePlaceholders, 0))
    })

    setChrome()
    if (!on) return
    fetchRemoteComments().finally(() => {
      if (on && !minimized) {
        if (browsing) {
          fillBrowseLayer()
        } else {
          spawn()
          window.setTimeout(spawn, 500)
          schedule()
        }
      }
      schedulePoll()
    })
  }

  /* ——— First-visit UI hints with motion ——— */
  function initUiHints() {
    const tip = $('[data-ui-hint]')
    const tipText = $('[data-ui-hint-text]')
    const tipOk = $('[data-ui-hint-ok]')
    if (!tip || !tipText) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const key = 'laousmail-hints-v2'
    let seen = {}
    try {
      seen = JSON.parse(localStorage.getItem(key) || '{}') || {}
    } catch {
      seen = {}
    }

    const copy = {
      orbit: {
        en: 'Each lit point is a released song. Tap a name to preview it. The circle fills by end of 2026.',
        fr: 'Chaque point allumé est une chanson sortie. Touche un nom pour l’extrait. Le cercle se remplit fin 2026.',
      },
      preview: {
        en: 'Tap a song for a 30s preview, then pick where to listen.',
        fr: 'Touche une chanson pour 30s d’extrait, puis choisis où écouter.',
      },
      platforms: {
        en: 'Choose Spotify, YouTube, or Apple Music. Opens that app.',
        fr: 'Choisis Spotify, YouTube ou Apple Music. Ça ouvre l’app.',
      },
    }

    const queue = ['orbit', 'preview']
    let active = null
    let timer = 0

    function mark(id) {
      seen[id] = 1
      try {
        localStorage.setItem(key, JSON.stringify(seen))
      } catch {
        /* private mode */
      }
    }

    function clearPulse() {
      $$('.hint-pulse').forEach((el) => el.classList.remove('hint-pulse'))
    }

    function hideTip() {
      tip.hidden = true
      clearPulse()
      active = null
    }

    function showTip(id) {
      const target = $(`[data-hint="${id}"]`)
      const text = copy[id]
      if (!target || !text || seen[id]) return false
      active = id
      tipText.textContent = text[lang()] || text.en
      tip.hidden = false
      tip.classList.remove('ui-hint-in')
      void tip.offsetWidth
      tip.classList.add('ui-hint-in')
      clearPulse()
      target.classList.add('hint-pulse')
      target.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      return true
    }

    function next() {
      window.clearTimeout(timer)
      while (queue.length) {
        const id = queue.shift()
        if (showTip(id)) {
          timer = window.setTimeout(() => {
            mark(id)
            hideTip()
            timer = window.setTimeout(next, 700)
          }, reduce ? 5200 : 4200)
          return
        }
      }
    }

    tipOk?.addEventListener('click', () => {
      if (active) mark(active)
      hideTip()
      window.clearTimeout(timer)
      timer = window.setTimeout(next, 500)
    })

    // Platforms hint when preview opens
    const modal = $('[data-preview-modal]')
    modal?.addEventListener('close', () => {
      /* no-op */
    })
    const openPreview = $('[data-open-preview]')
    // After first preview open, teach platforms once
    document.addEventListener(
      'click',
      (e) => {
        if (!e.target.closest?.('[data-open-preview], [data-play-track], [data-track-tab]')) return
        if (seen.platforms) return
        window.setTimeout(() => {
          if (!$('[data-preview-modal]')?.open) return
          queue.unshift('platforms')
          if (!active) next()
        }, 600)
      },
      true,
    )

    window.setTimeout(next, reduce ? 900 : 1600)
  }

  initTheme()
  initLang()
  initPreviewModal()
  renderReleases()
  renderOrbit()
  renderStudio()
  initOrbitObserve()
  observeReveals()
  initMenu()
  initPointerGlow()
  initJoinForm()
  initYear()
  initLiveComments()
  initUiHints()
  if (typeof window.initFanReactions === 'function') {
    window.initFanReactions()
  }
})()
