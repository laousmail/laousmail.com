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

  function renderReleases() {
    const root = $('[data-releases]')
    if (!root) return
    const L = lang()
    root.innerHTML = releases()
      .map((r) => {
        const art =
          (r.artworkRemote && isSafeHttps(r.artworkRemote) && r.artworkRemote) ||
          r.artwork ||
          ''
        const desc = r.description?.[L] || r.description?.en || ''
        const meta = r.lang?.[L] || r.lang?.en || ''
        const n = String(r.number).padStart(2, '0')
        const listen = L === 'fr' ? 'Écouter' : 'Listen'
        const href = r.spotify && isSafeHttps(r.spotify) ? r.spotify : '#music'
        return `<a class="release reveal" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
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
        </a>`
      })
      .join('')
    observeReveals(root)
  }

  function renderOrbit() {
    const nodesRoot = $('[data-orbit-nodes]')
    const countEl = $('[data-orbit-count]')
    if (!nodesRoot) return
    const goal = journeyGoal()
    const out = releases().length
    if (countEl) countEl.textContent = `${out} / ${goal}`

    nodesRoot.innerHTML = ''
    const cx = 50
    const cy = 50
    const radius = 42
    for (let i = 0; i < goal; i++) {
      const angle = (Math.PI * 2 * i) / goal - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      const node = document.createElement('span')
      node.className = 'orbit-node' + (i < out ? ' lit' : '')
      node.style.left = `${x}%`
      node.style.top = `${y}%`
      node.title = i < out ? releases()[i]?.title || String(i + 1) : ''
      nodesRoot.appendChild(node)
    }
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
            if (entry.target.classList.contains('orbit') || entry.target.closest('.orbit')) {
              $$('.orbit-node.lit').forEach((n, i) => {
                setTimeout(() => n.classList.add('in'), i * 90)
              })
            }
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
    orbit.classList.add('reveal')
    observeReveals(orbit.parentElement || document)
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

  initTheme()
  initLang()
  renderReleases()
  renderOrbit()
  initOrbitObserve()
  observeReveals()
  initMenu()
  initPointerGlow()
  initJoinForm()
  initYear()
})()
