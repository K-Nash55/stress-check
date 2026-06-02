/* =========================================
   STRESS CHECK FREE — main.js
   ========================================= */
'use strict';

/* ---------- Hero Score Bar Animation ---------- */
function animateBars() {
  document.querySelectorAll('.bar-fill[data-width]').forEach((bar, i) => {
    setTimeout(() => {
      bar.style.width = bar.dataset.width + '%';
    }, 500 + i * 150);
  });
}
animateBars();

/* ---------- Chart Bar Animation (benefit card 05) ---------- */
// スコア100点満点換算でバー幅を計算（最大スコア80想定でスケール）
const MAX_SCORE = 80;
const chartBars = document.querySelectorAll('.chart-bar[data-w]');

const chartObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    chartBars.forEach((bar, i) => {
      const score = parseFloat(bar.dataset.w);
      const widthPct = (score / MAX_SCORE) * 100;
      setTimeout(() => {
        bar.style.width = Math.min(widthPct, 100) + '%';
      }, 200 + i * 120);
    });
    chartObserver.disconnect();
  });
}, { threshold: 0.2 });

const chartCard = document.querySelector('.benefit-card--chart');
if (chartCard) chartObserver.observe(chartCard);

/* ---------- Scroll Reveal ---------- */
const revealTargets = [
  '.concern-card',
  '.benefit-card',
  '.recommend-list li',
  '.step-item',
  '.stat-item',
  '.recommend-visual-card',
  '.mini-profile-item',
];

document.querySelectorAll(revealTargets.join(',')).forEach(el => {
  el.classList.add('reveal');
});

/* Stagger delay for grid children */
['.concerns-grid', '.benefits-grid', '.stats-grid', '.recommend-list', '.mini-profile'].forEach(sel => {
  const grid = document.querySelector(sel);
  if (!grid) return;
  [...grid.children].forEach((child, i) => {
    child.dataset.delay = i * 90;
  });
});

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const delay = Number(entry.target.dataset.delay || 0);
    setTimeout(() => entry.target.classList.add('visible'), delay);
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.10 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ---------- Counter Animation ---------- */
const countUp = el => {
  const target = Number(el.dataset.target);
  if (target === 0) { el.textContent = '0'; return; }
  const duration = 1600;
  const start = performance.now();
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(eased * target);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
};

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    countUp(entry.target);
    counterObserver.unobserve(entry.target);
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num[data-target]').forEach(el => counterObserver.observe(el));

/* ---------- Header scroll behavior ---------- */
const header = document.querySelector('.site-header');
let lastY = 0;

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  header.style.transition = 'background 0.3s ease, padding 0.3s ease, transform 0.3s ease';
  header.style.background = y > 60
    ? 'rgba(248,251,255,0.97)'
    : 'rgba(248,251,255,0.90)';
  header.style.padding = y > 60 ? '10px 0' : '13px 0';
  header.style.transform = (y > lastY && y > 200) ? 'translateY(-100%)' : 'translateY(0)';
  lastY = y;
}, { passive: true });

/* ---------- Active nav highlight ---------- */
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.header-nav a[href^="#"]');

new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      link.style.color = link.getAttribute('href') === `#${entry.target.id}`
        ? 'var(--blue)' : 'var(--text-soft)';
      link.style.fontWeight = link.getAttribute('href') === `#${entry.target.id}`
        ? '700' : '500';
    });
  });
}, { threshold: 0.45 }).observe;
sections.forEach(s => {
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === `#${s.id}`;
      link.style.color      = active ? 'var(--blue)'     : 'var(--text-soft)';
      link.style.fontWeight = active ? '700'             : '500';
    });
  }, { threshold: 0.45 }).observe(s);
});

/* ---------- Floating CTA (mobile) ---------- */
const floatingCTA = document.createElement('div');
floatingCTA.className = 'floating-cta';
floatingCTA.innerHTML = `
  <a href="https://stress-check-gamma.vercel.app/index57.html"
     target="_blank" rel="noopener"
     class="btn btn-primary floating-cta-btn">
    <i class="fa-solid fa-clipboard-check"></i> 無料で診断する
  </a>
`;
document.body.appendChild(floatingCTA);

const heroEl = document.querySelector('.hero');
if (heroEl) {
  new IntersectionObserver(entries => {
    floatingCTA.classList.toggle('show', !entries[0].isIntersecting);
  }, { threshold: 0.1 }).observe(heroEl);
}

/* ---------- Concern card micro interaction ---------- */
document.querySelectorAll('.concern-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.querySelector('.concern-emoji').style.transform = 'scale(1.2) rotate(10deg)';
    card.querySelector('.concern-emoji').style.transition = 'transform 0.3s ease';
  });
  card.addEventListener('mouseleave', () => {
    card.querySelector('.concern-emoji').style.transform = 'scale(1) rotate(0deg)';
  });
});

/* ---------- Step item hover ---------- */
document.querySelectorAll('.step-item').forEach(item => {
  item.addEventListener('mouseenter', () => {
    const emoji = item.querySelector('.step-emoji');
    if (emoji) {
      emoji.style.transform = 'scale(1.3)';
      emoji.style.transition = 'transform 0.25s ease';
    }
  });
  item.addEventListener('mouseleave', () => {
    const emoji = item.querySelector('.step-emoji');
    if (emoji) emoji.style.transform = 'scale(1)';
  });
});
