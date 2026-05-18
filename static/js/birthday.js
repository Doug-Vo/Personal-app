(function () {
  'use strict';

  const CONFETTI_COLORS = ['#ff6b9d','#ffd93d','#6bcfff','#b8f5a0','#ff9f43','#a29bfe','#fd79a8','#00cec9'];
  const BURST_EMOJIS = ['🎉','✨','🎊','⭐','💕','🌟'];

  let sequenceTimers = [];
  let danceInterval  = null;

  const DANCE_MOVES = [
    { name: 'bday-dance',   dur: '0.65s', timing: 'ease-in-out' },
    { name: 'bday-jump',    dur: '0.7s',  timing: 'cubic-bezier(0.36,0.07,0.19,0.97)' },
    { name: 'bday-wave',    dur: '0.9s',  timing: 'ease-in-out' },
    { name: 'bday-spin',    dur: '0.55s', timing: 'ease-in-out' },
    { name: 'bday-shimmy',  dur: '0.5s',  timing: 'linear' },
    { name: 'bday-victory', dur: '0.8s',  timing: 'cubic-bezier(0.36,0.07,0.19,0.97)' },
  ];

  function scheduleAll(fns) {
    fns.forEach(([ms, fn]) => sequenceTimers.push(setTimeout(fn, ms)));
  }

  function clearSequence() {
    sequenceTimers.forEach(clearTimeout);
    sequenceTimers = [];
  }

  /* ---------- Overlay helpers ---------- */
  function showOverlay() {
    const overlay = document.getElementById('birthday-overlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Move focus into dialog for keyboard/screen-reader users
    const closeBtn = document.getElementById('bday-close');
    if (closeBtn) closeBtn.focus();
  }

  function hideOverlay() {
    document.getElementById('birthday-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    // Return focus to the button that opened the overlay
    const btn = document.getElementById('birthday-btn');
    if (btn) btn.focus();
  }

  function showAct(n) {
    [1, 2, 3].forEach(i => {
      const el = document.getElementById(`bday-act${i}`);
      if (i === n) {
        el.classList.remove('hidden');
        el.classList.add('fade-in');
      } else {
        el.classList.add('hidden');
        el.classList.remove('fade-in');
      }
    });
  }

  /* ---------- Act 1 — Present ---------- */
  function triggerPresentShake() {
    const wrap = document.querySelector('.bday-present-wrap');
    if (!wrap) return;
    wrap.classList.remove('shaking');
    void wrap.offsetWidth;
    wrap.classList.add('shaking');
  }

  function triggerPresentOpen() {
    const wrap = document.querySelector('.bday-present-wrap');
    if (!wrap) return;
    wrap.classList.remove('shaking');
    wrap.classList.add('opening');
    spawnBurstStars(wrap);
  }

  function spawnBurstStars(wrap) {
    const directions = [
      { x: '-90px', y: '-120px' },
      { x: '90px',  y: '-120px' },
      { x: '-130px', y: '-60px' },
      { x: '130px',  y: '-60px' },
      { x: '0px',   y: '-140px' },
      { x: '-50px', y: '-100px' },
    ];
    directions.forEach((dir, i) => {
      const star = document.createElement('span');
      star.className = 'bday-burst-star';
      star.textContent = BURST_EMOJIS[i % BURST_EMOJIS.length];
      star.style.setProperty('--burst-end', `translate(${dir.x}, ${dir.y})`);
      star.style.animationDelay = `${i * 60}ms`;
      wrap.appendChild(star);
    });
  }

  /* ---------- Act 2 — Cake ---------- */
  function blowOutCandles() {
    document.querySelectorAll('.bday-flame').forEach((flame, i) => {
      // Track these timers so they can be cancelled if the user closes mid-sequence
      sequenceTimers.push(setTimeout(() => flame.classList.add('out'), i * 220));
    });
  }

  function triggerCakeExplode() {
    const wrap = document.querySelector('.bday-cake-wrap');
    if (wrap) wrap.classList.add('exploding');
  }

  /* ---------- Act 3 — Explosion + Dance ---------- */
  function spawnConfetti() {
    const container = document.getElementById('bday-confetti-container');
    container.innerHTML = '';
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (let i = 0; i < 55; i++) {
      const el = document.createElement('div');
      el.className = 'bday-confetti-piece';

      const shapes = [
        'border-radius:2px',
        'border-radius:50%',
        'width:6px;height:14px;border-radius:2px',
        'width:14px;height:5px;border-radius:2px',
      ];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      const angle  = Math.random() * Math.PI * 2;
      const dist   = 200 + Math.random() * 400;
      const endX   = Math.round(Math.cos(angle) * dist);
      const endY   = Math.round(Math.sin(angle) * dist) - 80;
      const rot    = Math.round(Math.random() * 720 - 360);
      const dur    = (1.2 + Math.random() * 1.6).toFixed(2);
      const delay  = (Math.random() * 0.5).toFixed(2);

      el.style.cssText = `
        ${shape};
        left: ${cx + (Math.random() * 80 - 40)}px;
        top:  ${cy + (Math.random() * 80 - 40)}px;
        background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
        --cf-x: ${endX}px;
        --cf-y: ${endY}px;
        --cf-rot: ${rot}deg;
        animation-duration: ${dur}s;
        animation-delay: ${delay}s;
      `;
      container.appendChild(el);
    }
  }

  function applyMove(group, move) {
    group.style.animation = 'none';
    void group.offsetWidth;
    group.style.animation = `${move.name} ${move.dur} ${move.timing} infinite`;
  }

  function spawnDancingPiglet() {
    const zone = document.getElementById('bday-piglet-zone');
    zone.innerHTML = '';
    const src = document.getElementById('piglet-svg');
    if (!src) return;

    const clone = src.cloneNode(true);
    clone.id = 'bday-dancing-piglet';
    clone.setAttribute('width', '140');
    clone.setAttribute('height', '140');
    clone.style.filter = 'drop-shadow(0 0 18px rgba(255,107,157,0.8))';

    const group = clone.querySelector('#piglet-group');
    if (group) {
      // Rename to avoid duplicate ID in the document
      group.id = 'bday-dancing-group';
      group.style.transformOrigin = '50px 60px';
      let moveIdx = 0;
      applyMove(group, DANCE_MOVES[moveIdx]);

      if (danceInterval) clearInterval(danceInterval);
      danceInterval = setInterval(() => {
        moveIdx = (moveIdx + 1) % DANCE_MOVES.length;
        applyMove(group, DANCE_MOVES[moveIdx]);
      }, 1300);
    }
    zone.appendChild(clone);

    // Trigger text bounce-in animations (class-toggled so they replay on every open)
    document.querySelectorAll('.bday-hb-text, .bday-hb-sub').forEach(el => {
      el.classList.remove('animate');
      void el.offsetWidth;
      el.classList.add('animate');
    });
  }

  /* ---------- Reset ---------- */
  function resetSequence() {
    clearSequence();
    if (danceInterval) { clearInterval(danceInterval); danceInterval = null; }

    // Reset act 1
    const wrap = document.querySelector('.bday-present-wrap');
    if (wrap) {
      wrap.classList.remove('shaking', 'opening');
      wrap.querySelectorAll('.bday-burst-star').forEach(s => s.remove());
    }

    // Reset act 2
    document.querySelectorAll('.bday-flame').forEach(f => f.classList.remove('out'));
    const cake = document.querySelector('.bday-cake-wrap');
    if (cake) cake.classList.remove('exploding');

    // Reset act 3
    document.getElementById('bday-confetti-container').innerHTML = '';
    document.getElementById('bday-piglet-zone').innerHTML = '';
    document.querySelectorAll('.bday-hb-text, .bday-hb-sub').forEach(el => el.classList.remove('animate'));

    // Reset act visibility
    showAct(1);
    document.getElementById('bday-act1').classList.remove('fade-in');
  }

  /* ---------- Main sequence ---------- */
  function startBirthday() {
    resetSequence();
    showOverlay();
    showAct(1);

    scheduleAll([
      [700,  triggerPresentShake],
      [1400, triggerPresentOpen],
      [3000, () => showAct(2)],
      [4800, blowOutCandles],
      [5900, triggerCakeExplode],
      [6200, () => { showAct(3); spawnConfetti(); }],
      [6500, spawnDancingPiglet],
    ]);
  }

  /* ---------- Wiring ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const btn   = document.getElementById('birthday-btn');
    const close = document.getElementById('bday-close');

    if (btn)   btn.addEventListener('click', startBirthday);

    function closeOverlay() { hideOverlay(); resetSequence(); }
    if (close) close.addEventListener('click', closeOverlay);

    // Close on backdrop click — works now because .bday-act has pointer-events:none
    const overlay = document.getElementById('birthday-overlay');
    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeOverlay();
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
        closeOverlay();
      }
    });
  });
})();
