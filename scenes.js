/* laousmail.com — scroll scenes. Every part of the landing page plays like
   "In the studio now": the section holds still under the nav while you
   scroll, and the scroll drives what happens inside it.

   - Hero: the words step back and the orbit glides to the centre.
   - Music: one song at a time takes the stage; a rail shows where you are
     and jumps to any song.
   - Story: one chapter at a time beside the photo, which slowly warms up.
   - The show: the light grows, then the title, the words and the sign-up
     arrive.

   A scene pins only when it fits on screen (with room for the mini-player).
   Otherwise the page reads as before and the scene plays once as it
   arrives. With reduced motion nothing pins and everything simply shows. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamp01 = (v) => Math.min(1, Math.max(0, v))
  const lang = () => (document.documentElement.lang === 'fr' ? 'fr' : 'en')
  const navH = () => $('.nav')?.offsetHeight || 64
  const playerRoom = () => {
    const player = $('[data-player]')
    return player && !player.hidden ? player.offsetHeight + 16 : 0
  }

  /* ——— A rail of numbered stops (songs, chapters) that also jumps to each ——— */
  function buildRail(scene, items, label) {
    let rail = $('.scene-rail', scene.el)
    if (!rail) {
      rail = document.createElement('ol')
      rail.className = 'scene-rail'
      scene.railAt.before(rail)
      rail.addEventListener('click', (e) => {
        const b = e.target.closest('[data-stop]')
        if (b) scene.jump(Number(b.dataset.stop))
      })
    }
    rail.setAttribute('aria-label', label())
    rail.innerHTML = items
      .map(
        (name, i) =>
          `<li><button type="button" data-stop="${i}"><b>${String(i + 1).padStart(2, '0')}</b><span>${name}</span><i aria-hidden="true"></i></button></li>`,
      )
      .join('')
    return rail
  }

  // The visible text of an element in the current language
  function text(el) {
    if (!el) return ''
    const own = el.querySelector(`[data-lang="${lang()}"]`)
    return (own || el).textContent.trim().replace(/\s+/g, ' ')
  }

  /* ——— Scene definitions ——— */
  const defs = {
    hero: {
      travel: 0.7,
      ignorePlayer: true,
      idle: 0,
      setup(scene) {
        scene.orbit = $('.orbit', scene.section)
      },
      measure(scene) {
        // how far the orbit has to travel to reach the middle of the screen
        scene.el.style.setProperty('--shift', '0px')
        const r = scene.orbit?.getBoundingClientRect()
        const shift = r ? window.innerWidth / 2 - (r.left + r.width / 2) : 0
        scene.el.style.setProperty('--shift', `${Math.round(shift)}px`)
      },
      paint(scene, p) {
        const q = clamp01((p - 0.25) / 0.75)
        const ease = 1 - Math.pow(1 - q, 3)
        scene.el.style.setProperty('--q', ease.toFixed(3))
        scene.el.style.setProperty('--copy-vis', p > 0.42 ? 'hidden' : 'visible')
      },
    },

    music: {
      perStop: 0.55,
      idle: 1,
      setup(scene) {
        scene.list = $('.tracks', scene.section)
        scene.railAt = scene.list
        scene.label = () => (lang() === 'fr' ? 'Les chansons' : 'The songs')
      },
      stops: (scene) => $$('.track', scene.list),
      names: (scene) => scene.stops.map((li) => li.dataset.title || text($('h3', li))),
    },

    story: {
      perStop: 0.5,
      idle: 1,
      setup(scene) {
        scene.list = $('.beats', scene.section)
        scene.railAt = scene.list
        scene.label = () => (lang() === 'fr' ? 'Les chapitres' : 'The chapters')
      },
      stops: (scene) => $$('li', scene.list),
      names: (scene) => scene.stops.map((li) => text($('h3', li))),
    },

    show: {
      travel: 0.9,
      idle: 1,
      // a link to the show (Stay close) lands where the sign-up is ready
      landAt: 1,
      paint(scene, p) {
        scene.el.style.setProperty('--join-vis', p > 0.45 ? 'visible' : 'hidden')
      },
    },
  }

  /* ——— The engine ——— */
  const scenes = $$('.scene[data-scene]')
    .map((el) => {
      const def = defs[el.dataset.scene]
      const section = el.firstElementChild
      if (!def || !section) return null
      const scene = { el, def, section, pinned: false, p: def.idle, stops: [], active: -1, played: false, pending: false }
      def.setup?.(scene)
      return scene
    })
    .filter(Boolean)

  if (!scenes.length) return

  function travelOf(scene) {
    const per = scene.def.perStop
    const n = scene.stops.length
    return window.innerHeight * (per ? Math.max(1, n) * per : scene.def.travel)
  }

  function refreshStops(scene) {
    if (!scene.def.stops) return
    scene.stops = scene.def.stops(scene)
    scene.rail = buildRail(scene, scene.def.names(scene), scene.label)
    scene.active = -1
  }

  function paint(scene, p) {
    scene.p = p
    scene.el.style.setProperty('--p', p.toFixed(3))
    if (scene.stops.length) {
      const n = scene.stops.length
      const pos = p * n
      const active = Math.min(n - 1, Math.floor(pos))
      if (active !== scene.active) {
        scene.active = active
        scene.stops.forEach((li, i) => {
          li.classList.toggle('is-now', i === active)
          li.classList.toggle('is-past', i < active)
          li.toggleAttribute('inert', scene.pinned && i !== active)
        })
        $$('button', scene.rail).forEach((b, i) => {
          b.classList.toggle('is-now', i === active)
          b.classList.toggle('is-past', i < active)
          if (i === active) b.setAttribute('aria-current', 'step')
          else b.removeAttribute('aria-current')
        })
      }
      // each stop's own little bar fills as you go
      $$('i', scene.rail).forEach((bar, i) => bar.style.setProperty('--fill', (clamp01(pos - i) * 100).toFixed(1)))
    }
    scene.def.paint?.(scene, p)
  }

  function progress(scene) {
    const travel = travelOf(scene)
    const top = scene.el.getBoundingClientRect().top
    return clamp01((navH() - top) / travel)
  }

  // Pin only when the scene fits on screen
  function setMode(scene) {
    scene.pending = false
    refreshStops(scene)
    scene.el.classList.add('is-pinned')
    scene.el.style.height = ''
    const room = scene.def.ignorePlayer ? 0 : playerRoom()
    const fits = !reduceMotion && scene.section.offsetHeight + room <= window.innerHeight - navH() + 1
    scene.pinned = fits
    if (fits) {
      scene.el.style.setProperty('--player-room', `${room}px`)
      scene.def.measure?.(scene)
      scene.el.style.height = `${Math.ceil(scene.section.offsetHeight + travelOf(scene))}px`
      scene.active = -1
      paint(scene, progress(scene))
    } else {
      scene.el.classList.remove('is-pinned')
      scene.stops.forEach((li) => li.removeAttribute('inert'))
      scene.active = -1
      playOnce(scene)
    }
  }

  // When a scene can't pin, it plays once as it arrives (or just shows, with reduced motion)
  function playOnce(scene) {
    const end = scene.def.idle
    if (reduceMotion || scene.played || end === 0 || !('IntersectionObserver' in window)) {
      paint(scene, end)
      return
    }
    paint(scene, 0)
    scene.watcher?.disconnect()
    scene.watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        scene.watcher.disconnect()
        scene.played = true
        const start = performance.now()
        const step = (now) => {
          if (scene.pinned) return
          const k = Math.min(1, (now - start) / 1400)
          paint(scene, 1 - Math.pow(1 - k, 3))
          if (k < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      },
      { threshold: 0.2 },
    )
    scene.watcher.observe(scene.section)
  }

  // Changing the layout under the reader would make the page jump: wait until they leave
  function relayout(scene) {
    const r = scene.el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) return setMode(scene)
    scene.pending = true
    // while in view, keep the length right without changing the layout
    if (scene.pinned) scene.el.style.height = `${Math.ceil(scene.section.offsetHeight + travelOf(scene))}px`
  }

  // Scroll to a stop of a scene (rail buttons), or to where a scene is ready (links)
  function scrollToProgress(scene, p) {
    const y = window.scrollY + scene.el.getBoundingClientRect().top - navH() + travelOf(scene) * p
    window.scrollTo({ top: Math.round(y) + 1, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  for (const scene of scenes) {
    scene.jump = (i) => {
      if (!scene.pinned) {
        scene.stops[i]?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
        return
      }
      scrollToProgress(scene, (i + 0.35) / scene.stops.length)
    }
  }

  // Links to a pinned scene (like Stay close → the show) land where it is ready
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return
      const id = link.getAttribute('href').slice(1)
      const scene = scenes.find((s) => s.section.id === id)
      if (!scene || !scene.pinned || scene.def.landAt === undefined) return
      // preventDefault also tells the site's own link handler to stand back
      e.preventDefault()
      scrollToProgress(scene, scene.def.landAt)
      if (!scene.section.hasAttribute('tabindex')) scene.section.setAttribute('tabindex', '-1')
      scene.section.focus({ preventScroll: true })
    },
    true,
  )

  let raf = 0
  function update() {
    raf = 0
    for (const scene of scenes) {
      if (scene.pending) {
        const r = scene.el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight) setMode(scene)
      }
      if (scene.pinned) paint(scene, progress(scene))
    }
  }

  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(update)
  }, { passive: true })

  let resizeTimer = 0
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => scenes.forEach(setMode), 120)
  })

  // the song list is rebuilt on a language change: rebuild its rail too
  const music = scenes.find((s) => s.def === defs.music)
  if (music?.list && 'MutationObserver' in window) {
    new MutationObserver(() => relayout(music)).observe(music.list, { childList: true })
  }
  // a new language changes the chapter names and the heights
  new MutationObserver(() => scenes.forEach(relayout)).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  })
  // the mini-player takes room at the bottom
  const player = $('[data-player]')
  if (player) new MutationObserver(() => scenes.forEach(relayout)).observe(player, { attributes: true, attributeFilter: ['hidden'] })

  // fonts change heights: measure again once they are in
  scenes.forEach(setMode)
  document.fonts?.ready.then(() => scenes.forEach(relayout))
  window.addEventListener('load', () => scenes.forEach(relayout), { once: true })
})()
