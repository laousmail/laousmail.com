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
    const list = releases()
    const out = list.length
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

    // Only place dots for songs released so far (no empty waiting nodes).
    nodesRoot.innerHTML = ''
    const cx = 50
    const cy = 50
    const radius = 42
    list.forEach((release, i) => {
      const angle = (Math.PI * 2 * i) / goal - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      const outward = angle
      const labelSide = Math.cos(outward) >= 0 ? 'right' : 'left'

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
      label.className = `orbit-node-label is-${labelSide}`
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

  /* ——— Messages rail: expand / minimize / dismiss ——— */
  function initLiveComments() {
    const rail = $('[data-live-rail]')
    const layer = $('[data-live-comments]')
    const minBtn = $('[data-live-minimize]')
    const fab = $('[data-live-fab]')
    const fabCount = $('[data-live-fab-count]')
    const toasts = $('[data-live-toasts]')
    if (!layer || !rail) return

    const pool = Array.isArray(window.LAOUSMAIL_COMMENTS) ? window.LAOUSMAIL_COMMENTS.slice() : []
    const messageCta = {
      type: 'cta',
      handle: '@you',
      text: '',
      href: '#circle',
    }

    let on = true
    let minimized = false
    let timer = 0
    let unseen = 0
    let idx = pool.length ? Math.floor(Math.random() * pool.length) : 0
    let spawnCount = 0
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dismissKey = 'laousmail-dismissed-comments'
    let dismissed = new Set()

    try {
      const minSaved = localStorage.getItem('laousmail-live-minimized')
      if (minSaved === '1') minimized = true
      const raw = localStorage.getItem(dismissKey)
      if (raw) dismissed = new Set(JSON.parse(raw))
    } catch {
      /* private mode */
    }

    function commentKey(item) {
      if (item?.type === 'cta') return 'cta|leave-a-message'
      return `${item.handle || ''}|${item.text || ''}`
    }

    function persistDismissed() {
      try {
        localStorage.setItem(dismissKey, JSON.stringify([...dismissed].slice(-80)))
      } catch {
        /* private mode */
      }
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

    function setChrome() {
      rail.hidden = !(on && !minimized)
      rail.setAttribute('aria-hidden', on && !minimized ? 'false' : 'true')
      document.body.classList.toggle('live-rail-on', on && !minimized)
      document.body.classList.toggle('live-rail-min', on && minimized)
      document.body.classList.remove('live-dim')
      if (minBtn) {
        minBtn.setAttribute('aria-expanded', minimized ? 'false' : 'true')
        minBtn.innerHTML = minimized
          ? '<span data-lang="en">Open</span><span data-lang="fr">Ouvrir</span>'
          : '<span data-lang="en">Hide</span><span data-lang="fr">Réduire</span>'
      }
      updateFab()
    }

    function dismissBubble(el, item) {
      if (item) {
        dismissed.add(commentKey(item))
        persistDismissed()
      }
      el.classList.add('out', 'dismissed')
      window.setTimeout(() => el.remove(), 280)
    }

    function ctaCopy() {
      return lang() === 'fr' ? 'Laisse un message pour Smail' : 'Leave a message for Smail'
    }

    function buildBubble(item, toast) {
      const bubble = document.createElement(item.type === 'cta' ? 'a' : 'div')
      bubble.className = `${toast ? 'live-toast' : 'live-bubble'}${item.type === 'cta' ? ' is-cta' : ''}`
      const closeLabel = lang() === 'fr' ? 'Retirer' : 'Dismiss'

      if (item.type === 'cta') {
        bubble.href = item.href || '#circle'
        bubble.innerHTML = `<span class="live-cta-mark" aria-hidden="true">✦</span><span class="live-text">${escapeHtml(
          ctaCopy(),
        )}</span><button type="button" class="live-dismiss" aria-label="${closeLabel}">×</button>`
      } else {
        bubble.innerHTML = `<span class="live-handle">${escapeHtml(
          item.handle || '@fan',
        )}</span><span class="live-text">${escapeHtml(
          item.text || '',
        )}</span><button type="button" class="live-dismiss" aria-label="${closeLabel}">×</button>`
      }

      bubble.querySelector('.live-dismiss')?.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        dismissBubble(bubble, item)
      })

      if (toast) {
        bubble.addEventListener('click', (e) => {
          if (e.target.closest?.('.live-dismiss')) return
          if (item.type === 'cta') return
          e.preventDefault()
          minimized = false
          try {
            localStorage.setItem('laousmail-live-minimized', '0')
          } catch {
            /* private mode */
          }
          unseen = 0
          setChrome()
          bubble.remove()
        })
      }
      return bubble
    }

    function nextItem() {
      spawnCount += 1
      // Float the message CTA with the feed (first, then every few bubbles).
      if (spawnCount === 1 || spawnCount % 4 === 0) {
        if (!dismissed.has(commentKey(messageCta))) return messageCta
      }
      if (!pool.length) {
        return dismissed.has(commentKey(messageCta)) ? null : messageCta
      }
      for (let n = 0; n < pool.length; n += 1) {
        const item = pool[idx % pool.length]
        idx += 1
        if (!dismissed.has(commentKey(item))) return item
      }
      return dismissed.has(commentKey(messageCta)) ? null : messageCta
    }

    function spawn() {
      if (!on || document.hidden || minimized) return
      if (document.body.classList.contains('menu-open') || document.body.classList.contains('preview-open')) {
        return
      }
      const item = nextItem()
      if (!item) return

      const bubble = buildBubble(item, false)
      layer.appendChild(bubble)
      layer.scrollTop = layer.scrollHeight
      void bubble.offsetWidth
      bubble.classList.add('in')

      const life = item.type === 'cta' ? (reduce ? 14000 : 12000) : reduce ? 10000 : 8000 + Math.random() * 3000
      window.setTimeout(() => {
        if (!bubble.isConnected || bubble.classList.contains('dismissed')) return
        bubble.classList.add('out')
        window.setTimeout(() => bubble.remove(), 500)
      }, life)

      while (layer.children.length > 7) layer.firstChild?.remove()
    }

    function schedule() {
      window.clearTimeout(timer)
      if (!on || minimized) return
      const gap = reduce ? 3400 : 1500 + Math.random() * 1600
      timer = window.setTimeout(() => {
        spawn()
        schedule()
      }, gap)
    }

    function setMinimized(next) {
      minimized = !!next
      if (!minimized) unseen = 0
      // Hide must not leave a grey overlay — clear toasts and pads cleanly.
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
        spawn()
        schedule()
      }
    }

    minBtn?.addEventListener('click', () => setMinimized(!minimized))
    fab?.addEventListener('click', () => setMinimized(false))

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearTimeout(timer)
      else if (on && !minimized) schedule()
    })

    setChrome()
    if (on && !minimized) {
      spawn()
      window.setTimeout(spawn, 500)
      schedule()
    }
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
        en: 'Each lit point is a released song — tap a name to preview it. The circle fills by end of 2026.',
        fr: 'Chaque point allumé est une chanson sortie — touche un nom pour l’extrait. Le cercle se remplit fin 2026.',
      },
      preview: {
        en: 'Tap a song for a 30s preview, then pick where to listen.',
        fr: 'Touche une chanson pour 30s d’extrait, puis choisis où écouter.',
      },
      platforms: {
        en: 'Choose Spotify, YouTube, or Apple Music — opens that app.',
        fr: 'Choisis Spotify, YouTube ou Apple Music — ça ouvre l’app.',
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
  initOrbitObserve()
  observeReveals()
  initMenu()
  initPointerGlow()
  initJoinForm()
  initYear()
  initLiveComments()
  initUiHints()
})()
