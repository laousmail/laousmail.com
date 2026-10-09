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

  /* ——— First-visit UI hints with motion ——— */
  function initUiHints() {
    const tip = $('[data-ui-hint]')
    const tipText = $('[data-ui-hint-text]')
    const tipOk = $('[data-ui-hint-ok]')
    if (!tip || !tipText) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const key = 'laousmail-hints-v3'
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
      comments: {
        en: 'Real comments from the videos land here every few moments. Scroll to read older ones. Hide anytime, then reopen from Comments.',
        fr: 'De vrais commentaires sous les vidéos arrivent ici au fil des secondes. Fais défiler pour lire les plus anciens. Réduis quand tu veux, puis rouvre via Commentaires.',
      },
      lang: {
        en: 'Switch EN or FR anytime in the top bar.',
        fr: 'Passe en EN ou FR à tout moment dans la barre du haut.',
      },
      live: {
        en: 'Live is about the first show with this original music. Leave your email to hear first.',
        fr: 'Live parle du premier spectacle avec cette musique originale. Laisse ton email pour être prévenu·e en premier.',
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

    const defaultQueue = ['orbit', 'comments', 'lang', 'preview']
    let queue = defaultQueue.slice()
    let active = null
    let timer = 0

    function persist() {
      try {
        localStorage.setItem(key, JSON.stringify(seen))
      } catch {
        /* private mode */
      }
    }

    function mark(id) {
      seen[id] = 1
      persist()
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
      let target = $(`[data-hint="${id}"]`)
      const text = copy[id]
      if (!text || seen[id]) return false
      if (id === 'comments' && (!target || target.hidden)) {
        target = $('[data-live-fab]') || target
      }
      if (!target || target.hidden) return false
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

    function replay() {
      window.clearTimeout(timer)
      hideTip()
      seen = {}
      persist()
      queue = defaultQueue.slice()
      if (!seen.live) queue.push('live')
      timer = window.setTimeout(next, reduce ? 400 : 600)
    }

    tipOk?.addEventListener('click', () => {
      if (active) mark(active)
      hideTip()
      window.clearTimeout(timer)
      timer = window.setTimeout(next, 500)
    })

    $('[data-hints-replay]')?.addEventListener('click', replay)

    // Platforms hint when preview opens
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

    // Live section tip once the visitor reaches it
    const liveSec = $('[data-hint="live"]')
    if (liveSec && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting || seen.live) continue
            queue.push('live')
            if (!active) next()
            io.disconnect()
            break
          }
        },
        { threshold: 0.35 },
      )
      io.observe(liveSec)
    }

    window.setTimeout(next, reduce ? 900 : 1600)
  }

  /* ——— Live social feed: shuffled Instagram/TikTok comments, no compose ——— */
  function initLiveSocialFeed() {
    const rail = $('[data-live-rail]')
    const layer = $('[data-live-comments]')
    const minBtn = $('[data-live-minimize]')
    const helpBtn = $('[data-live-help]')
    const warnDetail = $('[data-live-warn-detail]')
    const fab = $('[data-live-fab]')
    const fabCount = $('[data-live-fab-count]')
    if (!rail || !layer) return

    const DATA_URL = 'fan-reactions/reactions.json'
    const SPAWN_MS = 800
    const NEAR_BOTTOM_PX = 80
    const MAX_KEEP = 40
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let pool = []
    let idx = 0
    let minimized = false
    let timer = 0
    let unseen = 0
    let started = false

    try {
      if (localStorage.getItem('laousmail-live-minimized') === '1') minimized = true
    } catch {
      /* private mode */
    }

    function isNearBottom() {
      const maxScroll = layer.scrollHeight - layer.clientHeight
      if (maxScroll <= 4) return true
      const threshold = Math.min(NEAR_BOTTOM_PX, Math.max(28, maxScroll * 0.2))
      return maxScroll - layer.scrollTop <= threshold
    }

    function pinToBottom() {
      layer.scrollTop = layer.scrollHeight
    }

    function updateFab() {
      if (!fab) return
      if (fabCount) {
        const n = Math.min(unseen, 99)
        fabCount.textContent = String(n)
        fabCount.hidden = n < 1
      }
      fab.classList.toggle('has-new', unseen > 0)
      fab.hidden = !minimized
    }

    function setChrome() {
      rail.hidden = minimized
      rail.setAttribute('aria-hidden', minimized ? 'true' : 'false')
      document.body.classList.toggle('live-rail-on', !minimized)
      document.body.classList.toggle('live-rail-min', minimized)
      if (minBtn) {
        minBtn.setAttribute('aria-expanded', minimized ? 'false' : 'true')
        minBtn.innerHTML = minimized
          ? '<span data-lang="en">Open</span><span data-lang="fr">Ouvrir</span>'
          : '<span data-lang="en">Hide</span><span data-lang="fr">Réduire</span>'
      }
      if (minimized && warnDetail && helpBtn) {
        warnDetail.hidden = true
        helpBtn.setAttribute('aria-expanded', 'false')
      }
      updateFab()
    }

    function setMinimized(next) {
      minimized = !!next
      if (!minimized) unseen = 0
      if (minimized) {
        window.clearTimeout(timer)
        layer.innerHTML = ''
      }
      setChrome()
      try {
        localStorage.setItem('laousmail-live-minimized', minimized ? '1' : '0')
      } catch {
        /* private mode */
      }
      if (!minimized && started) {
        spawn()
        schedule()
      }
    }

    function setHelpOpen(open) {
      if (!warnDetail || !helpBtn) return
      warnDetail.hidden = !open
      helpBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    function buildBubble(item) {
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
      )}">${escapeHtml(label)}</span><span class="live-text">${escapeHtml(item.text || '')}</span></div></div>`
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
      if (!pool.length) return null
      const item = pool[idx % pool.length]
      idx += 1
      if (idx >= pool.length) {
        pool = shuffle(pool)
        idx = 0
      }
      return item
    }

    function showBubble(item) {
      if (!item) return
      const pinBottom = isNearBottom()
      const bubble = buildBubble(item)
      layer.appendChild(bubble)
      void bubble.offsetWidth
      bubble.classList.add('in')

      if (pinBottom) pinToBottom()

      const life = reduce ? 16000 : 14000 + Math.random() * 4000
      window.setTimeout(() => {
        if (!bubble.isConnected) return
        if (!isNearBottom()) return
        if (layer.children.length <= 14) return
        bubble.classList.add('out')
        window.setTimeout(() => {
          if (bubble.isConnected) bubble.remove()
        }, 500)
      }, life)

      while (layer.children.length > MAX_KEEP) layer.firstChild?.remove()
    }

    function spawn() {
      if (!started || document.hidden) return
      if (document.body.classList.contains('menu-open') || document.body.classList.contains('preview-open')) {
        return
      }
      const item = nextItem()
      if (!item) return
      if (minimized) {
        unseen += 1
        updateFab()
        return
      }
      showBubble(item)
    }

    function schedule() {
      window.clearTimeout(timer)
      if (!started) return
      timer = window.setTimeout(() => {
        spawn()
        schedule()
      }, SPAWN_MS)
    }

    function normalize(list) {
      if (!Array.isArray(list)) return []
      const out = []
      const seen = new Set()
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue
        const id = String(raw.id || '').trim()
        const username = String(raw.username || '')
          .trim()
          .replace(/^@/, '')
        const commentText = String(raw.commentText || '')
          .replace(/\s+/g, ' ')
          .trim()
        if (!id || !username || !commentText) continue
        if (seen.has(id)) continue
        seen.add(id)
        out.push({
          id,
          handle: `@${username}`.slice(0, 40),
          name: String(raw.displayName || '').trim().slice(0, 48),
          avatar: safeAvatarSrc(raw.profileImageUrl),
          text: commentText.slice(0, 500),
        })
      }
      return out
    }

    helpBtn?.addEventListener('click', () => {
      setHelpOpen(!!warnDetail?.hidden)
    })

    minBtn?.addEventListener('click', () => setMinimized(!minimized))
    fab?.addEventListener('click', () => setMinimized(false))

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.clearTimeout(timer)
      } else if (started) {
        schedule()
      }
    })

    setChrome()

    fetch(DATA_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data) => {
        pool = shuffle(normalize(data?.reactions))
        if (!pool.length) {
          rail.hidden = true
          document.body.classList.remove('live-rail-on', 'live-rail-min')
          if (fab) fab.hidden = true
          return
        }
        started = true
        setChrome()
        if (!minimized) {
          spawn()
          schedule()
        } else {
          schedule()
        }
      })
      .catch(() => {
        rail.hidden = true
        document.body.classList.remove('live-rail-on', 'live-rail-min')
        if (fab) fab.hidden = true
      })
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
  initUiHints()
  initLiveSocialFeed()
})()
