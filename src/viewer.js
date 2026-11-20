(() => {
  const deck = document.querySelector('.deck');
  const slides = [...deck.querySelectorAll('.page')];
  const previous = document.getElementById('previous-slide');
  const next = document.getElementById('next-slide');
  const position = document.getElementById('slide-position');
  const overview = document.getElementById('slide-overview');
  const overviewGrid = document.getElementById('overview-grid');
  const overviewButton = document.getElementById('open-overview');
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const feedback = document.getElementById('viewer-message');
  const languageLinks = [...document.querySelectorAll('.language-button')];
  const readingLayout = window.matchMedia('screen and (max-width: 900px)');
  const ui = JSON.parse(document.getElementById('deck-i18n').textContent);
  let current = 0;
  let feedbackTimer;

  // Page labels are derived from slide order so slides can be added or reordered freely.
  const pageLabel = index => `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  slides.forEach((slide, index) => {
    const page = slide.querySelector('.footer-page');
    if (page) page.textContent = pageLabel(index);
  });
  position.textContent = pageLabel(current);

  function jumpFromOverview(index) {
    // Deliberate jumps get their own history entry.
    showSlide(index, { historyMode: 'push' });
    overview.close();
  }

  overview.querySelectorAll('[data-overview-target]').forEach(button => {
    const index = slides.findIndex(slide => slide.getAttribute('aria-labelledby') === button.dataset.overviewTarget);
    if (index === -1) {
      button.remove();
      return;
    }
    button.addEventListener('click', () => jumpFromOverview(index));
  });

  const overviewItems = slides.map((slide, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'overview-item';
    const number = document.createElement('span');
    number.className = 'overview-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    const heading = slide.querySelector('h1, h2').cloneNode(true);
    heading.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    title.textContent = heading.textContent;
    item.append(number, title);
    item.addEventListener('click', () => jumpFromOverview(index));
    overviewGrid.append(item);
    return item;
  });

  // Thumbnails are live, inert copies of each slide scaled down from the 1440px design size.
  // They are built on first use and only for the presentation layout (hidden in reading layout).
  let thumbnailsBuilt = false;
  function buildThumbnails() {
    if (thumbnailsBuilt || readingLayout.matches) return;
    thumbnailsBuilt = true;
    // Copy pages at rest, not mid-transition.
    settleAll();
    slides.forEach((slide, index) => {
      const frame = document.createElement('span');
      frame.className = 'overview-thumb';
      frame.setAttribute('aria-hidden', 'true');
      frame.inert = true;
      const copy = slide.cloneNode(true);
      copy.hidden = false;
      ['tabindex', 'aria-labelledby', 'aria-roledescription'].forEach(name => copy.removeAttribute(name));
      copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      // Buttons cannot contain links or embedded media: swap them for static stand-ins.
      copy.querySelectorAll('a').forEach(link => {
        const span = document.createElement('span');
        span.className = link.className;
        span.append(...link.childNodes);
        link.replaceWith(span);
      });
      copy.querySelectorAll('video[poster]').forEach(video => {
        const poster = document.createElement('img');
        poster.src = video.poster;
        poster.alt = '';
        video.replaceWith(poster);
      });
      copy.querySelectorAll('iframe, video, audio').forEach(media => media.remove());
      frame.append(copy);
      overviewItems[index].prepend(frame);
    });
    const firstThumb = overviewItems[0].querySelector('.overview-thumb');
    // The dialog is still closed (unrendered) here, so read the design width from CSS.
    const designWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slide-width'));
    new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) overviewGrid.style.setProperty('--thumb-scale', entry.contentRect.width / designWidth);
    }).observe(firstThumb);
  }

  function openOverview() {
    buildThumbnails();
    overview.showModal();
    overviewItems[current].scrollIntoView({ block: 'nearest' });
  }
  overviewButton.addEventListener('click', openOverview);
  document.getElementById('close-overview').addEventListener('click', () => overview.close());
  overview.addEventListener('click', event => {
    if (event.target !== overview) return;
    const bounds = overview.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) overview.close();
  });

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      feedback.textContent = ui.fullscreenUnavailable;
      feedback.hidden = false;
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 4000);
    }
  }
  fullscreenButton.disabled = !document.fullscreenEnabled;
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', active ? ui.fullscreenExit : ui.fullscreen);
    fullscreenButton.title = active ? `${ui.fullscreenExit} (Esc / F)` : `${ui.fullscreen} (F)`;
  });

  function updateOverview() {
    overviewItems.forEach((item, index) => {
      if (index === current) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }
  updateOverview();

  function fitSlide() {
    if (readingLayout.matches) {
      deck.style.setProperty('--slide-scale', 1);
      return;
    }
    const slide = slides[current];
    const scale = Math.min(deck.clientWidth / slide.offsetWidth, deck.clientHeight / slide.offsetHeight);
    deck.style.setProperty('--slide-scale', scale);
  }

  // Hash routes work on static hosting without server rewrite rules.
  function routeIndex() {
    const match = /^#slide-(\d+)$/.exec(location.hash);
    if (!match) return 0;
    const number = Number(match[1]);
    return Number.isSafeInteger(number) ? Math.max(0, Math.min(number - 1, slides.length - 1)) : 0;
  }

  function syncRoute(index, mode) {
    const hash = `#slide-${index + 1}`;
    if (location.hash === hash) return;
    const url = new URL(location.href);
    url.hash = hash;
    history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
  }

  // Stepping through slides replaces the current entry so Back leaves the deck instead of
  // replaying every slide; deliberate jumps (overview, Home/End) pass historyMode: 'push'.
  function showSlide(index, { historyMode = 'replace', animate = true } = {}) {
    const target = Math.max(0, Math.min(index, slides.length - 1));
    syncRoute(target, historyMode);
    // The other-language deck opens on the same slide.
    languageLinks.forEach(link => { link.hash = `#slide-${target + 1}`; });
    if (target === current) return;
    const outgoing = slides[current];
    const incoming = slides[target];
    const direction = Math.sign(target - current);
    const moveFocus = outgoing.contains(document.activeElement);
    outgoing.querySelectorAll('video, audio').forEach(media => media.pause());
    const push = animate && canPush();
    // Read where both pages are before the layout changes, so an interrupted push continues smoothly.
    const outgoingFrom = push ? pageOffset(outgoing) : 0;
    const incomingFrom = push && travelling.has(incoming) ? pageOffset(incoming) : null;
    const scrollTop = deck.scrollTop;
    current = target;
    if (push) {
      // The leaving page stays visible, but out of reach, until it is off screen.
      outgoing.inert = true;
      outgoing.classList.add('is-leaving');
      // In the reading layout it leaves the flow: keep it where the reader had scrolled to.
      if (readingLayout.matches) outgoing.style.top = `${-scrollTop}px`;
      incoming.inert = false;
      incoming.classList.remove('is-leaving');
      incoming.style.top = '';
    } else {
      settleAll();
      outgoing.hidden = true;
    }
    incoming.hidden = false;
    deck.scrollTop = 0;
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    position.textContent = pageLabel(current);
    updateOverview();
    fitSlide();
    if (push) {
      // Just far enough to clear the deck, so the two pages move like one strip.
      const distance = Math.ceil((deck.clientWidth + incoming.getBoundingClientRect().width) / 2);
      travel(outgoing, outgoingFrom, -direction * distance);
      travel(incoming, incomingFrom ?? outgoingFrom + direction * distance, 0);
    }
    if (moveFocus) incoming.focus({ preventScroll: true });
  }

  // Slide changes push the pages sideways: the current page leaves towards the side it came
  // from in reading order while the target follows it in. Pages still moving are tracked here.
  const pushTiming = { duration: 600, easing: 'cubic-bezier(.4, 0, .15, 1)', fill: 'both' };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const travelling = new Map();

  function canPush() {
    return !reducedMotion.matches && document.visibilityState === 'visible' && CSS.supports('translate', '1px');
  }

  function pageOffset(page) {
    return travelling.has(page) ? parseFloat(getComputedStyle(page).translate) || 0 : 0;
  }

  function travel(page, from, to) {
    travelling.get(page)?.cancel();
    const animation = page.animate({ translate: [`${from}px 0`, `${to}px 0`] }, pushTiming);
    travelling.set(page, animation);
    animation.onfinish = () => settle(page);
  }

  function settle(page) {
    travelling.get(page)?.cancel();
    travelling.delete(page);
    page.classList.remove('is-leaving');
    page.style.top = '';
    page.inert = false;
    if (page !== slides[current]) page.hidden = true;
  }

  function settleAll() {
    [...travelling.keys()].forEach(settle);
  }
  window.addEventListener('beforeprint', settleAll);

  previous.addEventListener('click', () => showSlide(current - 1));
  next.addEventListener('click', () => showSlide(current + 1));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('video, audio, input, textarea, select, [contenteditable="true"]')) return;
    if (overview.open) return;
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); openOverview(); return; }
    if (event.key.toLowerCase() === 'f' && !fullscreenButton.disabled) { event.preventDefault(); toggleFullscreen(); return; }
    if (readingLayout.matches && !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const destinations = { ArrowRight: current + 1, ArrowDown: current + 1, PageDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, PageUp: current - 1, Home: 0, End: slides.length - 1 };
    if (event.key === ' ' && !event.target.closest('button, a')) destinations[' '] = current + (event.shiftKey ? -1 : 1);
    if (Object.hasOwn(destinations, event.key)) {
      event.preventDefault();
      // A held key scrubs through the deck: swap instantly instead of queueing pushes.
      showSlide(destinations[event.key], { historyMode: ['Home', 'End'].includes(event.key) ? 'push' : 'replace', animate: !event.repeat });
    }
  });

  // Treat one wheel or trackpad gesture as a single slide change.
  let wheelDelta = 0;
  let wheelLocked = false;
  let wheelReset;
  document.addEventListener('wheel', event => {
    if (event.ctrlKey || overview.open || readingLayout.matches || event.target.closest('video, audio')) return;
    event.preventDefault();
    clearTimeout(wheelReset);
    wheelReset = setTimeout(() => { wheelDelta = 0; wheelLocked = false; }, 180);
    if (wheelLocked) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? deck.clientHeight : 1);
    if (Math.sign(pixels) !== Math.sign(wheelDelta)) wheelDelta = 0;
    wheelDelta += pixels;
    if (Math.abs(wheelDelta) >= 40) {
      showSlide(current + Math.sign(wheelDelta));
      wheelLocked = true;
    }
  }, { passive: false });

  let touchStart;
  deck.addEventListener('touchstart', event => {
    touchStart = !overview.open && !event.target.closest('video, audio') && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  deck.addEventListener('touchend', event => {
    if (!touchStart || event.touches.length || event.changedTouches.length !== 1) return;
    const dx = touchStart.x - event.changedTouches[0].clientX;
    const dy = touchStart.y - event.changedTouches[0].clientY;
    touchStart = null;
    if (readingLayout.matches && Math.abs(dx) <= Math.abs(dy)) return;
    const distance = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (Math.abs(distance) >= 40) showSlide(current + Math.sign(distance));
  }, { passive: true });
  deck.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  function restoreRoute() {
    if (overview.open) overview.close();
    showSlide(routeIndex(), { historyMode: 'replace' });
  }
  window.addEventListener('popstate', restoreRoute);
  window.addEventListener('hashchange', restoreRoute);
  showSlide(routeIndex(), { historyMode: 'replace', animate: false });

  readingLayout.addEventListener('change', () => {
    settleAll();
    deck.scrollTop = 0;
    fitSlide();
  });
  new ResizeObserver(fitSlide).observe(deck);
  fitSlide();
})();
