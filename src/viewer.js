(() => {
  const deck = document.querySelector('.deck');
  const slides = [...deck.querySelectorAll('.page')];
  const previous = document.getElementById('previous-slide');
  const next = document.getElementById('next-slide');
  const position = document.getElementById('slide-position');
  const progressBar = document.getElementById('deck-progress-bar');
  const overview = document.getElementById('slide-overview');
  const overviewGrid = document.getElementById('overview-grid');
  const overviewSearch = document.getElementById('overview-search');
  const overviewEmpty = document.getElementById('overview-empty');
  const overviewButton = document.getElementById('open-overview');
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const copyLinkButton = document.getElementById('copy-slide-link');
  const printButton = document.getElementById('print-deck');
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const speakerNotes = document.getElementById('speaker-notes');
  const speakerNotesMeta = document.getElementById('speaker-notes-meta');
  const speakerNotesBody = document.getElementById('speaker-notes-body');
  const feedback = document.getElementById('viewer-message');
  const languageLinks = [...document.querySelectorAll('.language-button')];
  const readingLayout = window.matchMedia('screen and (max-width: 900px)');
  const ui = JSON.parse(document.getElementById('deck-i18n').textContent);
  const notes = JSON.parse(document.getElementById('deck-notes')?.textContent || '{}');
  let current = 0;
  let feedbackTimer;

  function showFeedback(message) {
    feedback.textContent = message;
    feedback.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 3500);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const ok = document.execCommand('copy');
    input.remove();
    if (!ok) throw new Error('copy failed');
  }

  function slideTitle(slide) {
    const heading = slide.querySelector('h1, h2').cloneNode(true);
    heading.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    return heading.textContent.replace(/\s+/g, ' ').trim();
  }

  function slideChapter(slide) {
    return slide.querySelector('.topline > span:last-child')?.textContent.trim() || '';
  }

  // Page labels are derived from slide order so slides can be added or reordered freely.
  const pageLabel = index => `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  slides.forEach((slide, index) => {
    const page = slide.querySelector('.footer-page');
    if (page) page.textContent = pageLabel(index);
  });
  position.textContent = pageLabel(current);

  function updateProgress() {
    if (progressBar) progressBar.style.transform = `scaleX(${(current + 1) / slides.length})`;
  }
  updateProgress();

  // Mobile reading mode: add a next-slide link at the bottom of each page (except the last).
  slides.forEach((slide, index) => {
    if (index >= slides.length - 1) return;
    const footer = slide.querySelector('.footer');
    if (!footer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-next';
    const label = document.createElement('span');
    label.className = 'mobile-next-label';
    label.textContent = `${ui.nextSlideLabel} · ${String(index + 2).padStart(2, '0')}`;
    const title = document.createElement('strong');
    title.textContent = slideTitle(slides[index + 1]);
    const arrow = document.createElement('span');
    arrow.className = 'mobile-next-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    button.append(label, title, arrow);
    button.addEventListener('click', () => showSlide(index + 1));
    footer.before(button);
  });

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

  let lastChapter = null;
  const overviewChapters = [];
  const searchCorpus = [];
  const overviewItems = slides.map((slide, index) => {
    const chapter = slideChapter(slide);
    if (chapter && chapter !== lastChapter) {
      const heading = document.createElement('h3');
      heading.className = 'overview-chapter';
      heading.textContent = chapter;
      overviewGrid.append(heading);
      overviewChapters.push({ heading, indices: [] });
      lastChapter = chapter;
    }
    if (overviewChapters.length) overviewChapters[overviewChapters.length - 1].indices.push(index);
    const titleText = slideTitle(slide);
    const bodyText = slide.querySelector('.content, .hero, .closing-layout')?.textContent || slide.textContent;
    searchCorpus.push(`${String(index + 1).padStart(2, '0')} ${chapter} ${titleText} ${bodyText}`.replace(/\s+/g, ' ').toLowerCase());
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'overview-item';
    const number = document.createElement('span');
    number.className = 'overview-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.textContent = titleText;
    item.append(number, title);
    item.addEventListener('click', () => jumpFromOverview(index));
    overviewGrid.append(item);
    return item;
  });

  function filterOverview(rawQuery) {
    const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    overviewItems.forEach((item, index) => {
      const match = tokens.every(token => searchCorpus[index].includes(token));
      item.hidden = !match;
      if (match) visibleCount += 1;
    });
    overviewChapters.forEach(({ heading, indices }) => {
      heading.hidden = !indices.some(index => !overviewItems[index].hidden);
    });
    if (overviewEmpty) overviewEmpty.hidden = visibleCount > 0;
  }

  overviewSearch?.addEventListener('input', () => filterOverview(overviewSearch.value));
  overviewSearch?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const firstIndex = overviewItems.findIndex(item => !item.hidden);
    if (firstIndex !== -1) {
      event.preventDefault();
      jumpFromOverview(firstIndex);
    }
  });
  overview.addEventListener('close', () => {
    if (overviewSearch && overviewSearch.value) {
      overviewSearch.value = '';
      filterOverview('');
    }
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
      copy.querySelectorAll('.mobile-next').forEach(element => element.remove());
      copy.querySelectorAll('img[tabindex]').forEach(img => {
        img.removeAttribute('tabindex');
        img.removeAttribute('role');
        img.removeAttribute('title');
      });
      // Buttons cannot contain links, buttons or embedded media: swap them for static stand-ins.
      copy.querySelectorAll('a, button').forEach(interactive => {
        const span = document.createElement('span');
        span.className = interactive.className;
        span.append(...interactive.childNodes);
        interactive.replaceWith(span);
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

  function closeOnBackdrop(dialog, event) {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }

  function openOverview() {
    buildThumbnails();
    overview.showModal();
    overviewItems[current].scrollIntoView({ block: 'nearest' });
  }
  overviewButton.addEventListener('click', openOverview);
  document.getElementById('close-overview').addEventListener('click', () => overview.close());
  overview.addEventListener('click', event => closeOnBackdrop(overview, event));

  // Image lightbox for enlarging product screenshots.
  function openLightbox(img) {
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt;
    const figure = img.closest('figure');
    const heading = figure?.querySelector('figcaption h3')?.textContent.trim();
    const desc = figure?.querySelector('figcaption p')?.textContent.trim();
    lightboxCaption.textContent = heading ? (desc ? `${heading} — ${desc}` : heading) : img.alt;
    lightbox.showModal();
  }
  if (lightbox) {
    document.getElementById('close-lightbox')?.addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => closeOnBackdrop(lightbox, event));
    deck.querySelectorAll('.example-media img').forEach(img => {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.title = ui.zoomImage;
      img.addEventListener('click', () => openLightbox(img));
      img.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(img);
        }
      });
    });
  }

  const anyModalOpen = () => overview.open || Boolean(lightbox?.open);

  // Auto-fade bottom controls while idle in full-screen presentations.
  let idleTimer;
  function clearIdleControls() {
    clearTimeout(idleTimer);
    document.documentElement.classList.remove('controls-idle');
  }
  function scheduleIdleControls() {
    clearIdleControls();
    if (document.fullscreenElement !== document.documentElement || anyModalOpen()) return;
    idleTimer = setTimeout(() => {
      if (!anyModalOpen()) document.documentElement.classList.add('controls-idle');
    }, 2500);
  }
  ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(type => {
    document.addEventListener(type, () => {
      if (document.fullscreenElement) scheduleIdleControls();
    }, { passive: true });
  });
  overview.addEventListener('close', scheduleIdleControls);
  lightbox?.addEventListener('close', scheduleIdleControls);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      showFeedback(ui.fullscreenUnavailable);
    }
  }
  fullscreenButton.disabled = !document.fullscreenEnabled;
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', active ? ui.fullscreenExit : ui.fullscreen);
    fullscreenButton.title = active ? `${ui.fullscreenExit} (Esc / F)` : `${ui.fullscreen} (F)`;
    if (active) scheduleIdleControls();
    else clearIdleControls();
  });

  // Download pre-rendered PDF when bundled (CI / build:pdf), otherwise open browser print dialog.
  function triggerPrintOrPdf() {
    const pdfHref = printButton?.dataset.pdf;
    if (pdfHref) {
      const link = document.createElement('a');
      link.href = pdfHref;
      link.download = pdfHref.split('/').pop();
      document.body.append(link);
      link.click();
      link.remove();
      return;
    }
    window.print();
  }
  if (printButton) {
    if (printButton.dataset.pdf) {
      printButton.setAttribute('aria-label', ui.pdfDownload);
      printButton.title = `${ui.pdfDownload} (P)`;
    }
    printButton.addEventListener('click', triggerPrintOrPdf);
  }

  copyLinkButton?.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.hash = `#slide-${current + 1}`;
    try {
      await copyText(url.href);
      showFeedback(ui.linkCopied);
    } catch (_) {
      showFeedback(ui.linkCopyFailed);
    }
  });

  document.querySelectorAll('[data-copy-email]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await copyText(button.dataset.copyEmail);
        showFeedback(ui.emailCopied);
      } catch (_) {
        showFeedback(ui.emailCopyFailed);
      }
    });
  });

  function updateSpeakerNotes() {
    if (!speakerNotes || !speakerNotesBody) return;
    const slide = slides[current];
    const id = slide.getAttribute('aria-labelledby');
    const chapter = slideChapter(slide);
    if (speakerNotesMeta) speakerNotesMeta.textContent = chapter ? `${pageLabel(current)} · ${chapter}` : pageLabel(current);
    speakerNotesBody.textContent = notes[id] || ui.speakerNotesEmpty;
  }

  function setSpeakerNotesOpen(open) {
    if (!speakerNotes) return;
    speakerNotes.hidden = !open;
    if (open) updateSpeakerNotes();
    languageLinks.forEach(link => {
      const url = new URL(link.getAttribute('href'), location.href);
      if (open) url.searchParams.set('notes', '');
      else url.searchParams.delete('notes');
      link.search = url.search;
    });
  }
  document.getElementById('close-notes')?.addEventListener('click', () => setSpeakerNotesOpen(false));
  if (new URLSearchParams(location.search).has('notes')) setSpeakerNotesOpen(true);

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
    updateProgress();
    updateSpeakerNotes();
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
  const printVideos = [];
  window.addEventListener('beforeprint', () => {
    settleAll();
    printVideos.length = 0;
    deck.querySelectorAll('video').forEach(video => {
      video.pause();
      if (video.controls) {
        video.controls = false;
        printVideos.push(video);
      }
    });
  });
  window.addEventListener('afterprint', () => {
    printVideos.forEach(video => { video.controls = true; });
    printVideos.length = 0;
  });

  previous.addEventListener('click', () => showSlide(current - 1));
  next.addEventListener('click', () => showSlide(current + 1));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('video, audio, input, textarea, select, [contenteditable="true"]')) return;
    if (anyModalOpen()) return;
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); openOverview(); return; }
    if (event.key.toLowerCase() === 'f' && !fullscreenButton.disabled) { event.preventDefault(); toggleFullscreen(); return; }
    if (event.key.toLowerCase() === 'p' && printButton) { event.preventDefault(); triggerPrintOrPdf(); return; }
    if (event.key === 'N' && event.shiftKey && speakerNotes) { event.preventDefault(); setSpeakerNotesOpen(speakerNotes.hidden); return; }
    if (readingLayout.matches && !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const destinations = { ArrowRight: current + 1, ArrowDown: current + 1, PageDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, PageUp: current - 1, Home: 0, End: slides.length - 1 };
    if (event.key === ' ' && !event.target.closest('button, a, [role="button"]')) destinations[' '] = current + (event.shiftKey ? -1 : 1);
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
    if (event.ctrlKey || anyModalOpen() || readingLayout.matches || event.target.closest('video, audio')) return;
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
    touchStart = !anyModalOpen() && !event.target.closest('video, audio') && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
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
    if (lightbox?.open) lightbox.close();
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
