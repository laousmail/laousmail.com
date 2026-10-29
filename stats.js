/* laousmail.com — visit counts, sent to Umami (umami.is).
   Served from this site, so no outside code runs on the page. It speaks
   Umami's own protocol (one small JSON message per event to /api/send) and
   sends nothing personal: no cookies, no names or emails. Umami keeps counts
   only (pages, country, device, where visitors came from).

   What it counts:
   - a page view
   - clicks on anything tagged data-umami-event="…" (extra details come from
     data-umami-event-<name>="…")
   - each section of the home page that comes into view, once per visit
   - how long people stay: 30 s, 1 min, 3 min and 5 min of the page being open
     and in front of them
   - events the site reports itself, via window.laousmailTrack(name, data)

   Your own visits: open the site once with ?stats=off to stop counting
   yourself on that device (?stats=on to count again). */
(() => {
  const WEBSITE = '40b1c7aa-812b-41f9-9e01-4b39c0af0fae'
  const ENDPOINT = 'https://cloud.umami.is/api/send'
  const HOSTS = ['laousmail.com', 'www.laousmail.com']

  let off = false
  try {
    const q = new URLSearchParams(location.search).get('stats')
    if (q === 'off') localStorage.setItem('umami.disabled', '1')
    if (q === 'on') localStorage.removeItem('umami.disabled')
    off = !!localStorage.getItem('umami.disabled')
  } catch {
    /* private mode: count as usual */
  }
  // only the real site counts: previews and local copies send nothing
  const live = HOSTS.includes(location.hostname) && !off

  let cache = ''
  function send(name, data) {
    if (!live) return
    const payload = {
      website: WEBSITE,
      hostname: location.hostname,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language,
      title: encodeURIComponent(document.title),
      url: encodeURI(location.pathname),
      referrer: encodeURI(document.referrer),
    }
    if (name) {
      payload.name = String(name).slice(0, 50)
      if (data && typeof data === 'object') payload.data = data
    }
    const headers = { 'Content-Type': 'application/json' }
    if (cache) headers['x-umami-cache'] = cache
    // keepalive lets the message finish even when the click leaves the page
    fetch(ENDPOINT, { method: 'POST', body: JSON.stringify({ type: 'event', payload }), headers, keepalive: true })
      .then((r) => r.text())
      .then((text) => {
        if (text && text.length < 2000) cache = text
      })
      .catch(() => {})
  }

  window.laousmailTrack = (name, data) => send(name, data)

  // the page view
  if (document.readyState === 'complete') send()
  else window.addEventListener('load', () => send(), { once: true })

  // tagged clicks
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target.closest?.('[data-umami-event]')
      if (!el) return
      const data = {}
      for (const attr of el.getAttributeNames()) {
        const m = attr.match(/^data-umami-event-([\w-]+)$/)
        if (m) data[m[1]] = el.getAttribute(attr)
      }
      send(el.getAttribute('data-umami-event'), Object.keys(data).length ? data : undefined)
    },
    true,
  )

  // links that leave the site: where to, from which song and which part of the page
  const PLACES = [
    [/spotify\./, 'Spotify'],
    [/youtube\.|youtu\.be/, 'YouTube'],
    [/music\.apple\./, 'Apple Music'],
    [/instagram\./, 'Instagram'],
    [/tiktok\./, 'TikTok'],
    [/eclipsetone\./, 'EclipseTone'],
  ]
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest?.('a[href]')
      if (!a || a.hasAttribute('data-umami-event')) return
      let host = ''
      try {
        const u = new URL(a.href, location.href)
        if (u.hostname === location.hostname || !/^https?:$/.test(u.protocol)) return
        host = u.hostname.replace(/^www\./, '')
      } catch {
        return
      }
      const where = PLACES.find(([re]) => re.test(host))?.[1] || host
      const data = {}
      const song = a.closest('[data-title]')?.getAttribute('data-title')
      if (song) data.song = song
      // the song cards that fly out of the orbit count as the music section
      const card = a.closest('.j-card')
      const part = card ? { id: card.dataset.place } : a.closest('.morph') ? { id: 'music' } : a.closest('section[id], footer, header')
      data.place = part?.id || part?.tagName.toLowerCase() || 'page'
      send(`Open ${where}`, data)
    },
    true,
  )

  // sections people reach on the home page
  const sections = { top: 'Hero', music: 'Music', studio: 'Studio', story: 'Story', show: 'Show' }
  // with the journey (journey.js) the cards report the parts people reach themselves
  if ('IntersectionObserver' in window && !document.body.classList.contains('journey')) {
    const seen = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const id = en.target.id
          if (!en.isIntersecting || seen.has(id)) continue
          seen.add(id)
          io.unobserve(en.target)
          send(`Reached ${sections[id]}`)
        }
      },
      { threshold: 0.25 },
    )
    for (const id of Object.keys(sections)) {
      if (id === 'top') continue
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
  }

  // how long people stay: time with the page open and in front of them
  const marks = [
    [30, 'Stayed 30 sec'],
    [60, 'Stayed 1 min'],
    [180, 'Stayed 3 min'],
    [300, 'Stayed 5 min'],
  ]
  let shown = 0
  const timer = window.setInterval(() => {
    if (document.hidden) return
    shown += 5
    while (marks.length && shown >= marks[0][0]) send(marks.shift()[1])
    if (!marks.length) window.clearInterval(timer)
  }, 5000)
})()
