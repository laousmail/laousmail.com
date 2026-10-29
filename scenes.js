/* laousmail.com — scroll scenes. Every part of the landing page plays like
   "In the studio now": the section holds still under the nav while you
   scroll, and the scroll drives what happens inside it.

   - Hero: the words step back, then the songs leave the orbit one by one,
     newest first (the one in the studio, then the latest release, down to
     the first). Each dot flies down and grows into the song's card; the
     cards before it gather in a small list. The songs still to come leave
     last, together. Then the orbit fades. This replaces the music list.
   - Music: shown only when the orbit scene can't play (one song at a time,
     with a rail that shows where you are and jumps to any song).
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

  /* ——— The orbit gives up its songs ———
     Each song is a stop. Its dot on the ring flies to the card's cover and
     grows into it (a "ghost" copy of the dot does the flying), then the card
     fills in. The previous card joins the list of songs already shown. */
  const INTRO = 0.5
  const STOP = 0.75
  const OUTRO = 0.35
  const ease = (k) => 1 - Math.pow(1 - k, 3)
  const lerp = (a, b, k) => a + (b - a) * k

  const morph = {
    setup(scene) {
      scene.orbit = $('.orbit', scene.section)
      scene.stage = $('.orbit-stage', scene.section)
      scene.cards = []
      const layer = document.createElement('div')
      layer.className = 'morph'
      layer.innerHTML = '<ol class="morph-cards"></ol><ol class="morph-past"></ol>'
      scene.section.append(layer)
      scene.layer = layer
      scene.cardList = $('.morph-cards', layer)
      scene.pastList = $('.morph-past', layer)
      const ghosts = document.createElement('div')
      ghosts.className = 'morph-ghosts'
      ghosts.setAttribute('aria-hidden', 'true')
      // copies of the dots only fly: they can't be focused or clicked
      ghosts.inert = true
      scene.section.append(ghosts)
      scene.ghostLayer = ghosts
      // the cards are copies: their play buttons press the real ones
      layer.addEventListener('click', (e) => {
        const play = e.target.closest('[data-play]')
        if (play) {
          e.preventDefault()
          document.querySelector(`[data-tracks] [data-play="${play.dataset.play}"]`)?.click()
          return
        }
        const back = e.target.closest('[data-card]')
        if (back) {
          const i = Number(back.dataset.card)
          scrollToProgress(scene, (INTRO + STOP * (i + 0.7)) / defs.hero.units(scene))
        }
      })
    },

    build(scene) {
      const src = $$('[data-tracks] > li')
      // newest first: the song in the studio, then the releases from the latest down
      const songs = src.filter((li) => li.classList.contains('track')).reverse()
      const rest = src.find((li) => li.classList.contains('track-rest'))
      scene.cards = songs.map((li) => ({
        kind: li.classList.contains('track-studio') ? 'studio' : 'song',
        index: li.dataset.track,
        title: li.dataset.title || text($('h3', li)),
        src: li,
      }))
      if (rest) scene.cards.push({ kind: 'rest', title: text(rest), src: rest })
      scene.cardList.replaceChildren(
        ...scene.cards.map((c, i) => {
          const li = c.src.cloneNode(true)
          li.classList.add('mcard', `mcard-${c.kind}`)
          li.removeAttribute('style')
          li.dataset.card = String(i)
          if (c.kind === 'studio') {
            const ring = $('.node-studio')
            if (ring) li.style.setProperty('--sp', ring.style.getPropertyValue('--p') || '0')
          }
          if (c.kind === 'rest') {
            // the songs still to come: their dots, then the line about them
            li.innerHTML = '<span class="mcard-dots" aria-hidden="true"></span><p class="mcard-rest-text"></p>'
            $('.mcard-dots', li).innerHTML = '<i></i>'.repeat(morph.nodes(scene, c).length)
            $('.mcard-rest-text', li).textContent = c.title
          }
          c.card = li
          return li
        }),
      )
      scene.pastList.setAttribute('aria-label', lang() === 'fr' ? 'Chansons déjà vues' : 'Songs so far')
      scene.pastList.replaceChildren(
        ...scene.cards
          .filter((c) => c.kind !== 'rest')
          .map((c, i) => {
            const li = document.createElement('li')
            const img = $('img', c.src)
            li.innerHTML = `<button type="button" data-card="${i}"><span class="mp-art">${
              img ? `<img src="${img.getAttribute('src')}" alt="" width="40" height="40" />` : `<b>${$('.track-art', c.src)?.textContent.trim() || ''}</b>`
            }</span><span class="mp-title"></span></button>`
            $('.mp-title', li).textContent = c.title
            // covers can fall back to a local picture: follow whatever the list ends up showing
            $('img', li)?.addEventListener('error', (e) => {
              const now = $('img', morph.nodes(scene, c)[0] || c.src)?.currentSrc
              if (now && e.target.src !== now) e.target.src = now
            })
            li.hidden = true
            c.pastItem = li
            return li
          }),
      )
      scene.ghostLayer.replaceChildren()
      scene.firstSeen = false
    },

    // the dots on the ring that belong to a card
    nodes(scene, c) {
      if (c.kind === 'song') return [$(`[data-orbit-song="${c.index}"]`, scene.stage)].filter(Boolean)
      if (c.kind === 'studio') return [$('.node-studio', scene.stage)].filter(Boolean)
      return $$('.node-future', scene.stage)
    },

    ghostsFor(scene, c) {
      if (c.ghosts?.length && c.ghosts[0].isConnected) return c.ghosts
      c.ghosts = morph.nodes(scene, c).map((node) => {
        const g = node.cloneNode(true)
        g.classList.add('morph-ghost')
        g.removeAttribute('href')
        g.removeAttribute('aria-label')
        g.removeAttribute('data-orbit-song')
        g.querySelector('.node-tip')?.remove()
        scene.ghostLayer.append(g)
        return g
      })
      return c.ghosts
    },

    onMode(scene, on) {
      document.body.classList.toggle('morph-on', on)
      if (!on) {
        scene.el.classList.remove('is-morphing')
        scene.orbit.style.translate = ''
        scene.orbit.style.scale = ''
        scene.orbit.style.filter = ''
        delete scene.orbit.dataset.fade
        $$('.orbit-nodes li', scene.stage).forEach((li) => (li.style.opacity = ''))
      }
      // the music section steps aside (or comes back) as the orbit takes over
      const musicScene = scenes.find((x) => x.def === defs.music)
      if (musicScene) setMode(musicScene)
    },

    // where things start and land, in the section's own coordinates
    measure(scene) {
      const o = scene.orbit
      o.style.translate = ''
      o.style.scale = ''
      const sec = scene.section.getBoundingClientRect()
      const st = scene.stage.getBoundingClientRect()
      const top = pinTop(scene)
      const winTop = navH() - top
      const winBottom = window.innerHeight - top - 12
      const offX = -sec.left
      const s0 = st.width
      const c0 = { x: st.left - sec.left + s0 / 2, y: st.top - sec.top + s0 / 2 }
      const wide = window.innerWidth > 900
      let S
      let c1
      let stage
      if (wide) {
        S = Math.min(s0, (winBottom - winTop) * 0.82)
        c1 = { x: c0.x, y: (winTop + winBottom) / 2 }
        const copy = $('.hero-copy', scene.section).getBoundingClientRect()
        stage = { left: copy.left - sec.left, width: copy.width, top: winTop + 20, height: winBottom - winTop - 28 }
      } else {
        S = Math.min(window.innerWidth * 0.56, (winBottom - winTop) * 0.36)
        c1 = { x: offX + window.innerWidth / 2, y: winTop + 8 + S / 2 }
        const top2 = winTop + 8 + S + 16
        stage = { left: offX + 16, width: window.innerWidth - 32, top: top2, height: winBottom - top2 }
      }
      o.style.transformOrigin = `50% ${s0 / 2}px`
      scene.move = { dx: c1.x - c0.x, dy: c1.y - c0.y, k: S / s0 }
      Object.assign(scene.layer.style, {
        left: `${stage.left}px`,
        top: `${stage.top}px`,
        width: `${stage.width}px`,
        height: `${Math.max(120, stage.height)}px`,
      })
    },

    paint(scene, p) {
      if (!scene.pinned || !scene.move) return
      const n = scene.cards.length
      const u = p * defs.hero.units(scene)
      const a = ease(clamp01(u / INTRO))
      const out = clamp01((u - INTRO - STOP * n) / OUTRO)
      const { dx, dy, k } = scene.move
      const o = scene.orbit
      o.style.translate = `${(dx * a).toFixed(1)}px ${(dy * a).toFixed(1)}px`
      o.style.scale = ((1 + (k - 1) * a) * (1 - out * 0.25)).toFixed(4)
      o.style.filter = out > 0 ? `opacity(${(1 - out).toFixed(3)})` : ''
      // the living field around the orbit fades with it
      o.dataset.fade = (1 - out).toFixed(3)
      scene.el.style.setProperty('--a', a.toFixed(3))
      scene.el.style.setProperty('--copy-vis', a > 0.6 ? 'hidden' : 'visible')
      scene.el.classList.toggle('is-morphing', u > 0.02)

      const sec = scene.section.getBoundingClientRect()
      const rel = (r) => ({ x: r.left - sec.left, y: r.top - sec.top, w: r.width, h: r.height })
      let active = -1
      scene.cards.forEach((c, i) => {
        if (u >= INTRO + STOP * i) active = i
      })
      if (active >= 0 && !scene.firstSeen) {
        scene.firstSeen = true
        window.laousmailTrack?.('Reached Music')
      }

      scene.cards.forEach((c, i) => {
        const t = (u - INTRO - STOP * i) / STOP
        const now = i === active
        const past = i < active
        c.card.classList.toggle('is-now', now)
        c.card.toggleAttribute('inert', !now)
        const fill = now ? clamp01((t - 0.42) / 0.3) : 0
        c.card.style.setProperty('--c', fill.toFixed(3))
        c.card.style.setProperty('--art', now && t >= 0.5 ? '1' : '0')
        c.card.classList.toggle('is-live', now && fill > 0.5)
        if (now) {
          const mine = $('img', c.card)
          const real = $('img', c.src)?.currentSrc
          if (mine && real && mine.currentSrc !== real) mine.src = real
        }
        if (c.pastItem) c.pastItem.hidden = !past

        // its dots leave the ring once it starts
        const nodes = morph.nodes(scene, c)
        nodes.forEach((node) => {
          const li = node.closest('li')
          if (li) li.style.opacity = t > 0 ? '0' : ''
        })

        // the flight: from the dot to the card's cover
        const flying = t > 0 && t < 0.62
        const ghosts = flying ? morph.ghostsFor(scene, c) : c.ghosts || []
        if (!flying) {
          ghosts.forEach((g) => (g.style.opacity = '0'))
          return
        }
        const f = ease(clamp01(t / 0.5))
        const fade = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.12
        const art = $('.track-art', c.card) || c.card
        const to = rel(art.getBoundingClientRect())
        if (c.kind === 'rest') {
          const dots = $('.mcard-dots', c.card)
          if (dots) Object.assign(to, rel(dots.getBoundingClientRect()))
        }
        ghosts.forEach((g, j) => {
          const from = rel(nodes[j].getBoundingClientRect())
          const lag = c.kind === 'rest' ? j * 0.03 : 0
          const ff = ease(clamp01((t - lag) / 0.5))
          const size = c.kind === 'rest' ? lerp(from.w, 10, ff) : lerp(from.w, to.w, f)
          const sizeH = c.kind === 'rest' ? size : lerp(from.h, to.h, f)
          const tx = c.kind === 'rest' ? to.x + (to.w / ghosts.length) * (j + 0.5) - size / 2 : to.x
          const ty = c.kind === 'rest' ? to.y + to.h / 2 - size / 2 : to.y
          const kk = c.kind === 'rest' ? ff : f
          const x = lerp(from.x, tx, kk)
          const y = lerp(from.y, ty, kk) - Math.sin(Math.PI * kk) * 36
          Object.assign(g.style, {
            left: `${x.toFixed(1)}px`,
            top: `${y.toFixed(1)}px`,
            width: `${size.toFixed(1)}px`,
            height: `${sizeH.toFixed(1)}px`,
            borderRadius: c.kind === 'song' ? `${lerp(size / 2, 14, f).toFixed(1)}px` : '50%',
            opacity: fade.toFixed(3),
          })
        })
      })
    },
  }

  /* ——— Scene definitions ——— */
  const defs = {
    hero: {
      tall: true,
      ignorePlayer: true,
      idle: 0,
      // screens of scroll: the words step back, each song leaves, the orbit fades
      units: (scene) => INTRO + STOP * Math.max(1, scene.cards.length) + OUTRO,
      landOnSongs: (scene) => (INTRO + STOP * 0.7) / defs.hero.units(scene),
      setup: (scene) => morph.setup(scene),
      build: (scene) => morph.build(scene),
      onMode: (scene, on) => morph.onMode(scene, on),
      measure: (scene) => morph.measure(scene),
      paint: (scene, p) => morph.paint(scene, p),
    },

    music: {
      perStop: 0.55,
      idle: 1,
      // the orbit scene shows the songs itself
      skip: () => document.body.classList.contains('morph-on'),
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
    if (scene.def.units) return window.innerHeight * scene.def.units(scene)
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

  // where the section holds: under the nav, or (for a tall one) with its bottom on screen
  const pinTop = (scene) => (scene.pinTop ?? navH())

  function progress(scene) {
    const travel = travelOf(scene)
    const top = scene.el.getBoundingClientRect().top
    return clamp01((pinTop(scene) - top) / travel)
  }

  // Pin only when the scene fits on screen
  function setMode(scene) {
    scene.pending = false
    if (scene.def.skip?.()) {
      scene.pinned = false
      scene.el.classList.remove('is-pinned')
      scene.el.style.height = ''
      return
    }
    refreshStops(scene)
    scene.def.build?.(scene)
    scene.el.classList.add('is-pinned')
    scene.el.style.height = ''
    scene.el.style.removeProperty('--pin-top')
    scene.pinTop = undefined
    const room = scene.def.ignorePlayer ? 0 : playerRoom()
    const fits =
      !reduceMotion &&
      (scene.def.tall
        ? window.innerHeight >= 520 && window.innerWidth >= 340
        : scene.section.offsetHeight + room <= window.innerHeight - navH() + 1)
    scene.pinned = fits
    if (fits && scene.def.tall) {
      scene.pinTop = Math.min(navH(), window.innerHeight - room - scene.section.offsetHeight)
      scene.el.style.setProperty('--pin-top', `${scene.pinTop}px`)
    }
    scene.def.onMode?.(scene, fits)
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
    const y = window.scrollY + scene.el.getBoundingClientRect().top - pinTop(scene) + travelOf(scene) * p
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
      // the songs live in the orbit scene when it plays
      const hero = scenes.find((s) => s.def === defs.hero)
      if (id === 'music' && hero?.pinned) {
        e.preventDefault()
        scrollToProgress(hero, defs.hero.landOnSongs(hero))
        return
      }
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

  // the song list is rebuilt on a language change: rebuild its rail and the orbit's cards too
  const music = scenes.find((s) => s.def === defs.music)
  const heroScene = scenes.find((s) => s.def === defs.hero)
  if (music?.list && 'MutationObserver' in window) {
    new MutationObserver(() => {
      relayout(music)
      if (!heroScene) return
      // the cards are copies of the list: refresh them at once, in place
      if (heroScene.pinned) {
        heroScene.def.build(heroScene)
        heroScene.active = -1
        paint(heroScene, progress(heroScene))
      }
      relayout(heroScene)
    }).observe(music.list, { childList: true })
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
