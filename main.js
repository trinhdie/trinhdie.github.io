/* ─── SCROLL RESTORATION ─────────────────────────────── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ─── PRELOADER ──────────────────────────────────────── */
(function initPreloader() {
  const loader = document.querySelector('.preloader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.overflow = '';
      initHeroReveal();
    }, 900);
  });
  // prevent scroll during load
  document.body.style.overflow = 'hidden';
})();

/* ─── HERO NAME REVEAL ───────────────────────────────── */
function initHeroReveal() {
  const lines = document.querySelectorAll('.hero-name-line');
  setTimeout(() => {
    lines.forEach(line => line.classList.add('revealed'));
  }, 100);
}

/* ─── CUSTOM CURSOR ──────────────────────────────────── */
(function initCursor() {
  const dot  = document.querySelector('.cursor');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  let mx = -100, my = -100;
  let rx = -100, ry = -100;
  let rafId;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  }, { passive: true });

  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    rafId = requestAnimationFrame(animateRing);
  }
  animateRing();

  const hoverEls = document.querySelectorAll('a, button, .project-item, input, textarea, .cta-btn');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.classList.add('is-hover');
      ring.classList.add('is-hover');
    });
    el.addEventListener('mouseleave', () => {
      dot.classList.remove('is-hover');
      ring.classList.remove('is-hover');
    });
  });
})();

/* ─── NAV SCROLL ─────────────────────────────────────── */
(function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ─── SCROLL REVEALS ─────────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ─── PAGE TRANSITIONS ───────────────────────────────── */
(function initTransitions() {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.4s ease';
  window.addEventListener('load', () => {
    requestAnimationFrame(() => { document.body.style.opacity = '1'; });
  });

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto') ||
        href.startsWith('http') || link.getAttribute('download') !== null) return;
    link.addEventListener('click', e => {
      e.preventDefault();
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 360);
    });
  });
})();

/* ─── ACTIVE NAV LINK ────────────────────────────────── */
(function initActiveLink() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

/* ─── CONTACT FORM ───────────────────────────────────── */
(function initForm() {
  const form = document.querySelector('.contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.form-submit');
    btn.textContent = 'Message Sent ✓';
    btn.style.background = '#4ade80';
    btn.style.color = '#080808';
    btn.disabled = true;
  });
})();

/* ─── MARQUEE PAUSE ON HOVER ─────────────────────────── */
(function initMarquee() {
  const tracks = document.querySelectorAll('.ticker-track, .statement-inner');
  tracks.forEach(t => {
    t.addEventListener('mouseenter', () => t.style.animationPlayState = 'paused');
    t.addEventListener('mouseleave', () => t.style.animationPlayState = 'running');
  });
})();

