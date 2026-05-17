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

    // Timer
    const timerBlock      = document.getElementById('yki-timer-block');
    const timerSentinel   = document.getElementById('yki-timer-sentinel');
    const timerDisplay    = document.getElementById('yki-timer-display');
    const timerBar        = document.getElementById('yki-timer-bar');
    const restartTimerBtn = document.getElementById('yki-restart-timer-btn');
    const clockPauseBtn   = document.getElementById('yki-clock-pause-btn');

    // Phase / badges
    const phaseBadge  = document.getElementById('yki-phase-badge');
    const examCategory = document.getElementById('yki-exam-category');
    const examTopic    = document.getElementById('yki-exam-topic');

    // Exam panel misc
    const prepSoundWarn = document.getElementById('yki-prep-sound-warning');
    const volumeRow     = document.getElementById('yki-volume-row');
    const muteBtn       = document.getElementById('yki-mute-btn');
    const volumeSlider  = document.getElementById('yki-volume-slider');

    // Question + peel-reveal translation boxes
    const questionText   = document.getElementById('yki-question-text');
    const questionTrans  = document.getElementById('yki-question-translation');
    const qTransBox      = document.getElementById('yki-q-trans-box');
    const hintBlock      = document.getElementById('yki-hint-block');
    const hintText       = document.getElementById('yki-hint-text');
    const hintTransBlock = document.getElementById('yki-hint-trans-block');
    const hintTrans      = document.getElementById('yki-hint-translation');

    // Notes
    const notesArea     = document.getElementById('yki-notes-area');
    const notesText     = document.getElementById('yki-notes-text');
    const notesToggleBtn = document.getElementById('yki-notes-toggle-btn');

    // Inline translator
    const translatorToggleBtn = document.getElementById('yki-translator-toggle-btn');
    const translatorPanel     = document.getElementById('yki-translator-panel');
    const transSrcSel         = document.getElementById('yki-trans-src');
    const transTgtSel         = document.getElementById('yki-trans-tgt');
    const transSwapBtn        = document.getElementById('yki-trans-swap-btn');
    const transInput          = document.getElementById('yki-trans-input');
    const transGoBtn          = document.getElementById('yki-trans-go-btn');
    const transOutput         = document.getElementById('yki-trans-output');

    // Action row
    const quitBtn        = document.getElementById('yki-quit-btn');
    const pickAnotherBtn = document.getElementById('yki-pick-another-btn');
    const skipPrepBtn    = document.getElementById('yki-skip-prep-btn');
    const pauseBtn       = document.getElementById('yki-pause-btn');
    const endExamBtn     = document.getElementById('yki-end-exam-btn');

    // Done panel
    const retakeBtn          = document.getElementById('yki-retake-btn');
    const tryAnotherBtn      = document.getElementById('yki-try-another-btn');
    const donePickAnotherBtn = document.getElementById('yki-done-pick-another-btn');
    const backToStartBtn     = document.getElementById('yki-back-to-start-btn');
    const viewHistoryBtn = document.getElementById('yki-view-history-btn');
    const doneQuestion   = document.getElementById('yki-done-question');
    const doneHintWrap   = document.getElementById('yki-done-hint-wrap');
    const doneHint       = document.getElementById('yki-done-hint');
    const doneTranslation       = document.getElementById('yki-done-translation');
    const doneHintTransWrap     = document.getElementById('yki-done-hint-trans-wrap');
    const doneHintTranslation   = document.getElementById('yki-done-hint-translation');

    // History panel
    const historyList    = document.getElementById('yki-history-list');
    const historyBackBtn = document.getElementById('yki-history-back-btn');

    // Question picker
    const qpickerWrap = document.getElementById('yki-qpicker-wrap');
    const qpickerList = document.getElementById('yki-qpicker-list');

    // Unsaved modal
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
        topicActual:      '',
        question:         '',
        translation:      '',
        hint:             '',
        hint_translation: '',
        timerId:          null,
        timeLeft:         0,
        totalTime:        0,
        paused:           false,
    };

    let uiCategory         = null;
    let uiTopic            = null;
    let pendingAction      = null;
    let uiSelectedQuestion = null;  // null = random; object = specific question from picker
    let qpickerFetchId     = 0;     // guards against stale fetch responses
    let qpickerQuestions   = [];    // backing array for the rendered picker items

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

    // ── Auto pop-out timer (IntersectionObserver on sentinel) ──
    function unPopTimer() {
        timerBlock.classList.remove('yki-popped');
    }

    const timerObserver = new IntersectionObserver((entries) => {
        if (panels.exam.classList.contains('hidden')) return;
        const shouldPop = !entries[0].isIntersecting;
        timerBlock.classList.toggle('yki-popped', shouldPop);
    }, { threshold: 0 });

    timerObserver.observe(timerSentinel);

    // ── Pause / Resume — syncs both action-row button and clock button ──
    function setPauseUI(paused) {
        const label = paused ? '▶ Resume' : '⏸ Pause';
        pauseBtn.textContent      = label;
        clockPauseBtn.textContent = paused ? '▶' : '⏸';
        pauseBtn.classList.toggle('yki-btn-active', paused);
        clockPauseBtn.classList.toggle('yki-btn-active', paused);
    }

    function togglePause() {
        if (!state.paused) {
            stopTimer();
            if (state.phase === 'SPEAK') crowdAudio.pause();
            state.paused = true;
        } else {
            state.paused = false;
            if (state.phase === 'SPEAK') crowdAudio.play().catch(() => {});
            state.timerId = setInterval(tick, 1000);
        }
        setPauseUI(state.paused);
    }

    pauseBtn.addEventListener('click', togglePause);
    clockPauseBtn.addEventListener('click', togglePause);

    // ── Restart timer ──
    restartTimerBtn.addEventListener('click', () => {
        const wasInSpeak = state.phase === 'SPEAK' && state.paused;
        const duration   = state.phase === 'PREP'
            ? TIMERS[state.category].prep
            : TIMERS[state.category].speak;
        startTimer(duration);
        setPauseUI(false);
        if (wasInSpeak) crowdAudio.play().catch(() => {});
    });

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

    // ── Peel reveal / hide ──
    function resetTranslationToggles() {
        qTransBox.classList.remove('yki-revealed');
        hintTransBlock.classList.remove('yki-revealed');
    }

    qTransBox.querySelector('.yki-peel-cover').addEventListener('click', () => {
        qTransBox.classList.add('yki-revealed');
    });
    qTransBox.querySelector('.yki-peel-hide-btn').addEventListener('click', () => {
        qTransBox.classList.remove('yki-revealed');
    });

    hintTransBlock.querySelector('.yki-peel-cover').addEventListener('click', () => {
        hintTransBlock.classList.add('yki-revealed');
    });
    hintTransBlock.querySelector('.yki-peel-hide-btn').addEventListener('click', () => {
        hintTransBlock.classList.remove('yki-revealed');
    });

    // ── Inline translator ──
    translatorToggleBtn.addEventListener('click', () => {
        const hidden = translatorPanel.classList.toggle('hidden');
        translatorToggleBtn.classList.toggle('yki-btn-active', !hidden);
    });

    transSwapBtn.addEventListener('click', () => {
        const src = transSrcSel.value;
        transSrcSel.value = transTgtSel.value;
        transTgtSel.value = src;
    });

    transGoBtn.addEventListener('click', async () => {
        const text = transInput.value.trim();
        if (!text) return;
        transGoBtn.disabled    = true;
        transGoBtn.textContent = '…';
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ text, source_lang: transSrcSel.value }),
            });
            if (!res.ok) throw new Error();
            const data   = await res.json();
            const tgtKey = transTgtSel.value;
            transOutput.textContent = data[tgtKey] || data[Object.keys(data)[0]] || '';
        } catch {
            transOutput.textContent = 'Translation failed. Please try again.';
        } finally {
            transGoBtn.disabled    = false;
            transGoBtn.textContent = 'Translate';
        }
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
            topic:            state.topicActual || state.topic || 'Random',
            topicActual:      state.topicActual,
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
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
                        <div class="yki-trans-box yki-trans-plain">
                            <p class="yki-box-label">Translation</p>
                            <p class="yki-en-text">${escHtml(e.translation)}</p>
                        </div>
                        ${e.hint_translation ? `<div class="yki-trans-box yki-trans-plain">
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

    // ── Question picker helpers ──

    function hideQPicker() {
        uiSelectedQuestion = null;
        qpickerWrap.classList.add('hidden');
        qpickerList.innerHTML = '';
    }

    function handleQPickerClick(e) {
        const item = e.target.closest('.yki-qpicker-item');
        if (!item) return;
        qpickerList.querySelectorAll('.yki-qpicker-item').forEach(el => el.classList.remove('yki-qpicker-selected'));
        item.classList.add('yki-qpicker-selected');
        const idx = item.dataset.qidx;
        uiSelectedQuestion = idx === 'random' ? null : qpickerQuestions[parseInt(idx)];
    }

    function renderQPicker(questions) {
        const items = [`
            <div class="yki-qpicker-item yki-qpicker-random yki-qpicker-selected" data-qidx="random">
                <span class="yki-qpicker-shuffle">🔀</span>
                <span class="yki-qpicker-text">Random from this topic</span>
            </div>`];

        questions.forEach((q, i) => {
            items.push(`
            <div class="yki-qpicker-item${q.has_notes ? ' yki-qpicker-done' : ''}" data-qidx="${i}">
                ${q.has_notes ? '<span class="yki-qpicker-check" title="Notes saved">✓</span>' : '<span class="yki-qpicker-check yki-qpicker-check-empty"></span>'}
                <span class="yki-qpicker-text">${escHtml(q.question)}</span>
            </div>`);
        });

        qpickerQuestions = questions;
        qpickerList.innerHTML = items.join('');
        qpickerList.removeEventListener('click', handleQPickerClick);
        qpickerList.addEventListener('click', handleQPickerClick);
    }

    async function fetchAndRenderQPicker(category, topic) {
        const fetchId = ++qpickerFetchId;
        qpickerWrap.classList.remove('hidden');
        qpickerList.innerHTML = '<p class="yki-qpicker-loading">Loading questions…</p>';
        uiSelectedQuestion = null;
        try {
            const res = await fetch(`/api/yki/questions?category=${encodeURIComponent(category)}&topic=${encodeURIComponent(topic)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            if (fetchId !== qpickerFetchId) return;
            renderQPicker(data.questions || []);
        } catch {
            if (fetchId !== qpickerFetchId) return;
            qpickerList.innerHTML = '<p class="yki-qpicker-loading">Could not load questions.</p>';
        }
    }

    // ── State transitions ──

    function enterStart() {
        unPopTimer();
        state.phase    = 'START';
        state.category = null;
        state.topic    = '';
        state.topicActual = '';
        uiSelectedQuestion = null;
        stopTimer();
        stopCrowd();
        showPanel('start');
        if (uiCategory && uiTopic) fetchAndRenderQPicker(uiCategory, uiTopic);
    }

    function resetStartPanel() {
        document.querySelectorAll('.yki-cat-btn[data-category], .yki-topic-btn').forEach(b => b.classList.remove('yki-selected'));
        uiCategory        = null;
        uiTopic           = null;
        startBtn.disabled = true;
        hideQPicker();
    }

    async function enterPrep(category, topic, preloaded = null) {
        state.category    = category;
        state.topic       = topic;
        state.topicActual = '';

        if (preloaded) {
            state.question         = preloaded.question;
            state.translation      = preloaded.translation || '';
            state.hint             = preloaded.hint || '';
            state.hint_translation = preloaded.hint_translation || '';
            state.topicActual      = preloaded.topicActual || preloaded.topic || topic || '';
        } else {
            startBtn.disabled    = true;
            startBtn.textContent = 'Loading…';
            try {
                const data = await loadQuestion(state.category, state.topic);
                state.question         = data.question;
                state.translation      = data.translation || '';
                state.hint             = data.hint || '';
                state.hint_translation = data.hint_translation || '';
                state.topicActual      = data.topic || topic || '';
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

        const prevNotes = await fetchPreviousNotes(state.question);
        notesText.value = prevNotes;
        if (prevNotes) {
            notesArea.classList.remove('hidden');
            notesToggleBtn.textContent = '📝 Hide Notes';
        } else {
            notesArea.classList.add('hidden');
            notesToggleBtn.textContent = '📝 Notes';
        }

        // Reset translator
        translatorPanel.classList.add('hidden');
        translatorToggleBtn.classList.remove('yki-btn-active');
        transInput.value        = '';
        transOutput.textContent = '';

        // Topic badge: show actual topic for random picks
        if (topic === '' && state.topicActual) {
            examTopic.textContent = `Random · ${state.topicActual}`;
        } else {
            examTopic.textContent = state.topicActual || topic || 'Random';
        }
        phaseBadge.textContent   = 'Prep time';
        phaseBadge.className     = 'yki-phase-badge yki-phase-prep';
        examCategory.textContent = state.category;

        prepSoundWarn.classList.remove('hidden');
        skipPrepBtn.classList.remove('hidden');
        endExamBtn.classList.add('hidden');
        volumeRow.classList.add('hidden');
        setPauseUI(false);
        state.paused = false;

        showPanel('exam');
        startTimer(TIMERS[state.category].prep);
    }

    function enterSpeak() {
        state.phase = 'SPEAK';

        phaseBadge.textContent = 'Speaking time';
        phaseBadge.className   = 'yki-phase-badge yki-phase-speak';
        prepSoundWarn.classList.add('hidden');
        skipPrepBtn.classList.add('hidden');
        endExamBtn.classList.remove('hidden');
        volumeRow.classList.remove('hidden');
        setPauseUI(false);
        state.paused = false;

        startCrowd();
        startTimer(TIMERS[state.category].speak);
    }

    async function finishExam() {
        stopTimer();
        stopCrowd();
        unPopTimer();
        state.phase = 'DONE';
        saveToHistory();
        await saveNotesToDB();

        // Populate done panel recap
        doneQuestion.textContent = state.question;
        doneTranslation.textContent = state.translation;
        if (state.hint) {
            doneHint.textContent = state.hint;
            doneHintWrap.classList.remove('hidden');
        } else {
            doneHintWrap.classList.add('hidden');
        }
        if (state.hint_translation) {
            doneHintTranslation.textContent = state.hint_translation;
            doneHintTransWrap.classList.remove('hidden');
        } else {
            doneHintTransWrap.classList.add('hidden');
        }

        showPanel('done');
    }

    function enterHistory() {
        unPopTimer();
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
            if (uiTopic) {
                fetchAndRenderQPicker(uiCategory, uiTopic);
            } else {
                hideQPicker();
            }
        });
    });

    document.querySelectorAll('.yki-topic-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.yki-topic-btn').forEach(b => b.classList.remove('yki-selected'));
            btn.classList.add('yki-selected');
            uiTopic = btn.dataset.topic;
            if (uiTopic && uiCategory) {
                fetchAndRenderQPicker(uiCategory, uiTopic);
            } else {
                hideQPicker();
            }
        });
    });

    startBtn.addEventListener('click', () => {
        if (!uiCategory) return;
        if (uiSelectedQuestion) {
            enterPrep(uiCategory, uiSelectedQuestion.topic || uiTopic, uiSelectedQuestion);
        } else {
            enterPrep(uiCategory, uiTopic ?? '');
        }
    });

    historyLinkBtn.addEventListener('click', enterHistory);

    // ── Exam control buttons ──
    skipPrepBtn.addEventListener('click', enterSpeak);
    endExamBtn.addEventListener('click', finishExam);

    notesToggleBtn.addEventListener('click', () => {
        const hidden = notesArea.classList.toggle('hidden');
        notesToggleBtn.textContent = hidden ? '📝 Notes' : '📝 Hide Notes';
    });

    quitBtn.addEventListener('click', () => {
        pendingAction = 'quit';
        unsavedModal.classList.remove('hidden');
    });

    pickAnotherBtn.addEventListener('click', () => {
        pendingAction = 'pickAnother';
        unsavedModal.classList.remove('hidden');
    });

    confirmUnsaved.addEventListener('click', async () => {
        unsavedModal.classList.add('hidden');
        if (pendingAction === 'pickAnother') {
            stopTimer();
            stopCrowd();
            await enterPrep(state.category, state.topic);
        } else if (pendingAction === 'quit') {
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
    retakeBtn.addEventListener('click', () => {
        enterPrep(state.category, state.topicActual || state.topic, {
            question:         state.question,
            translation:      state.translation,
            hint:             state.hint,
            hint_translation: state.hint_translation,
            topicActual:      state.topicActual,
        });
    });

    tryAnotherBtn.addEventListener('click', () => enterPrep(state.category, state.topic));
    donePickAnotherBtn.addEventListener('click', () => enterPrep(state.category, state.topicActual || state.topic));

    backToStartBtn.addEventListener('click', () => {
        resetStartPanel();
        enterStart();
    });

    viewHistoryBtn.addEventListener('click', enterHistory);

    // ── History panel ──
    historyBackBtn.addEventListener('click', enterStart);

    historyList.addEventListener('click', e => {
        const btn = e.target.closest('[data-practice-idx]');
        if (!btn) return;
        const idx   = parseInt(btn.dataset.practiceIdx);
        const entry = getHistory()[idx];
        if (!entry) return;
        enterPrep(entry.category, entry.topicActual || '', entry);
    });

});
