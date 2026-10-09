/**
 * Fan Reactions — editorial strip from fan-reactions/reactions.json
 * Plain-text only; safe URLs; local or remote avatars with fallback.
 */
;(function () {
  const DATA_URL = 'fan-reactions/reactions.json'
  const FALLBACK_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="32" fill="%232a2420"/><circle cx="32" cy="26" r="12" fill="%23e8c39a" opacity=".55"/><path d="M12 56c4-12 14-18 20-18s16 6 20 18" fill="%23e8c39a" opacity=".4"/></svg>',
  )

  function $(sel, root = document) {
    return root.querySelector(sel)
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

  function safeAvatar(url) {
    const raw = String(url || '').trim()
    if (!raw) return ''
    if (/^avatars\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i.test(raw)) return raw
    if (isSafeHttps(raw)) return raw
    return ''
  }

  function safePostUrl(url) {
    if (!isSafeHttps(url)) return ''
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      if (!['instagram.com', 'tiktok.com', 'vm.tiktok.com'].includes(host)) return ''
      return url
    } catch {
      return ''
    }
  }

  function platformLabel(platform) {
    return platform === 'tiktok' ? 'TikTok' : 'Instagram'
  }

  function platformIcon(platform) {
    if (platform === 'tiktok') {
      return `<svg class="fr-platform-icon" viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path fill="currentColor" d="M14.5 3c.4 2.4 1.8 4.2 4.2 4.7v2.3c-1.5-.1-2.8-.6-4-1.5v6.6c0 3.3-2.6 5.9-5.9 5.9S2.9 18.4 2.9 15.1c0-3.2 2.5-5.8 5.6-5.9v2.4c-1.8.1-3.2 1.6-3.2 3.5 0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5V3h2.2z"/></svg>`
    }
    return `<svg class="fr-platform-icon" viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path fill="currentColor" d="M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1zM17.8 6.9a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1zM12 2.2c-2.7 0-3 0-4.1.1a5.9 5.9 0 0 0-4 2.1A5.9 5.9 0 0 0 1.8 8.4C1.7 9.5 1.7 9.8 1.7 12s0 2.5.1 3.6a5.9 5.9 0 0 0 2.1 4 5.9 5.9 0 0 0 4 2.1c1.1.1 1.4.1 4.1.1s2.5 0 3.6-.1a5.9 5.9 0 0 0 4-2.1 5.9 5.9 0 0 0 2.1-4c.1-1.1.1-1.4.1-4.1s0-2.5-.1-3.6a5.9 5.9 0 0 0-2.1-4 5.9 5.9 0 0 0-4-2.1C14.5 2.2 14.2 2.2 12 2.2zm0 1.8c2.6 0 2.9 0 4 .1a4 4 0 0 1 2.7 1.5 4 4 0 0 1 1.5 2.7c.1 1 .1 1.3.1 4s0 2.9-.1 4a4 4 0 0 1-1.5 2.7 4 4 0 0 1-2.7 1.5c-1 .1-1.3.1-4 .1s-2.9 0-4-.1a4 4 0 0 1-2.7-1.5 4 4 0 0 1-1.5-2.7c-.1-1-.1-1.3-.1-4s0-2.9.1-4a4 4 0 0 1 1.5-2.7 4 4 0 0 1 2.7-1.5c1.1-.1 1.4-.1 4-.1z"/></svg>`
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
      const platform = raw.platform === 'tiktok' ? 'tiktok' : raw.platform === 'instagram' ? 'instagram' : ''
      if (!id || !username || !commentText || !platform) continue
      if (seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        platform,
        username,
        displayName: String(raw.displayName || '').trim() || null,
        profileImageUrl: safeAvatar(raw.profileImageUrl),
        commentText: commentText.slice(0, 500),
        postUrl: safePostUrl(raw.postUrl),
        createdAt: raw.createdAt ? String(raw.createdAt) : null,
        featured: !!raw.featured,
      })
    }
    return out
  }

  function sortForDisplay(items) {
    const featured = items.filter((i) => i.featured)
    const rest = items.filter((i) => !i.featured)
    return featured.concat(rest)
  }

  function buildCard(item) {
    const article = document.createElement('article')
    article.className = 'fr-card' + (item.featured ? ' is-featured' : '')
    article.setAttribute('role', 'listitem')
    article.setAttribute('data-platform', item.platform)

    const handle = `@${item.username}`
    const name = item.displayName || handle
    const alt = `${name} profile photo`
    const avatarSrc = item.profileImageUrl || FALLBACK_AVATAR
    const post = item.postUrl
      ? `<a class="fr-post" href="${escapeHtml(item.postUrl)}" target="_blank" rel="noopener noreferrer"><span data-lang="en">View post</span><span data-lang="fr">Voir le post</span></a>`
      : ''

    article.innerHTML = `
      <blockquote class="fr-quote">
        <p>${escapeHtml(item.commentText)}</p>
      </blockquote>
      <footer class="fr-meta">
        <img class="fr-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(alt)}" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        <div class="fr-who">
          <span class="fr-name">${escapeHtml(name)}</span>
          <span class="fr-user">${escapeHtml(handle)}</span>
        </div>
        <span class="fr-platform" title="${escapeHtml(platformLabel(item.platform))}">
          ${platformIcon(item.platform)}
          <span class="visually-hidden">${escapeHtml(platformLabel(item.platform))}</span>
        </span>
        ${post}
      </footer>
    `

    const img = article.querySelector('.fr-avatar')
    img?.addEventListener('error', () => {
      if (img.dataset.fallbackApplied) return
      img.dataset.fallbackApplied = '1'
      img.src = FALLBACK_AVATAR
    })

    return article
  }

  function bindCarousel(track, prevBtn, nextBtn) {
    if (!track) return
    const scrollBy = (dir) => {
      const amount = Math.max(240, Math.floor(track.clientWidth * 0.85))
      track.scrollBy({ left: dir * amount, behavior: 'smooth' })
    }
    prevBtn?.addEventListener('click', () => scrollBy(-1))
    nextBtn?.addEventListener('click', () => scrollBy(1))

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 4
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= max
    }
    track.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    sync()
  }

  async function initFanReactions() {
    const section = $('[data-fan-reactions]')
    const track = $('[data-fan-track]')
    if (!section || !track) return

    let data
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      data = await res.json()
    } catch {
      section.hidden = true
      return
    }

    const items = sortForDisplay(normalize(data?.reactions))
    if (!items.length) {
      section.hidden = true
      return
    }

    section.hidden = false
    const frag = document.createDocumentFragment()
    for (const item of items) frag.appendChild(buildCard(item))
    track.replaceChildren(frag)

    bindCarousel(track, $('[data-fan-prev]'), $('[data-fan-next]'))
  }

  window.initFanReactions = initFanReactions
})()
