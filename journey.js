/* laousmail.com — the journey. The orbit stays on screen from the top of the
   page to the bottom and is the base of everything: each scroll brings one
   card, and the orbit turns into what that card is about.

     landing   the full orbit and the message (15 songs before the show)
     studio    the song in the studio: its ring lights up, the centre shows it
     songs     newest to oldest: the song's dot glows and a beam joins it to its
               card (listen buttons); the centre shows its cover
     rest      the songs still to come: their dots pulse
     story     four chapters: the ring becomes four points, the centre a photo
     show      the circle is full: all fifteen dots lit
     join      Ceux qui écoutent: the sign-up sits inside the orbit
     eclipse   EclipseTone: a dark disc slides over the centre

   A short status line stays at the top. The chapters sit round the ring
   (on phones, in a row) and jump there. Soft snapping settles each scroll on
   one card. The cards are real content, moved here from the page (or copied,
   for the song list, which the site rebuilds on a language change).

   Only with room to breathe and without reduced motion; otherwise the page
   stays as it was and scenes.js runs instead. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const orbit = $('[data-orbit]')
  if (reduceMotion || !orbit || window.innerHeight < 520 || window.innerWidth < 340) return

  const lang = () => (document.documentElement.lang === 'fr' ? 'fr' : 'en')
  const t = (en, fr) => (lang() === 'fr' ? fr : en)
  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  const pad = (n) => String(n).padStart(2, '0')
  const both = (en, fr) => `<span data-lang="en">${en}</span><span data-lang="fr">${fr}</span>`
  const navH = () => $('.nav')?.offsetHeight || 64
  const releases = () => (Array.isArray(window.LAOUSMAIL_RELEASES) ? window.LAOUSMAIL_RELEASES : [])
  const goal = () => Number(window.LAOUSMAIL_JOURNEY?.goal) || 15
  const brewing = () => {
    const b = window.LAOUSMAIL_IN_PRODUCTION
    const n = Number(b?.number)
    return b?.title && n > releases().length && n <= goal() ? b : null
  }

  document.body.classList.add('journey')

  /* ——— The frame: a stage that holds still, and the steps that scroll under it ——— */
  const root = document.createElement('div')
  root.className = 'j'
  root.innerHTML = `
    <div class="j-stage">
      <p class="j-status" aria-live="off"></p>
      <nav class="j-chapters" aria-label="${t('Chapters', 'Chapitres')}"></nav>
      <div class="j-orbit"></div>
      <span class="j-marker" aria-hidden="true"></span>
      <svg class="j-beam" aria-hidden="true"><defs><linearGradient id="j-beam-grad" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="var(--gold)" /><stop offset="1" stop-color="var(--hot)" stop-opacity="0.15" /></linearGradient></defs><line /></svg>
      <div class="j-cards"></div>
    </div>
    <div class="j-steps" aria-hidden="true"></div>`
  $('main').prepend(root)
  const stage = $('.j-stage', root)
  const status = $('.j-status', root)
  const chaptersNav = $('.j-chapters', root)
  const orbitSlot = $('.j-orbit', root)
  const marker = $('.j-marker', root)
  const beam = $('.j-beam', root)
  const beamLine = $('line', beam)
  const cardsRoot = $('.j-cards', root)
  const stepsRoot = $('.j-steps', root)

  orbitSlot.append(orbit)
  const orbitStage = $('.orbit-stage', orbit)

  // layers inside the orbit: a centre for the story / the show / the eclipse, and the sign-up
  const core = document.createElement('div')
  core.className = 'j-core'
  core.setAttribute('aria-hidden', 'true')
  core.innerHTML = `<img class="j-core-photo" src="media/drums-park.webp" alt="" width="1200" height="1600" decoding="async" />
    <span class="j-core-text"><strong></strong><small></small></span><span class="j-eclipse"></span>`
  orbitStage.append(core)
  const points = document.createElement('div')
  points.className = 'j-points'
  points.setAttribute('aria-hidden', 'true')
  points.innerHTML = [0, 90, 180, 270].map((a) => `<i style="--a:${a}deg"></i>`).join('')
  orbitStage.append(points)
  const formSlot = document.createElement('div')
  formSlot.className = 'j-form'
  orbitStage.append(formSlot)

  /* ——— The cards ——— */
  const steps = []
  function card(key, place, html, extra = {}) {
    const el = document.createElement('section')
    el.className = `j-card j-card-${key}`
    el.dataset.place = place
    if (html) el.innerHTML = `<div class="j-fit">${html}</div>`
    else el.innerHTML = '<div class="j-fit"></div>'
    cardsRoot.append(el)
    const step = { key, place, el, fit: $('.j-fit', el), ...extra }
    steps.push(step)
    return step
  }

  // 0 · the landing: the message
  const landing = card('landing', 'home')
  const heroCopy = $('.hero-copy')
  if (heroCopy) landing.fit.append(heroCopy)

  // 1 · the song in the studio: the whole studio section, at rest
  const studioSection = $('[data-studio]')
  if (brewing() && studioSection) {
    const s = card('studio', 'studio')
    s.fit.append(studioSection)
  }

  // 2… · the songs, newest first (copies of the list, refreshed when it is rebuilt)
  const songSteps = releases()
    .map((r, i) => i)
    .reverse()
    .map((i) => card('song', 'music', '', { index: i }))

  function fillSongs() {
    const list = $('[data-tracks]')
    if (!list) return
    for (const step of songSteps) {
      const src = $(`[data-track="${step.index}"]`, list)
      if (!src) continue
      const copy = src.cloneNode(true)
      copy.removeAttribute('style')
      const r = releases()[step.index]
      step.fit.innerHTML = `<p class="eyebrow j-out">${both('Out now', 'Disponible')} · ${pad(r?.number || step.index + 1)} / ${goal()}</p><ol class="j-one"></ol>`
      $('.j-one', step.fit).append(copy)
      step.src = src
      // covers can fall back to a local picture: show whatever the orbit shows
      const img = $('img', copy)
      const fallback = () => $(`[data-orbit-song="${step.index}"] img`)?.currentSrc || $('img', src)?.currentSrc
      if (img) {
        const now = $('img', src)?.currentSrc
        if (now) img.src = now
        img.addEventListener('error', () => {
          const f = fallback()
          if (f && img.src !== f) img.src = f
        })
      }
    }
    syncPlaying()
    if (built) fitAll()
  }

  // the songs still to come
  const done = releases().length + (brewing() ? 1 : 0)
  const rest = goal() - done
  const restStep =
    rest > 0
      ? card(
          'rest',
          'music',
          `<p class="eyebrow">${both('Still to come', 'À venir')}</p>
           <h2>${pad(done + 1)}–${goal()}</h2>
           <span class="j-dots" aria-hidden="true">${'<i></i>'.repeat(rest)}</span>
           <p class="sub">${both(
             `${rest} more songs on the way. When the circle is full, I take them on stage.`,
             `${rest} autres chansons en route. Quand le cercle sera plein, je les emmène sur scène.`,
           )}</p>
           <p class="j-days"></p>`,
        )
      : null

  // the story: four chapters
  const storySection = $('#story')
  const beats = storySection ? $$('.beats > li', storySection) : []
  const storyHead = storySection ? $('.sec-head', storySection) : null
  beats.forEach((li, k) => {
    const s = card('story', 'story', '', { chapter: k })
    if (k === 0 && storyHead) s.fit.append(storyHead)
    const ol = document.createElement('ol')
    ol.className = 'beats j-beats'
    ol.start = k + 1
    ol.style.setProperty('--k', String(k))
    ol.append(li)
    s.fit.append(ol)
  })

  // the show
  const showInner = $('#show .show-inner')
  const showStep = card('show', 'show')
  if (showInner) $$(':scope > .eyebrow, :scope > h2, :scope > .sub, :scope > .press', showInner).forEach((n) => showStep.fit.append(n))

  // Ceux qui écoutent: the sign-up goes inside the orbit
  const form = $('#join-form')
  const joinStep = card(
    'join',
    'show',
    `<p class="eyebrow">Ceux qui écoutent</p>
     <h2>${both('Hear it before anyone.', 'Entends-le avant tout le monde.')}</h2>
     <p class="sub">${both(
       'New songs, the story behind them, and the date of the show. Your email goes in the circle.',
       'Les nouvelles chansons, l’histoire derrière, et la date du spectacle. Ton courriel va dans le cercle.',
     )}</p>`,
  )
  if (form) formSlot.append(form)

  // EclipseTone
  const eclipseInner = $('.eclipse-band-inner')
  if (eclipseInner) {
    const e = card('eclipse', 'eclipse')
    e.fit.append(eclipseInner)
  }

  stepsRoot.innerHTML = steps.map((s, i) => `<div class="j-step" data-step="${i}"></div>`).join('')

  /* ——— Chapters: round the ring (wide screens) or in a row (phones) ——— */
  const firstOf = (key) => steps.findIndex((s) => s.key === key)
  const chapters = [
    { key: 'studio', step: firstOf('studio'), label: both('Studio', 'Studio') },
    { key: 'music', step: firstOf('song'), label: both('Music', 'Musique') },
    { key: 'story', step: firstOf('story'), label: both('Story', 'Histoire') },
    { key: 'show', step: firstOf('show'), label: both('Show', 'Spectacle') },
    { key: 'join', step: firstOf('join'), label: both('Join', 'Rejoindre') },
  ].filter((c) => c.step >= 0)
  chaptersNav.innerHTML = chapters
    .map((c) => `<button type="button" data-goto="${c.step}">${c.label}<i aria-hidden="true"></i></button>`)
    .join('')
  chaptersNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]')
    if (b) go(Number(b.dataset.goto))
  })

  /* ——— Status line: the message, always ——— */
  function renderStatus() {
    const year = Number(window.LAOUSMAIL_JOURNEY?.year) || new Date().getFullYear()
    const end = new Date(year, 11, 31, 23, 59, 59)
    const days = Math.max(0, Math.ceil((end - new Date()) / 86400000))
    const out = releases().length
    const inStudio = brewing() ? 1 : 0
    const narrow = document.documentElement.clientWidth < 600
    status.innerHTML =
      lang() === 'fr'
        ? `<b>${goal()} chansons${narrow ? '' : ' avant le spectacle'}</b><span>${out} sorties</span>${inStudio ? '<span>1 en studio</span>' : ''}<span>${days} jours</span>`
        : `<b>${goal()} songs${narrow ? '' : ' before the show'}</b><span>${out} out</span>${inStudio ? `<span>1 in ${narrow ? '' : 'the '}studio</span>` : ''}<span>${days} days</span>`
    const d = restStep && $('.j-days', restStep.el)
    if (d) d.textContent = t(`${days} days left in ${year}.`, `${days} jours avant la fin de ${year}.`)
  }

  /* ——— Layout: where the orbit sits and where the cards go ——— */
  let H = 0
  let geo = null
  let built = false

  function playerRoom() {
    const p = $('[data-player]')
    return p && !p.hidden ? p.offsetHeight + 16 : 0
  }

  // on phones the orbit takes less room for long cards, more for the sign-up
  const PHONE_SIZE = { landing: 0.3, studio: 0.26, song: 0.4, rest: 0.4, story: 0.34, show: 0.32, join: 0.6, eclipse: 0.36 }
  // below this the fifteen dots would touch: the orbit tucks into a small medallion instead
  const MIN_RING = 230
  const TUCKED = 112

  function layout() {
    renderStatus()
    H = window.innerHeight - navH()
    root.style.setProperty('--stage-h', `${H}px`)
    const W = document.documentElement.clientWidth
    const wide = W >= 900
    root.classList.toggle('is-wide', wide)
    root.style.setProperty('--status-h', `${status.offsetHeight}px`)
    const top0 = status.offsetHeight + (wide ? 0 : chaptersNav.offsetHeight) + 10
    const room = playerRoom()
    const byState = {}
    if (wide) {
      const S = Math.min(W * 0.42, H - top0 - 56, 640)
      const cx = W - S / 2 - Math.max(120, W * 0.07)
      const cy = top0 + (H - top0) / 2
      const gutter = Math.max(24, (W - 1320) / 2 + 24)
      const area = { left: gutter, top: top0 + 12, width: cx - S / 2 - 130 - gutter, height: H - top0 - 24 - room }
      for (const key of Object.keys(PHONE_SIZE)) byState[key] = { S, cx, cy, area }
    }
    geo = { W, wide, byState, byStep: [] }
    // on phones each card gets the orbit size it has room for
    const cx = W / 2
    const phoneGeo = (S, tucked) => {
      const cy = top0 + S / 2 + 8
      const aTop = cy + S / 2 + (tucked ? 16 : 22)
      return { S, cx, cy, tucked, area: { left: 16, top: aTop, width: W - 32, height: H - aTop - 12 - room } }
    }
    steps.forEach((s, i) => {
      if (wide) {
        geo.byStep[i] = byState[s.key]
        return
      }
      if (s.key === 'join') {
        geo.byStep[i] = phoneGeo(Math.min(W - 16, (H - top0) * 0.72), false)
        return
      }
      // how tall is this card at phone width?
      s.el.style.width = `${W - 32}px`
      s.fit.style.setProperty('--fit', '1')
      const need = s.fit.scrollHeight * 0.88
      const free = (S) => H - (top0 + 8 + S + 22) - 12 - room
      let S = Math.min(W * 0.74, Math.max(MIN_RING, (H - top0) * PHONE_SIZE[s.key]))
      if (free(S) < need) S = Math.min(S, H - top0 - 42 - room - need)
      geo.byStep[i] = S >= MIN_RING ? phoneGeo(S, false) : phoneGeo(TUCKED, true)
    })
    for (const [i, s] of steps.entries()) {
      const a = geo.byStep[i].area
      Object.assign(s.el.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${Math.max(200, a.width)}px`, height: `${Math.max(120, a.height)}px` })
    }
    placeOrbit()
    fitAll()
    paint()
  }

  // the orbit's place and size for the card on screen
  function placeOrbit() {
    const g = geo.byStep[Math.max(0, active)] || geo.byStep[0]
    geo.S = g.S
    // a small orbit keeps its centre simple: the card has the buttons
    root.classList.toggle('is-small', g.S < 240)
    root.classList.toggle('is-tucked', !!g.tucked)
    geo.cx = g.cx
    geo.cy = g.cy
    Object.assign(orbitSlot.style, { left: `${g.cx - g.S / 2}px`, top: `${g.cy - g.S / 2}px`, width: `${g.S}px` })
    orbit.style.setProperty('--size', `${g.S}px`)
    // chapters round the ring on wide screens
    if (geo.wide) {
      const n = Math.max(1, steps.length - 1)
      $$('button', chaptersNav).forEach((b) => {
        const step = Number(b.dataset.goto)
        const ang = (-90 + (360 * step) / n) * (Math.PI / 180)
        const r = g.S / 2 + 46
        b.style.left = `${g.cx + r * Math.cos(ang)}px`
        b.style.top = `${g.cy + r * Math.sin(ang)}px`
        b.classList.toggle('to-left', Math.cos(ang) < -0.2)
        b.classList.toggle('to-mid', Math.abs(Math.cos(ang)) <= 0.2)
      })
    } else {
      $$('button', chaptersNav).forEach((b) => {
        b.style.left = ''
        b.style.top = ''
      })
    }
  }

  // a card never scrolls inside itself: when it's taller than its space, it shrinks a little
  function fitAll() {
    for (const s of steps) {
      s.fit.style.setProperty('--fit', '1')
      const room = s.el.clientHeight
      const need = s.fit.scrollHeight
      const k = need > room ? Math.max(0.62, room / need) : 1
      s.fit.style.setProperty('--fit', k.toFixed(3))
    }
    fitForm()
  }

  // the sign-up shrinks a little if the circle is small
  function fitForm() {
    if (!form) return
    formSlot.style.setProperty('--fit', '1')
    const roomH = formSlot.clientHeight
    const roomW = formSlot.clientWidth
    const k = Math.min(1, roomH / Math.max(1, form.scrollHeight), roomW / Math.max(1, form.scrollWidth))
    formSlot.style.setProperty('--fit', Math.max(0.6, k).toFixed(3))
  }

  /* ——— Scrolling: which card, and how far between two ——— */
  const stepsTop = () => stepsRoot.getBoundingClientRect().top + window.scrollY
  const position = () => (window.scrollY + navH() - stepsTop()) / H

  function go(i, smooth = true) {
    const y = stepsTop() + i * H - navH()
    window.scrollTo({ top: Math.round(y), behavior: smooth ? 'smooth' : 'auto' })
  }

  let active = -1
  const seen = new Set()

  function paint() {
    if (!geo) return
    const pos = Math.min(steps.length - 1, Math.max(0, position()))
    const now = Math.min(steps.length - 1, Math.max(0, Math.round(pos)))
    for (let i = 0; i < steps.length; i += 1) {
      const d = pos - i
      const s = steps[i]
      const vis = clamp01(1 - Math.abs(d) * 1.7)
      s.el.style.opacity = vis.toFixed(3)
      s.el.style.transform = `translateY(${(-d * 46).toFixed(1)}px)`
      const on = Math.abs(d) < 0.35
      s.el.classList.toggle('is-on', on)
      s.el.style.visibility = vis > 0.01 ? 'visible' : 'hidden'
    }
    if (now !== active) {
      setState(now)
      placeOrbit()
      window.setTimeout(fitForm, 750)
    }
    // the marker travels round the ring with you
    const ang = (-90 + (360 * pos) / Math.max(1, steps.length - 1)) * (Math.PI / 180)
    const r = geo.S / 2 + 18
    marker.style.transform = `translate(${(geo.cx + r * Math.cos(ang)).toFixed(1)}px, ${(geo.cy + r * Math.sin(ang)).toFixed(1)}px)`
    $$('button', chaptersNav).forEach((b, k) => {
      const from = chapters[k].step
      const to = k + 1 < chapters.length ? chapters[k + 1].step : steps.length
      b.style.setProperty('--fill', (clamp01((pos - from + 0.5) / Math.max(1, to - from)) * 100).toFixed(1))
    })
    drawBeam(pos)
  }

  // the light that joins a song's dot to its card
  function drawBeam(pos) {
    const s = steps[active]
    const node = s?.node
    const vis = s ? clamp01(1 - Math.abs(pos - active) * 2.4) : 0
    if (!node || vis <= 0) {
      beam.style.opacity = '0'
      return
    }
    const sr = stage.getBoundingClientRect()
    const nr = node.getBoundingClientRect()
    const cr = s.el.getBoundingClientRect()
    const x1 = nr.left + nr.width / 2 - sr.left
    const y1 = nr.top + nr.height / 2 - sr.top
    const x2 = geo.wide ? cr.right - sr.left + 8 : cr.left + cr.width / 2 - sr.left
    const y2 = geo.wide ? cr.top + cr.height / 2 - sr.top : cr.top - sr.top - 6
    beamLine.setAttribute('x1', x1.toFixed(1))
    beamLine.setAttribute('y1', y1.toFixed(1))
    beamLine.setAttribute('x2', x2.toFixed(1))
    beamLine.setAttribute('y2', y2.toFixed(1))
    const grad = $('#j-beam-grad', beam)
    grad.setAttribute('x1', x1.toFixed(1))
    grad.setAttribute('y1', y1.toFixed(1))
    grad.setAttribute('x2', x2.toFixed(1))
    grad.setAttribute('y2', y2.toFixed(1))
    beam.style.opacity = vis.toFixed(3)
  }

  /* ——— What the orbit becomes for each card ——— */
  function setState(i) {
    active = i
    const s = steps[i]
    root.dataset.state = s.key
    $$('.j-on', orbitStage).forEach((n) => n.classList.remove('j-on'))
    s.node = null
    let focus = null
    if (s.key === 'studio') {
      focus = 'studio'
      s.node = $('.node-studio', orbitStage)
    } else if (s.key === 'song') {
      focus = s.index
      s.node = $(`[data-orbit-song="${s.index}"]`, orbitStage)
    } else if (s.key === 'rest') focus = 'rest'
    s.node?.classList.add('j-on')
    window.laousmailOrbitFocus?.(focus)

    // the centre for the story, the show, the eclipse
    const strong = $('.j-core-text strong', core)
    const small = $('.j-core-text small', core)
    if (s.key === 'story') {
      root.dataset.chapter = String(s.chapter)
      strong.textContent = pad(s.chapter + 1)
      small.textContent = $('h3', s.el)?.querySelector(`[data-lang="${lang()}"]`)?.textContent || ''
    } else if (s.key === 'show') {
      strong.textContent = `${goal()} / ${goal()}`
      small.textContent = t('the circle is full: the show', 'le cercle est plein: le spectacle')
    } else {
      strong.textContent = ''
      small.textContent = ''
    }
    $$('.j-points i', orbitStage).forEach((p, k) => p.classList.toggle('is-on', s.key === 'story' && k <= s.chapter))
    $$('button', chaptersNav).forEach((b, k) => {
      const from = chapters[k].step
      const to = k + 1 < chapters.length ? chapters[k + 1].step : steps.length
      const on = i >= from && i < to
      b.classList.toggle('is-now', on)
      if (on) b.setAttribute('aria-current', 'step')
      else b.removeAttribute('aria-current')
    })
    // count each part once per visit
    const names = { home: 'Hero', studio: 'Studio', music: 'Music', story: 'Story', show: 'Show', eclipse: 'EclipseTone' }
    const name = s.key === 'join' ? 'Join' : names[s.place]
    if (name && !seen.has(name)) {
      seen.add(name)
      window.laousmailTrack?.(`Reached ${name}`)
    }
  }

  /* ——— The song copies play the real buttons, and show what's playing ——— */
  cardsRoot.addEventListener('click', (e) => {
    const play = e.target.closest('.j-card-song [data-play]')
    if (!play) return
    e.preventDefault()
    $(`[data-tracks] [data-play="${play.dataset.play}"]`)?.click()
    window.setTimeout(syncPlaying, 50)
  })

  function syncPlaying() {
    for (const step of songSteps) {
      const src = $(`[data-tracks] [data-track="${step.index}"]`)
      const copy = $('.j-one > li', step.fit)
      if (!src || !copy) continue
      copy.classList.toggle('is-playing', src.classList.contains('is-playing'))
      $$('[data-play]', copy).forEach((b) => b.classList.toggle('is-playing', src.classList.contains('is-playing')))
    }
  }

  /* ——— Links to parts of the page land on their card ——— */
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return
      const id = link.getAttribute('href').slice(1)
      const stay = link.getAttribute('data-umami-event') === 'Stay close button'
      const map = { top: 0, music: firstOf('song'), studio: firstOf('studio'), story: firstOf('story'), show: stay ? firstOf('join') : firstOf('show') }
      const i = map[id]
      if (i === undefined || i < 0) return
      // preventDefault also tells the site's own link handler to stand back
      e.preventDefault()
      go(i)
    },
    true,
  )

  // keyboard: moving focus into a card brings that card to the front
  cardsRoot.addEventListener('focusin', (e) => {
    const el = e.target.closest('.j-card')
    const i = steps.findIndex((s) => s.el === el)
    if (i >= 0 && i !== active) go(i, false)
  })
  formSlot.addEventListener('focusin', () => {
    const i = firstOf('join')
    if (i >= 0 && i !== active) go(i, false)
  })

  /* ——— Start ——— */
  fillSongs()
  renderStatus()
  window.setInterval(renderStatus, 60000)
  built = true
  layout()
  setState(Math.max(0, Math.min(steps.length - 1, Math.round(position()))))
  placeOrbit()

  let raf = 0
  window.addEventListener(
    'scroll',
    () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          paint()
        })
    },
    { passive: true },
  )
  let resizeTimer = 0
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(layout, 120)
  })
  document.fonts?.ready.then(layout)
  window.addEventListener('load', layout, { once: true })

  // the song list is rebuilt on a language change; the language also changes the words
  const list = $('[data-tracks]')
  if (list) {
    new MutationObserver(fillSongs).observe(list, { childList: true })
    new MutationObserver(syncPlaying).observe(list, { subtree: true, attributes: true, attributeFilter: ['class'] })
  }
  new MutationObserver(() => {
    renderStatus()
    const i = active
    active = -1
    setState(i)
    layout()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  const player = $('[data-player]')
  if (player) new MutationObserver(layout).observe(player, { attributes: true, attributeFilter: ['hidden'] })
})()