/* ─── SPACE CANVAS ───────────────────────────────────── */
(function initSpaceCanvas() {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  const stars = [];
  const shoots = [];
  let nextShootAt = 0;
  let mouseX = 0, mouseY = 0;
  let tMouseX = 0, tMouseY = 0;
  let warpTime = 0, warpSign = 1;
  let t = 0;
  const WARP_DUR = 400;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    stars.length = 0;
    for (let i = 0; i < 220; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + Math.random() * 0.9,
        depth: 0.2 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2,
        base: 0.25 + Math.random() * 0.65,
      });
    }
  }

  function spawnShoot() {
    const speed = 6 + Math.random() * 6;
    const angle = Math.PI * (0.1 + Math.random() * 0.25);
    shoots.push({
      x: Math.random() * W * 0.75,
      y: -10 + Math.random() * H * 0.35,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.018,
      len: 80 + Math.random() * 120,
    });
  }

  document.addEventListener('mousemove', e => {
    tMouseX = e.clientX;
    tMouseY = e.clientY;
  }, { passive: true });

  let prevSY = 0;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    const delta = sy - prevSY;
    prevSY = sy;
    if (Math.abs(delta) > 8) { warpTime = Date.now(); warpSign = delta > 0 ? 1 : -1; }
    for (const s of stars) {
      s.y = ((s.y - delta * s.depth * 0.08) % H + H) % H;
    }
  }, { passive: true });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.016;
    mouseX += (tMouseX - mouseX) * 0.08;
    mouseY += (tMouseY - mouseY) * 0.08;
    const now = Date.now();
    const warpFactor = Math.max(0, 1 - (now - warpTime) / WARP_DUR);
    const mOX = W ? (mouseX - W / 2) / (W / 2) : 0;
    const mOY = H ? (mouseY - H / 2) / (H / 2) : 0;

    for (const s of stars) {
      const sx = ((s.x + mOX * s.depth * 12) % W + W) % W;
      const sy = ((s.y + mOY * s.depth * 12) % H + H) % H;
      const op = s.base * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));

      if (warpFactor > 0.01) {
        const len = s.r * s.depth * (3 + warpFactor * 22) * warpSign;
        const grd = ctx.createLinearGradient(sx, sy, sx, sy - len);
        grd.addColorStop(0, `rgba(240,235,225,${op * warpFactor})`);
        grd.addColorStop(1, 'rgba(240,235,225,0)');
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - len);
        ctx.strokeStyle = grd;
        ctx.lineWidth = s.r * 1.2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,235,225,${op})`;
      ctx.fill();
    }

    if (shoots.length < 3 && now > nextShootAt) {
      spawnShoot();
      nextShootAt = now + 4000 + Math.random() * 4000;
    }
    for (let i = shoots.length - 1; i >= 0; i--) {
      const s = shoots[i];
      s.x += s.vx; s.y += s.vy; s.life -= s.decay;
      if (s.life <= 0 || s.x > W + 200 || s.y > H + 200) { shoots.splice(i, 1); continue; }
      const sp = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / sp) * s.len;
      const ty = s.y - (s.vy / sp) * s.len;
      const grd = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grd.addColorStop(0, `rgba(240,235,225,${s.life * 0.9})`);
      grd.addColorStop(0.3, `rgba(240,235,225,${s.life * 0.4})`);
      grd.addColorStop(1, 'rgba(240,235,225,0)');
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  resize();
  mouseX = tMouseX = W / 2;
  mouseY = tMouseY = H / 2;
  window.addEventListener('resize', resize);
  nextShootAt = Date.now() + 2000;
  draw();
})();


/* ─── SPACE CRAWL ────────────────────────────────────── */
(function initSpaceCrawl() {
  const outer    = document.getElementById('crawlOuter');
  const ribbon   = document.getElementById('crawlRibbon');
  const projects = Array.from(document.querySelectorAll('.crawl-project'));
  const dots     = Array.from(document.querySelectorAll('.ws-dot'));
  const counter  = document.getElementById('wsCur');
  if (!outer || !ribbon) return;

  let lastIdx = -1;

  function onScroll() {
    const rect      = outer.getBoundingClientRect();
    const maxScroll = outer.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(1, -rect.top / maxScroll));

    // Ribbon starts just below viewport, exits fully above
    const startY = window.innerHeight;
    const endY   = -(ribbon.offsetHeight + window.innerHeight * 0.15);
    const y = startY + progress * (endY - startY);
    ribbon.style.transform = `translateX(-50%) translateY(${y}px)`;

    // Find which project is closest to vertical center of viewport
    if (projects.length) {
      const mid = window.innerHeight / 2;
      let closest = 0, minDist = Infinity;
      projects.forEach((p, i) => {
        const r = p.getBoundingClientRect();
        const dist = Math.abs((r.top + r.bottom) / 2 - mid);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      if (closest !== lastIdx) {
        dots.forEach((d, i) => d.classList.toggle('active', i === closest));
        if (counter) counter.textContent = String(closest + 1).padStart(2, '0');
        lastIdx = closest;
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── CASE STUDY TITLE FLOAT ─────────────────────────── */
(function initCsHeroParallax() {
  const hero    = document.querySelector('.cs-hero');
  const eyebrow = document.querySelector('.cs-eyebrow');
  const title   = document.querySelector('.cs-title');
  const meta    = document.querySelector('.cs-meta');
  if (!hero || !title) return;

  let heroH = hero.offsetHeight;
  window.addEventListener('resize', () => { heroH = hero.offsetHeight; });

  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    if (sy > heroH) return;

    const pct = sy / heroH;

    // Title drifts upward fastest — the main floating feel
    title.style.transform = `translateY(${-sy * 0.38}px)`;
    title.style.opacity   = Math.max(0, 1 - pct * 1.6).toFixed(3);

    // Eyebrow floats up slightly slower, fades quicker
    if (eyebrow) {
      eyebrow.style.transform = `translateY(${-sy * 0.22}px)`;
      eyebrow.style.opacity   = Math.max(0, 1 - pct * 2.2).toFixed(3);
    }

    // Meta row drifts least — stays grounded longest
    if (meta) {
      meta.style.transform = `translateY(${-sy * 0.12}px)`;
      meta.style.opacity   = Math.max(0, 1 - pct * 2.5).toFixed(3);
    }
  }, { passive: true });
})();

/* ─── ABOUT CRAWL ────────────────────────────────────── */
(function initAboutCrawl() {
  const outer  = document.getElementById('aboutCrawlOuter');
  const ribbon = document.getElementById('aboutCrawlRibbon');
  if (!outer || !ribbon) return;

  function onScroll() {
    const rect      = outer.getBoundingClientRect();
    const maxScroll = outer.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(1, -rect.top / maxScroll));

    const startY = window.innerHeight;
    const endY   = -(ribbon.offsetHeight + window.innerHeight * 0.15);
    const y = startY + progress * (endY - startY);
    ribbon.style.transform = `translateX(-50%) translateY(${y}px)`;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── ORB PARALLAX ───────────────────────────────────── */
(function initOrbParallax() {
  const orbs = [
    document.querySelector('.hero-orb-1'),
    document.querySelector('.hero-orb-2'),
    document.querySelector('.hero-orb-3'),
    document.querySelector('.hero-orb-4'),
    document.querySelector('.hero-orb-5'),
  ];
  if (!orbs[0]) return;

  const factors = [0.012, 0.018, 0.008, 0.020, 0.015];
  let tx = 0, ty = 0, cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    tx = e.clientX - window.innerWidth / 2;
    ty = e.clientY - window.innerHeight / 2;
  }, { passive: true });

  function animate() {
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    orbs.forEach((orb, i) => {
      if (orb) orb.style.translate = `${cx * factors[i]}px ${cy * factors[i]}px`;
    });
    requestAnimationFrame(animate);
  }
  animate();
})();
