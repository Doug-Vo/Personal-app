/* ══════════════════════════════════════════
   YKI Speaking Exam — yki.js
   State machine: START → PREP → SPEAK → DONE
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──
    const panels = {
        start:   document.getElementById('yki-panel-start'),
        exam:    document.getElementById('yki-panel-exam'),
        done:    document.getElementById('yki-panel-done'),
        history: document.getElementById('yki-panel-history'),
    };

    // Start panel
    const startBtn       = document.getElementById('yki-start-btn');
    const historyLinkBtn = document.getElementById('yki-history-link-btn');

    // Exam panel
    const phaseBadge   = document.getElementById('yki-phase-badge');
    const examCategory = document.getElementById('yki-exam-category');
    const examTopic    = document.getElementById('yki-exam-topic');
    const timerDisplay = document.getElementById('yki-timer-display');
    const timerBar     = document.getElementById('yki-timer-bar');

    const prepSoundWarn = document.getElementById('yki-prep-sound-warning');
    const volumeRow     = document.getElementById('yki-volume-row');
    const muteBtn       = document.getElementById('yki-mute-btn');
    const volumeSlider  = document.getElementById('yki-volume-slider');

    const questionText   = document.getElementById('yki-question-text');
    const qTranslateBtn  = document.getElementById('yki-q-translate-btn');
    const questionTrans  = document.getElementById('yki-question-translation');

    const hintBlock      = document.getElementById('yki-hint-block');
    const hintText       = document.getElementById('yki-hint-text');
    const hintTransBlock = document.getElementById('yki-hint-trans-block');
    const hTranslateBtn  = document.getElementById('yki-h-translate-btn');
    const hintTrans      = document.getElementById('yki-hint-translation');

    const notesArea       = document.getElementById('yki-notes-area');
    const notesText       = document.getElementById('yki-notes-text');
    const skipPrepBtn     = document.getElementById('yki-skip-prep-btn');
    const pauseBtn        = document.getElementById('yki-pause-btn');
    const notesToggleBtn  = document.getElementById('yki-notes-toggle-btn');
    const pickAnotherBtn  = document.getElementById('yki-pick-another-btn');
    const restartBtn      = document.getElementById('yki-restart-btn');
    const endExamBtn      = document.getElementById('yki-end-exam-btn');

    // Done panel
    const tryAnotherBtn  = document.getElementById('yki-try-another-btn');
    const backToStartBtn = document.getElementById('yki-back-to-start-btn');
    const viewHistoryBtn = document.getElementById('yki-view-history-btn');

    // History panel
    const historyList    = document.getElementById('yki-history-list');
    const historyBackBtn = document.getElementById('yki-history-back-btn');

    // Unsaved modal (shared by Pick Another + Restart)
    const unsavedModal   = document.getElementById('yki-unsaved-modal');
    const confirmUnsaved = document.getElementById('yki-confirm-unsaved');
    const cancelUnsaved  = document.getElementById('yki-cancel-unsaved');

    const crowdAudio = document.getElementById('yki-crowd-audio');

    // ── Constants ──
    const TIMERS = {
        Kertominen: { prep: 90,  speak: 90  },
        Mielipide:  { prep: 120, speak: 120 },
        Reagointi:  { prep: 30,  speak: 30  },
    };

    const HISTORY_KEY = 'yki_history';

    // ── State ──
    const state = {
        phase:            'START',
        category:         null,
        topic:            '',
        question:         '',
        translation:      '',
        hint:             '',
        hint_translation: '',
        timerId:          null,
        timeLeft:         0,
        totalTime:        0,
        paused:           false,
    };

    // UI selection on start panel
    let uiCategory    = null;
    let uiTopic       = null;

    // Pending action for the unsaved modal
    let pendingAction = null;

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
        state.paused    = false;
        timerBar.style.width      = '100%';
        timerBar.style.background = '';
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
            if (state.phase === 'PREP')       enterSpeak();
            else if (state.phase === 'SPEAK') finishExam();
        }
    }

    function updateTimerUI() {
        const mins = Math.floor(state.timeLeft / 60);
        const secs = String(state.timeLeft % 60).padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;

        const fraction = state.totalTime > 0 ? state.timeLeft / state.totalTime : 0;
        timerBar.style.width = `${fraction * 100}%`;

        const urgent = state.timeLeft <= 10 && state.timeLeft > 0;
        timerDisplay.classList.toggle('yki-timer-urgent', urgent);
        timerBar.style.background = urgent ? 'var(--accent-rose)' : '';
    }

    // ── Pause / Resume ──
    function togglePause() {
        if (!state.paused) {
            stopTimer();
            if (state.phase === 'SPEAK') crowdAudio.pause();
            state.paused = true;
            pauseBtn.textContent = '▶ Resume';
            pauseBtn.classList.add('yki-btn-active');
        } else {
            state.paused = false;
            pauseBtn.textContent = '⏸ Pause';
            pauseBtn.classList.remove('yki-btn-active');
            if (state.phase === 'SPEAK') crowdAudio.play().catch(() => {});
            state.timerId = setInterval(tick, 1000);
        }
    }

    // ── Audio ──
    function startCrowd() {
        crowdAudio.currentTime = 0;
        crowdAudio.play().catch(() => {});
    }

    function stopCrowd() {
        crowdAudio.pause();
        crowdAudio.currentTime = 0;
    }

    // ── Volume — load from server, fall back to localStorage ──
    async function loadVolPrefs() {
        try {
            const res = await fetch('/api/yki/prefs');
            if (!res.ok) throw new Error();
            const data = await res.json();
            crowdAudio.volume = data.volume ?? 0.5;
            crowdAudio.muted  = data.muted  ?? false;
        } catch {
            crowdAudio.volume = parseFloat(localStorage.getItem('yki-volume') ?? '0.5');
            crowdAudio.muted  = localStorage.getItem('yki-muted') === 'true';
        }
        volumeSlider.value  = crowdAudio.volume;
        muteBtn.textContent = crowdAudio.muted ? '🔇' : '🔊';
    }
    loadVolPrefs();

    let volSaveTimer = null;
    function saveVolPrefs() {
        clearTimeout(volSaveTimer);
        volSaveTimer = setTimeout(() => {
            fetch('/api/yki/prefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ volume: crowdAudio.volume, muted: crowdAudio.muted }),
            }).catch(() => {});
        }, 800);
    }

    volumeSlider.addEventListener('input', () => {
        const vol = parseFloat(volumeSlider.value);
        crowdAudio.volume = vol;
        crowdAudio.muted  = (vol === 0);
        muteBtn.textContent = crowdAudio.muted ? '🔇' : '🔊';
        saveVolPrefs();
    });

    muteBtn.addEventListener('click', () => {
        crowdAudio.muted = !crowdAudio.muted;
        muteBtn.textContent = crowdAudio.muted ? '🔇' : '🔊';
        if (!crowdAudio.muted && crowdAudio.volume === 0) {
            crowdAudio.volume  = 0.3;
            volumeSlider.value = 0.3;
        }
        saveVolPrefs();
    });

    // ── Translation toggles ──
    function resetTranslationToggles() {
        questionTrans.classList.add('hidden');
        qTranslateBtn.textContent = '▼ Show';
        hintTrans.classList.add('hidden');
        hTranslateBtn.textContent = '▼ Show';
    }

    qTranslateBtn.addEventListener('click', () => {
        const hidden = questionTrans.classList.toggle('hidden');
        qTranslateBtn.textContent = hidden ? '▼ Show' : '▲ Hide';
    });

    hTranslateBtn.addEventListener('click', () => {
        const hidden = hintTrans.classList.toggle('hidden');
        hTranslateBtn.textContent = hidden ? '▼ Show' : '▲ Hide';
    });

    // ── Notes persistence ──
    async function fetchPreviousNotes(question) {
        if (!question) return '';
        try {
            const res = await fetch(`/api/yki/notes?question=${encodeURIComponent(question)}`);
            if (!res.ok) return '';
            const data = await res.json();
            return data.notes || '';
        } catch { return ''; }
    }

    async function saveNotesToDB() {
        const notes = notesText.value.trim();
        if (!notes || !state.question) return;
        fetch('/api/yki/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body: JSON.stringify({ question: state.question, notes }),
        }).catch(() => {});
    }

    // ── History ──
    function getHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
        catch { return []; }
    }

    function saveToHistory() {
        const entry = {
            category:         state.category,
            topic:            state.topic || 'Random',
            question:         state.question,
            translation:      state.translation,
            hint:             state.hint,
            hint_translation: state.hint_translation,
            notes:            notesText.value.trim(),
        };
        const history = getHistory();
        history.unshift(entry);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderHistory() {
        const history = getHistory();
        if (history.length === 0) {
            historyList.innerHTML = '<p class="yki-history-empty">No questions yet — complete a round to build history.</p>';
            return;
        }
        historyList.innerHTML = history.map((e, i) => `
            <div class="yki-history-card">
                <div class="yki-history-meta">
                    <span class="yki-category-badge-sm">${escHtml(e.category)}</span>
                    <span class="yki-topic-badge">${escHtml(e.topic)}</span>
                    <button class="yki-practice-btn yki-secondary-btn" data-practice-idx="${i}">▶ Practice</button>
                </div>
                <div class="yki-content-grid">
                    <div class="yki-qcol-fi">
                        <div class="yki-question-box">
                            <p class="yki-box-label">Question</p>
                            <p class="yki-question-text">${escHtml(e.question)}</p>
                        </div>
                        ${e.hint ? `<div class="yki-hint-block">
                            <p class="yki-hint-label">Guiding questions</p>
                            <p class="yki-hint-text">${escHtml(e.hint)}</p>
                        </div>` : ''}
                    </div>
                    <div class="yki-qcol-en">
                        <div class="yki-trans-box">
                            <p class="yki-box-label">Translation</p>
                            <p class="yki-en-text">${escHtml(e.translation)}</p>
                        </div>
                        ${e.hint_translation ? `<div class="yki-trans-box">
                            <p class="yki-box-label">Hint translation</p>
                            <p class="yki-en-text">${escHtml(e.hint_translation)}</p>
                        </div>` : ''}
                    </div>
                </div>
                ${e.notes ? `<div class="yki-history-notes">
                    <p class="yki-box-label">Your notes</p>
                    <p class="yki-history-notes-text">${escHtml(e.notes)}</p>
                </div>` : ''}
            </div>
        `).join('');
    }

    // ── Fetch question ──
    async function loadQuestion(category, topic) {
        const res = await fetch('/api/yki/question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
            body: JSON.stringify({ category, topic }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to load question');
        }
        return res.json();
    }

    // ── State transitions ──

    // → START
    function enterStart() {
        state.phase    = 'START';
        state.category = null;
        state.topic    = '';
        stopTimer();
        stopCrowd();
        showPanel('start');
    }

    function resetStartPanel() {
        document.querySelectorAll('.yki-cat-btn[data-category], .yki-topic-btn').forEach(b => b.classList.remove('yki-selected'));
        uiCategory        = null;
        uiTopic           = null;
        startBtn.disabled = true;
    }

    // → PREP (preloaded = history entry to replay without fetching)
    async function enterPrep(category, topic, preloaded = null) {
        state.category = category;
        state.topic    = topic;

        if (preloaded) {
            state.question         = preloaded.question;
            state.translation      = preloaded.translation || '';
            state.hint             = preloaded.hint || '';
            state.hint_translation = preloaded.hint_translation || '';
        } else {
            startBtn.disabled    = true;
            startBtn.textContent = 'Loading…';
            try {
                const data = await loadQuestion(state.category, state.topic);
                state.question         = data.question;
                state.translation      = data.translation || '';
                state.hint             = data.hint || '';
                state.hint_translation = data.hint_translation || '';
            } catch {
                alert('Could not load question. Please try again.');
                startBtn.disabled    = false;
                startBtn.textContent = 'Start Exam';
                return;
            }
            startBtn.disabled    = false;
            startBtn.textContent = 'Start Exam';
        }

        state.phase = 'PREP';

        // Populate question/translation
        questionText.textContent  = state.question;
        questionTrans.textContent = state.translation;

        if (state.hint) {
            hintText.textContent  = state.hint;
            hintTrans.textContent = state.hint_translation;
            hintBlock.classList.remove('hidden');
            if (state.hint_translation) hintTransBlock.classList.remove('hidden');
            else                        hintTransBlock.classList.add('hidden');
        } else {
            hintBlock.classList.add('hidden');
            hintTransBlock.classList.add('hidden');
        }

        resetTranslationToggles();

        // Fetch and populate previous notes
        const prevNotes = await fetchPreviousNotes(state.question);
        notesText.value = prevNotes;
        if (prevNotes) {
            notesArea.classList.remove('hidden');
            notesToggleBtn.textContent = '📝 Hide Notes';
        } else {
            notesArea.classList.add('hidden');
            notesToggleBtn.textContent = '📝 Notes';
        }

        phaseBadge.textContent   = 'Prep time';
        phaseBadge.className     = 'yki-phase-badge yki-phase-prep';
        examCategory.textContent = state.category;
        examTopic.textContent    = state.topic || 'Random';

        prepSoundWarn.classList.remove('hidden');
        skipPrepBtn.classList.remove('hidden');
        endExamBtn.classList.add('hidden');
        volumeRow.classList.add('hidden');
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.classList.remove('yki-btn-active');
        state.paused = false;

        showPanel('exam');
        startTimer(TIMERS[state.category].prep);
    }

    // PREP → SPEAK
    function enterSpeak() {
        state.phase = 'SPEAK';

        phaseBadge.textContent = 'Speaking time';
        phaseBadge.className   = 'yki-phase-badge yki-phase-speak';
        prepSoundWarn.classList.add('hidden');
        skipPrepBtn.classList.add('hidden');
        endExamBtn.classList.remove('hidden');
        volumeRow.classList.remove('hidden');
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.classList.remove('yki-btn-active');
        state.paused = false;

        startCrowd();
        startTimer(TIMERS[state.category].speak);
    }

    // → DONE (saves notes + history)
    async function finishExam() {
        stopTimer();
        stopCrowd();
        state.phase = 'DONE';
        saveToHistory();
        await saveNotesToDB();
        showPanel('done');
    }

    // → HISTORY
    function enterHistory() {
        state.phase = 'HISTORY';
        renderHistory();
        showPanel('history');
    }

    // ── Start panel: category + topic selection ──

    document.querySelectorAll('.yki-cat-btn[data-category]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.yki-cat-btn[data-category]').forEach(b => b.classList.remove('yki-selected'));
            btn.classList.add('yki-selected');
            uiCategory        = btn.dataset.category;
            startBtn.disabled = false;
        });
    });

    document.querySelectorAll('.yki-topic-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.yki-topic-btn').forEach(b => b.classList.remove('yki-selected'));
            btn.classList.add('yki-selected');
            uiTopic = btn.dataset.topic;
        });
    });

    startBtn.addEventListener('click', () => {
        if (!uiCategory) return;
        enterPrep(uiCategory, uiTopic ?? '');
    });

    historyLinkBtn.addEventListener('click', enterHistory);

    // ── Exam buttons ──
    pauseBtn.addEventListener('click', togglePause);
    skipPrepBtn.addEventListener('click', enterSpeak);
    endExamBtn.addEventListener('click', finishExam);

    notesToggleBtn.addEventListener('click', () => {
        const hidden = notesArea.classList.toggle('hidden');
        notesToggleBtn.textContent = hidden ? '📝 Notes' : '📝 Hide Notes';
    });

    // Pick Another — show modal, on confirm load new question (no save)
    pickAnotherBtn.addEventListener('click', () => {
        pendingAction = 'pickAnother';
        unsavedModal.classList.remove('hidden');
    });

    // Restart — show modal, on confirm go back to start (no save)
    restartBtn.addEventListener('click', () => {
        pendingAction = 'restart';
        unsavedModal.classList.remove('hidden');
    });

    confirmUnsaved.addEventListener('click', async () => {
        unsavedModal.classList.add('hidden');
        if (pendingAction === 'pickAnother') {
            stopTimer();
            stopCrowd();
            await enterPrep(state.category, state.topic);
        } else if (pendingAction === 'restart') {
            stopTimer();
            stopCrowd();
            resetStartPanel();
            enterStart();
        }
        pendingAction = null;
    });

    cancelUnsaved.addEventListener('click', () => {
        unsavedModal.classList.add('hidden');
        pendingAction = null;
    });

    unsavedModal.addEventListener('click', e => {
        if (e.target === unsavedModal) {
            unsavedModal.classList.add('hidden');
            pendingAction = null;
        }
    });

    // ── Done panel ──
    tryAnotherBtn.addEventListener('click', () => {
        enterPrep(state.category, state.topic);
    });

    backToStartBtn.addEventListener('click', () => {
        resetStartPanel();
        enterStart();
    });

    viewHistoryBtn.addEventListener('click', enterHistory);

    // ── History panel ──
    historyBackBtn.addEventListener('click', enterStart);

    // Practice a question from history (event delegation)
    historyList.addEventListener('click', e => {
        const btn = e.target.closest('[data-practice-idx]');
        if (!btn) return;
        const idx   = parseInt(btn.dataset.practiceIdx);
        const entry = getHistory()[idx];
        if (!entry) return;
        const topic = (entry.topic === 'Random') ? '' : entry.topic;
        enterPrep(entry.category, topic, entry);
    });

});
