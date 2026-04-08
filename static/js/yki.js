/* ══════════════════════════════════════════
   YKI Speaking Exam — yki.js
   State machine: SELECT → READY → PREP → SPEAK → DONE
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──
    const panels = {
        select: document.getElementById('yki-panel-select'),
        ready:  document.getElementById('yki-panel-ready'),
        exam:   document.getElementById('yki-panel-exam'),
        done:   document.getElementById('yki-panel-done'),
    };

    const readyBadge      = document.getElementById('yki-ready-badge');
    const startBtn        = document.getElementById('yki-start-btn');
    const backFromReady   = document.getElementById('yki-back-from-ready');

    const phaseBadge      = document.getElementById('yki-phase-badge');
    const examCategory    = document.getElementById('yki-exam-category');
    const timerDisplay    = document.getElementById('yki-timer-display');
    const ringFill        = document.getElementById('yki-ring-fill');
    const timerWrap       = document.querySelector('.yki-timer-wrap');

    const volumeRow       = document.getElementById('yki-volume-row');
    const muteBtn         = document.getElementById('yki-mute-btn');
    const volumeSlider    = document.getElementById('yki-volume-slider');

    const questionText    = document.getElementById('yki-question-text');
    const hintBlock       = document.getElementById('yki-hint-block');
    const hintText        = document.getElementById('yki-hint-text');

    const translationBlock = document.getElementById('yki-translation-block');
    const translationText  = document.getElementById('yki-translation-text');
    const translateBtn     = document.getElementById('yki-translate-btn');
    const skipPrepBtn      = document.getElementById('yki-skip-prep-btn');

    const tryAnotherBtn   = document.getElementById('yki-try-another-btn');
    const backToSelectBtn = document.getElementById('yki-back-to-select-btn');

    const crowdAudio      = document.getElementById('yki-crowd-audio');

    // ── Constants ──
    const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

    const TIMERS = {
        Kertominen: { prep: 90,  speak: 90  },
        Mielipide:  { prep: 120, speak: 120 },
        Reagointi:  { prep: 30,  speak: 30  },
    };

    // ── State ──
    const state = {
        phase:       'SELECT',
        category:    null,
        question:    '',
        hint:        '',
        timerId:     null,
        timeLeft:    0,
        totalTime:   0,
        translating: false,
    };

    // ── CSRF ──
    function getCsrf() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    // ── Panel visibility ──
    function showPanel(name) {
        Object.values(panels).forEach(p => p.classList.add('hidden'));
        panels[name].classList.remove('hidden');
    }

    // ── Timer ──
    function startTimer(seconds) {
        stopTimer();
        state.timeLeft  = seconds;
        state.totalTime = seconds;
        updateTimerUI();
        state.timerId = setInterval(tick, 1000);
    }

    function stopTimer() {
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
    }

    function tick() {
        state.timeLeft--;
        updateTimerUI();
        if (state.timeLeft <= 0) {
            stopTimer();
            if (state.phase === 'PREP')  enterSpeak();
            else if (state.phase === 'SPEAK') enterDone();
        }
    }

    function updateTimerUI() {
        const mins = Math.floor(state.timeLeft / 60);
        const secs = String(state.timeLeft % 60).padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;

        const fraction = state.totalTime > 0 ? state.timeLeft / state.totalTime : 0;
        ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);

        if (state.timeLeft <= 10 && state.timeLeft > 0) {
            timerWrap.classList.add('yki-ring-urgent');
        } else {
            timerWrap.classList.remove('yki-ring-urgent');
        }
    }

    // ── Audio ──
    crowdAudio.volume = parseFloat(volumeSlider.value);

    function startCrowd() {
        crowdAudio.currentTime = 0;
        crowdAudio.muted = false;
        muteBtn.textContent = '🔊';
        crowdAudio.play().catch(() => {});
    }

    function stopCrowd() {
        crowdAudio.pause();
        crowdAudio.currentTime = 0;
    }

    volumeSlider.addEventListener('input', () => {
        const vol = parseFloat(volumeSlider.value);
        crowdAudio.volume = vol;
        // Keep muted flag in sync with slider — treat vol=0 as muted
        crowdAudio.muted = (vol === 0);
        muteBtn.textContent = crowdAudio.muted ? '🔇' : '🔊';
    });

    muteBtn.addEventListener('click', () => {
        crowdAudio.muted = !crowdAudio.muted;
        muteBtn.textContent = crowdAudio.muted ? '🔇' : '🔊';
        // If unmuting while slider is at 0, bump volume to a audible level
        if (!crowdAudio.muted && crowdAudio.volume === 0) {
            crowdAudio.volume = 0.3;
            volumeSlider.value = 0.3;
        }
    });

    // ── Fetch question ──
    async function loadQuestion(category) {
        const res = await fetch('/api/yki/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body: JSON.stringify({ category }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to load question');
        }
        return res.json();
    }

    // ── State transitions ──

    // SELECT → READY
    async function enterReady(category) {
        state.category = category;
        state.question = '';
        state.hint     = '';

        // Fetch question while showing ready panel
        try {
            const data = await loadQuestion(category);
            state.question = data.question;
            state.hint     = data.hint;
        } catch (e) {
            alert('Could not load question. Please try again.');
            return;
        }

        state.phase = 'READY';
        readyBadge.textContent = category;
        showPanel('ready');
    }

    // READY → PREP
    function enterPrep() {
        state.phase = 'PREP';

        // Reset translation state
        translationBlock.classList.add('hidden');
        translationText.textContent = '';
        translateBtn.classList.remove('hidden');
        translateBtn.disabled = false;
        translateBtn.textContent = '🌐 Translate to English';

        // Populate question
        questionText.textContent = state.question;
        if (state.hint) {
            hintText.textContent = state.hint;
            hintBlock.classList.remove('hidden');
        } else {
            hintBlock.classList.add('hidden');
        }

        // Phase badge
        phaseBadge.textContent = 'Prep time';
        phaseBadge.className   = 'yki-phase-badge yki-phase-prep';
        examCategory.textContent = state.category;

        // Show/hide controls
        skipPrepBtn.classList.remove('hidden');
        volumeRow.classList.add('hidden');
        stopCrowd();

        showPanel('exam');
        startTimer(TIMERS[state.category].prep);
    }

    // PREP → SPEAK
    function enterSpeak() {
        state.phase = 'SPEAK';

        phaseBadge.textContent = 'Speaking time';
        phaseBadge.className   = 'yki-phase-badge yki-phase-speak';

        skipPrepBtn.classList.add('hidden');
        volumeRow.classList.remove('hidden');

        startCrowd();
        startTimer(TIMERS[state.category].speak);
    }

    // SPEAK → DONE
    function enterDone() {
        state.phase = 'DONE';
        stopTimer();
        stopCrowd();
        showPanel('done');
    }

    // DONE / READY → SELECT
    function enterSelect() {
        state.phase    = 'SELECT';
        state.category = null;
        stopTimer();
        stopCrowd();
        showPanel('select');
    }

    // DONE → READY (same category, new question)
    async function tryAnother() {
        stopCrowd();
        await enterReady(state.category);
    }

    // ── Event listeners ──

    // Category buttons
    document.querySelectorAll('.yki-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => enterReady(btn.dataset.category));
    });

    startBtn.addEventListener('click', enterPrep);
    backFromReady.addEventListener('click', enterSelect);
    skipPrepBtn.addEventListener('click', enterSpeak);
    tryAnotherBtn.addEventListener('click', tryAnother);
    backToSelectBtn.addEventListener('click', enterSelect);

    // Translate button
    translateBtn.addEventListener('click', async () => {
        if (state.translating) return;
        state.translating = true;
        translateBtn.disabled = true;
        translateBtn.textContent = '…';

        // Clear any previous error before retrying
        translationBlock.classList.add('hidden');
        translationText.textContent = '';

        try {
            const res = await fetch('/api/yki/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ text: state.question }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Translation failed');
            translationText.textContent = data.translation;
            translationBlock.classList.remove('hidden');
            translateBtn.classList.add('hidden');   // hide after success
        } catch (e) {
            translateBtn.textContent = '🌐 Translate to English';
            translateBtn.disabled = false;
            translationText.textContent = 'Translation unavailable. Try again.';
            translationBlock.classList.remove('hidden');
        } finally {
            state.translating = false;
        }
    });

});
