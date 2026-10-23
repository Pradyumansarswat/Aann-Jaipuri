(() => {
  'use strict';
  // Mobile menu
  const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
  if (btn && nav) {
    const close = () => { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  }

  // Hero slider (cross-fade, paused for reduced motion)
  const slider = document.querySelector('[data-slider]');
  if (slider) {
    const slides = [...slider.querySelectorAll('.slide')];
    if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let i = 0;
      setInterval(() => {
        if (document.hidden) return;
        slides[i].classList.remove('is-on');
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-on');
      }, 5000);
    }
  }

  // Product gallery thumbnails
  const g = document.querySelector('[data-gallery]');
  if (g) {
    const main = g.querySelector('#gm-img');
    g.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-full]');
      if (!a) return;
      e.preventDefault();
      main.src = a.dataset.full;
      main.alt = a.dataset.alt || '';
      g.querySelectorAll('a[data-full]').forEach((x) => x.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');
    });
  }

  // Animated numbers on the About page
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        const el = en.target, end = +el.dataset.count, t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / 1200);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN');
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    counters.forEach((c) => io.observe(c));
  }

  // Click counters: first-party (no cookies, no personal data) plus Plausible/Umami events when configured
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    const name = el.dataset.track;
    const props = {};
    for (const [k, v] of Object.entries(el.dataset)) if (k.startsWith('track') && k !== 'track' && k !== 'trackSlug') props[k.slice(5).toLowerCase()] = v;
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props });
      if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, props);
      if (el.dataset.trackSlug && navigator.sendBeacon) {
        navigator.sendBeacon('/api/t', new Blob([JSON.stringify({ p: el.dataset.trackSlug })], { type: 'application/json' }));
      }
    } catch { /* tracking must never break the page */ }
  });

  // Enquiry form: send in the background, then offer the WhatsApp continuation
  document.querySelectorAll('form[data-enquiry]').forEach((form) => {
    const msg = form.querySelector('.form-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.hidden = true;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true; submit.textContent = 'Sending...';
      try {
        const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'We could not send your enquiry. Please try again.');
        const ok = document.createElement('div');
        ok.className = 'form-ok'; ok.setAttribute('role', 'status');
        const isCat = form.dataset.kind === 'catalogue';
        const h = document.createElement('h2'); h.textContent = isCat ? 'Your catalogue is ready' : 'Thank you, we have your enquiry';
        const p = document.createElement('p');
        p.textContent = isCat ? (data.emailed ? 'We are also emailing you a copy. The download link works for 24 hours.' : 'The download link works for 24 hours.') : 'Our wholesale team will contact you shortly. For the fastest reply, continue on WhatsApp.';
        const row = document.createElement('div');
        if (isCat && data.download) {
          const d = document.createElement('a'); d.className = 'btn btn-maroon'; d.href = data.download; d.setAttribute('download', ''); d.textContent = 'Download the PDF'; row.append(d, ' ');
        }
        const a = document.createElement('a'); a.className = 'btn btn-wa'; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.href = data.whatsapp; a.textContent = isCat ? 'Get rates on WhatsApp' : 'Continue on WhatsApp';
        row.append(a);
        ok.append(h, p, row);
        form.replaceWith(ok); ok.scrollIntoView({ block: 'center' });
      } catch (err) {
        msg.textContent = err.message; msg.hidden = false;
        submit.disabled = false; submit.textContent = 'Send enquiry';
      }
    });
  });
})();
