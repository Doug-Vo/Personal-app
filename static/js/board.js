/* ══════════════════════════════════════════
   Ỉn's Planner — board.js
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── State ──
    let tasks    = [];
    let archives = [];
    let dragging = null;        // for desktop HTML5 drag
    let ghost    = null;
    let density  = localStorage.getItem('board-density') || 'comfortable';

    // Touch drag state
    let touchDragging   = null;
    let touchClone      = null;
    let touchOriginCol  = null;
    let touchLastTarget = null;

    // Calendar state
    let calYear  = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    let calSelectedDate = null;

    // Task modal state
    let modalTaskId = null;

    const COLS           = ['todo', 'inprogress', 'done'];
    const PRIORITY_LABEL = { 0: '', 1: '🟢', 2: '🟡', 3: '🔴' };
    const RECUR_LABEL    = { none: '', daily: '🔁 Daily', weekly: '🔁 Weekly', monthly: '🔁 Monthly' };
    const MONTH_NAMES    = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];

    // ── DOM refs ──
    const addBtn        = document.getElementById('board-add-btn');
    const newTitle      = document.getElementById('board-new-title');
    const newCol        = document.getElementById('board-new-col');
    const newPri        = document.getElementById('board-new-priority');
    const newDue        = document.getElementById('board-new-due');
    const newTime       = document.getElementById('board-new-time');
    const newRecur      = document.getElementById('board-new-recur');
    const weekDates     = document.getElementById('board-week-dates');
    const archiveEl     = document.getElementById('board-archive');
    const archiveDrawer = document.getElementById('board-archive-drawer');
    const boardColumns  = document.getElementById('board-columns');

    const calGrid        = document.getElementById('cal-grid');
    // cal-month-title removed — month/year shown via cal-bar-select + cal-bar-year
    const calDayPanel    = document.getElementById('cal-day-panel');
    const calDayTitle    = document.getElementById('cal-day-panel-title');
    const calDayTasks    = document.getElementById('cal-day-tasks');
    const calAddBtn      = document.getElementById('cal-add-btn');
    const calNewTitle    = document.getElementById('cal-new-title');
    const calNewTime     = document.getElementById('cal-new-time');
    const calNewPriority = document.getElementById('cal-new-priority');
    const calJumpMonth   = document.getElementById('cal-jump-month');
    const calJumpYear    = document.getElementById('cal-jump-year');

    const taskModal     = document.getElementById('task-modal');
    const tmTitle       = document.getElementById('tm-title');
    const tmCol         = document.getElementById('tm-col');
    const tmPriority    = document.getElementById('tm-priority');
    const tmRecur       = document.getElementById('tm-recur');
    const tmDue         = document.getElementById('tm-due');
    const tmTime        = document.getElementById('tm-time');
    const tmNotes       = document.getElementById('tm-notes');
    const tmSubtasks    = document.getElementById('tm-subtasks');
    const tmSubInput    = document.getElementById('tm-subtask-input');
    const tmSubAdd      = document.getElementById('tm-subtask-add');

    // ── Apply density ──
    function applyDensity(d) {
        density = d;
        localStorage.setItem('board-density', d);
        boardColumns.dataset.density = d;
        document.querySelectorAll('.density-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.density === d);
        });
    }
    applyDensity(density);
    document.querySelectorAll('.density-btn').forEach(btn => {
        btn.addEventListener('click', () => applyDensity(btn.dataset.density));
    });

    // ── Tab switching ──
    document.querySelectorAll('.board-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.board-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.board-tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'calendar') renderCalendar();
            if (btn.dataset.tab === 'board')    renderAll();

        });
    });

    // ── Week banner ──
    function getWeekRange() {
        const now = new Date();
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = d => d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        return `${fmt(mon)} – ${fmt(sun)}`;
    }
    weekDates.textContent = getWeekRange();

    // ── Fetch board data ──
    async function loadBoard() {
        try {
            const res  = await fetch('/board/data');
            const data = await res.json();
            tasks    = data.tasks    || [];
            archives = data.archives || [];
            renderAll();
        } catch (e) { console.error('Board load error:', e); }
    }

    // ── Render all columns ──
    function renderAll() {
        COLS.forEach(col => {
            const container = document.getElementById(`cards-${col}`);
            const colTasks  = tasks.filter(t => t.column === col)
                .sort((a, b) => {
                    if (a.due_date && !b.due_date) return -1;
                    if (!a.due_date && b.due_date) return 1;
                    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                    return 0;
                });
            container.innerHTML = '';
            container.appendChild(colTasks.length === 0
                ? Object.assign(document.createElement('div'), { className: 'board-empty-hint', textContent: 'Drop tasks here' })
                : (() => { const f = document.createDocumentFragment(); colTasks.forEach(t => f.appendChild(makeCard(t))); return f; })()
            );
            document.getElementById(`count-${col}`).textContent = colTasks.length;
        });
        renderArchive();
        attachDropZones();
        attachTouchDrag();
    }

    // ── Build a task card ──
    function makeCard(task) {
        const card = document.createElement('div');
        card.className  = 'board-card';
        card.draggable  = true;
        card.dataset.id = task._id;
        card.dataset.col= task.column;

        const created = task.created_at
            ? new Date(task.created_at).toLocaleDateString('default', { month: 'short', day: 'numeric' })
            : '';

        let dueBadge = '';
        if (task.due_date) {
            const due     = new Date(task.due_date + 'T00:00:00');
            const today   = new Date(); today.setHours(0,0,0,0);
            const isOver  = due < today;
            const isToday = due.toDateString() === today.toDateString();
            const label   = due.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            const timeStr = task.due_time ? ` ${task.due_time}` : '';
            const cls     = isOver ? 'due-badge overdue' : isToday ? 'due-badge today' : 'due-badge';
            dueBadge = `<span class="${cls}">📅 ${label}${timeStr}</span>`;
        }

        const priEmoji   = PRIORITY_LABEL[task.priority || 0];
        const recurLabel = task.recur && task.recur !== 'none' ? `<span class="recur-badge">${RECUR_LABEL[task.recur]}</span>` : '';
        const subDone    = (task.subtasks || []).filter(s => s.done).length;
        const subTotal   = (task.subtasks || []).length;
        const subBadge   = subTotal > 0 ? `<span class="subtask-badge">☑ ${subDone}/${subTotal}</span>` : '';
        const notesDot   = task.notes ? `<span class="notes-dot" title="Has notes">📝</span>` : '';

        card.innerHTML = `
            <span class="board-card-drag-handle" title="Drag to move">⠿</span>
            <div class="board-card-body">
                <div class="board-card-title">${escHtml(task.title)}</div>
                <div class="board-card-meta-row">
                    ${priEmoji ? `<span class="board-card-priority">${priEmoji}</span>` : ''}
                    ${dueBadge}${recurLabel}${subBadge}${notesDot}
                    ${created && !task.due_date ? `<span class="board-card-added">Added ${created}</span>` : ''}
                </div>
            </div>
            <div class="board-card-actions">
                <button class="board-card-btn edit"        title="Edit"    data-id="${task._id}">✏️</button>
                <button class="board-card-btn archive-btn" title="Archive" data-id="${task._id}">📦</button>
                <button class="board-card-btn delete"      title="Delete"  data-id="${task._id}">✕</button>
            </div>
        `;

        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragend',   onDragEnd);
        card.querySelector('.board-card-body').addEventListener('click', () => openModal(task._id));
        card.querySelector('.board-card-btn.edit').addEventListener('click', e => { e.stopPropagation(); openModal(task._id); });
        card.querySelector('.board-card-btn.archive-btn').addEventListener('click', e => { e.stopPropagation(); confirmArchive(card, task); });
        card.querySelector('.board-card-btn.delete').addEventListener('click', e => { e.stopPropagation(); confirmDelete(card, task._id); });

        return card;
    }

    // ══════════════════════════════════════════
    // TASK DETAIL MODAL
    // ══════════════════════════════════════════
    function openModal(taskId) {
        const task = tasks.find(t => t._id === taskId);
        if (!task) return;
        modalTaskId = taskId;

        tmTitle.value    = task.title;
        tmCol.value      = task.column;
        tmPriority.value = task.priority || 0;
        tmRecur.value    = task.recur || 'none';
        tmDue.value      = task.due_date || '';
        tmTime.value     = task.due_time || '';
        tmNotes.innerHTML= task.notes   || '';

        renderModalSubtasks(task.subtasks || []);

        taskModal.style.display = 'flex';
        tmTitle.focus();
    }

    function renderModalSubtasks(subtasks) {
        tmSubtasks.innerHTML = '';
        subtasks.forEach((st, i) => {
            const row = document.createElement('div');
            row.className = 'tm-subtask-row';
            row.innerHTML = `
                <input type="checkbox" class="tm-subtask-check" data-idx="${i}" ${st.done ? 'checked' : ''} />
                <span class="tm-subtask-text ${st.done ? 'done' : ''}">${escHtml(st.text)}</span>
                <button class="board-card-btn delete tm-sub-del" data-idx="${i}" title="Remove">✕</button>
            `;
            row.querySelector('.tm-subtask-check').addEventListener('change', e => {
                const task = tasks.find(t => t._id === modalTaskId);
                if (!task) return;
                task.subtasks[i].done = e.target.checked;
                e.target.nextElementSibling.classList.toggle('done', e.target.checked);
            });
            row.querySelector('.tm-sub-del').addEventListener('click', () => {
                const task = tasks.find(t => t._id === modalTaskId);
                if (!task) return;
                task.subtasks.splice(i, 1);
                renderModalSubtasks(task.subtasks);
            });
            tmSubtasks.appendChild(row);
        });
    }

    // Add subtask
    function addSubtask() {
        const text = tmSubInput.value.trim();
        if (!text) return;
        const task = tasks.find(t => t._id === modalTaskId);
        if (!task) return;
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push({ text, done: false });
        renderModalSubtasks(task.subtasks);
        tmSubInput.value = '';
        tmSubInput.focus();
    }
    tmSubAdd.addEventListener('click', addSubtask);
    tmSubInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } });

    // Rich text toolbar
    document.querySelectorAll('.rich-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            tmNotes.focus();
        });
    });

    // Save modal
    document.getElementById('task-modal-save').addEventListener('click', saveModal);
    document.getElementById('task-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('task-modal-close').addEventListener('click',  closeModal);
    taskModal.addEventListener('click', e => { if (e.target === taskModal) closeModal(); });

    async function saveModal() {
        const savedId = modalTaskId;   // capture BEFORE closeModal nulls it
        const task = tasks.find(t => t._id === savedId);
        if (!task) return;

        const updates = {
            title:    tmTitle.value.trim() || task.title,
            column:   tmCol.value,
            priority: parseInt(tmPriority.value) || 0,
            recur:    tmRecur.value,
            due_date: tmDue.value  || null,
            due_time: tmTime.value || null,
            notes:    tmNotes.innerHTML,
            subtasks: task.subtasks || [],
        };

        Object.assign(task, updates);
        // If saving with column=done and task is recurring, advance instead
        if (updates.column === 'done' && task.recur && task.recur !== 'none') {
            const nextDate = advanceRecurDate(task.due_date, task.recur);
            task.column   = 'todo';
            task.due_date = nextDate;
            updates.column   = 'todo';
            updates.due_date = nextDate;
        }
        closeModal();
        renderAll();
        await patchTask(savedId, updates);
        renderCalendar();
    }

    function closeModal() {
        taskModal.style.display = 'none';
        modalTaskId = null;
    }

    // ══════════════════════════════════════════
    // CONFIRM POPUPS
    // ══════════════════════════════════════════
    function confirmArchive(card, task) {
        if (card.querySelector('.board-action-confirm')) return;
        const pill = document.createElement('div');
        pill.className = 'board-delete-confirm board-action-confirm';
        pill.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">Archive?</span>
            <button class="board-card-btn confirm-yes">✓</button>
            <button class="board-card-btn confirm-no">✕</button>`;
        card.appendChild(pill);
        pill.querySelector('.confirm-yes').addEventListener('click', async () => {
            card.style.opacity = '0.4';
            await manualArchiveTask(task);
        });
        pill.querySelector('.confirm-no').addEventListener('click', () => pill.remove());
        setTimeout(() => document.addEventListener('click', () => pill.remove(), { once: true }), 0);
    }

    function confirmDelete(card, taskId) {
        if (card.querySelector('.board-action-confirm')) return;
        const pill = document.createElement('div');
        pill.className = 'board-delete-confirm board-action-confirm';
        pill.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">Delete?</span>
            <button class="board-card-btn confirm-yes">✓</button>
            <button class="board-card-btn confirm-no">✕</button>`;
        card.appendChild(pill);
        pill.querySelector('.confirm-yes').addEventListener('click', async () => {
            card.style.opacity = '0.4';
            await deleteTask(taskId);
        });
        pill.querySelector('.confirm-no').addEventListener('click', () => pill.remove());
        setTimeout(() => document.addEventListener('click', () => pill.remove(), { once: true }), 0);
    }

    // ══════════════════════════════════════════
    // ARCHIVE DRAWER
    // ══════════════════════════════════════════
    document.getElementById('board-view-archive-btn').addEventListener('click', () => {
        const isOpen = archiveDrawer.style.display !== 'none';
        archiveDrawer.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) archiveDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('archive-drawer-close').addEventListener('click', () => {
        archiveDrawer.style.display = 'none';
    });
    document.getElementById('archive-del-week').addEventListener('click',  () => confirmBulkDelete('week'));
    document.getElementById('archive-del-month').addEventListener('click', () => confirmBulkDelete('month'));
    document.getElementById('archive-del-all').addEventListener('click',   () => confirmBulkDelete('all'));

    function confirmBulkDelete(scope) {
        const labels = { week: 'older than 1 week', month: 'older than 1 month', all: 'ALL archives' };
        showModal(`Delete archives ${labels[scope]}?`, 'This cannot be undone.', () => bulkDeleteArchives(scope));
    }

    async function bulkDeleteArchives(scope) {
        try {
            const res = await fetch('/board/archive/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ scope }),
            });
            const data = await res.json();
            if (data.ok) {
                const r2  = await fetch('/board/data');
                const d2  = await r2.json();
                archives  = d2.archives || [];
                renderArchive();
            }
        } catch (e) { console.error('Bulk delete error:', e); }
    }

    function renderArchive() {
        archiveEl.innerHTML = '';
        if (archives.length === 0) {
            archiveEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;font-size:0.85rem;padding:1rem;">No archived weeks yet.</p>';
            return;
        }
        [...archives].reverse().forEach(week => {
            const wrap   = document.createElement('div');
            wrap.className = 'board-archive-week';
            const count  = week.tasks.length;
            const toggle = document.createElement('button');
            toggle.className = 'board-archive-toggle';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.innerHTML = `<span>📦 ${escHtml(week.week_label)}</span>
                <span style="color:var(--text-muted);font-weight:400;">${count} task${count !== 1 ? 's' : ''}</span>
                <svg class="board-archive-chevron" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
            const body = document.createElement('div');
            body.className = 'board-archive-body';
            week.tasks.forEach(t => {
                const item = Object.assign(document.createElement('div'), { className: 'board-archive-card', textContent: t.title });
                body.appendChild(item);
            });
            toggle.addEventListener('click', () => {
                const open = body.classList.toggle('open');
                toggle.setAttribute('aria-expanded', open);
            });
            wrap.appendChild(toggle);
            wrap.appendChild(body);
            archiveEl.appendChild(wrap);
        });
    }

    // ══════════════════════════════════════════
    // CALENDAR
    // ══════════════════════════════════════════
    function renderCalendar() {
        // Title is shown via the selects themselves — no separate h2 needed

        const priorityMap = {};
        tasks.forEach(t => {
            if (t.due_date && t.column !== 'done') {
                priorityMap[t.due_date] = Math.max(priorityMap[t.due_date] || 0, t.priority || 0);
            }
        });

        const firstDay    = new Date(calYear, calMonth, 1);
        const startDow    = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayStr    = toYMD(new Date());

        const _now      = new Date();
        const _dow      = (_now.getDay() + 6) % 7;
        const _curMon   = new Date(_now); _curMon.setDate(_now.getDate() - _dow); _curMon.setHours(0,0,0,0);
        const _curSun   = new Date(_curMon); _curSun.setDate(_curMon.getDate() + 6);
        const _nextMon  = new Date(_curMon); _nextMon.setDate(_curMon.getDate() + 7);
        const _nextSun  = new Date(_nextMon); _nextSun.setDate(_nextMon.getDate() + 6);

        calGrid.innerHTML = '';
        for (let i = 0; i < startDow; i++) {
            calGrid.appendChild(Object.assign(document.createElement('div'), { className: 'cal-cell cal-blank' }));
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const cell    = document.createElement('div');
            const maxPri  = priorityMap[dateStr] || 0;
            cell.className = ['cal-cell',
                maxPri === 1 ? 'cal-pri-low' : maxPri === 2 ? 'cal-pri-med' : maxPri === 3 ? 'cal-pri-high' : '',
                dateStr === todayStr       ? 'cal-today'    : '',
                dateStr === calSelectedDate? 'cal-selected' : '',
                dateStr >= toYMD(_curMon) && dateStr <= toYMD(_curSun)  ? 'cal-cur-week'  : '',
                dateStr >= toYMD(_nextMon) && dateStr <= toYMD(_nextSun) ? 'cal-next-week' : '',
            ].filter(Boolean).join(' ');
            cell.dataset.date = dateStr;
            const taskCount = tasks.filter(t => t.due_date === dateStr && t.column !== 'done').length;
            cell.innerHTML = `<span class="cal-day-num">${d}</span>${taskCount > 0 ? `<span class="cal-task-count">${taskCount}</span>` : ''}`;
            cell.addEventListener('click', () => selectCalDay(dateStr));
            calGrid.appendChild(cell);
        }
        if (calSelectedDate) renderDayPanel(calSelectedDate);
        if (calJumpMonth) calJumpMonth.value = calMonth;
        if (calJumpYear)  calJumpYear.value  = calYear;
        // Highlight Today btn only when NOT on current month
        const _tb = document.getElementById('cal-today-btn');
        if (_tb) {
            const _n = new Date();
            _tb.classList.toggle('cal-today-btn-active', !(calYear === _n.getFullYear() && calMonth === _n.getMonth()));
        }
    }

    function selectCalDay(dateStr) {
        calSelectedDate = dateStr;
        document.querySelectorAll('.cal-cell').forEach(c => c.classList.toggle('cal-selected', c.dataset.date === dateStr));
        renderDayPanel(dateStr);
        calDayPanel.style.display = 'block';
        calDayPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderDayPanel(dateStr) {
        const parts = dateStr.split('-');
        calDayTitle.textContent = new Date(+parts[0], +parts[1]-1, +parts[2])
            .toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });

        const dayTasks = tasks.filter(t => t.due_date === dateStr)
            .sort((a,b) => {
                if (a.column === 'done' && b.column !== 'done') return 1;
                if (b.column === 'done' && a.column !== 'done') return -1;
                return (b.priority||0)-(a.priority||0) || (a.due_time||'').localeCompare(b.due_time||'');
            });

        calDayTasks.innerHTML = '';
        if (dayTasks.length === 0) {
            calDayTasks.innerHTML = '<p class="cal-empty">No tasks for this day.</p>';
            return;
        }
        dayTasks.forEach(t => {
            const item = document.createElement('div');
            item.className = 'cal-task-item' + (t.column === 'done' ? ' cal-task-done' : '');
            const colLabel = { todo:'To Do', inprogress:'In Progress', done:'Done' }[t.column] || '';
            item.innerHTML = `
                <div class="cal-task-left">
                    ${PRIORITY_LABEL[t.priority||0] ? `<span>${PRIORITY_LABEL[t.priority||0]}</span>` : ''}
                    ${t.due_time ? `<span class="cal-task-time">${t.due_time}</span>` : ''}
                    <span class="cal-task-title">${escHtml(t.title)}</span>
                </div>
                <div class="cal-task-right">
                    <span class="cal-task-col-badge" data-col="${t.column}">${colLabel}</span>
                    <button class="board-card-btn delete cal-task-del" data-id="${t._id}" title="Delete">✕</button>
                </div>`;
            item.querySelector('.cal-task-del').addEventListener('click', async () => {
                await deleteTask(t._id); renderCalendar();
            });
            calDayTasks.appendChild(item);
        });
    }

    document.getElementById('cal-prev').addEventListener('click', () => {
        calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
    });

    document.getElementById('cal-jump-go').addEventListener('click', () => {
        const m = parseInt(calJumpMonth.value);
        const y = parseInt(calJumpYear.value);
        if (isNaN(m) || isNaN(y) || y < 2020 || y > 2040) {
            calJumpYear.style.borderColor = 'var(--accent-rose)';
            setTimeout(() => { calJumpYear.style.borderColor = ''; }, 800);
            return;
        }
        calMonth = m; calYear = y; renderCalendar();
    });

    // cal-jump-cancel removed (no reset button in new nav bar)

    document.getElementById('cal-today-btn').addEventListener('click', () => {
        const now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth();
        renderCalendar();
        setTimeout(() => { calGrid.querySelector('.cal-today')?.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50);
    });

    document.getElementById('cal-day-panel-close').addEventListener('click', () => {
        calDayPanel.style.display = 'none'; calSelectedDate = null;
        document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
    });

    calAddBtn.addEventListener('click', addCalTask);
    calNewTitle.addEventListener('keydown', e => { if (e.key === 'Enter') addCalTask(); });

    async function addCalTask() {
        if (!calSelectedDate) return;
        const title = calNewTitle.value.trim();
        if (!title) { calNewTitle.focus(); return; }
        calAddBtn.disabled = true; calAddBtn.textContent = '…';
        try {
            const res  = await fetch('/board/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ title, column: 'todo',
                    priority: parseInt(calNewPriority.value)||0,
                    due_date: calSelectedDate, due_time: calNewTime.value||null }),
            });
            const data = await res.json();
            if (data._id) {
                tasks.push(data);
                calNewTitle.value = ''; calNewTime.value = ''; calNewPriority.value = '0';
                renderCalendar(); renderAll();
            }
        } catch (e) { console.error('Cal add error:', e); }
        finally { calAddBtn.disabled = false; calAddBtn.textContent = '+ Add'; }
    }

    // ══════════════════════════════════════════
    // DESKTOP DRAG & DROP
    // ══════════════════════════════════════════
    function attachDropZones() {
        document.querySelectorAll('.board-cards').forEach(zone => {
            zone.addEventListener('dragover',  onDragOver);
            zone.addEventListener('dragleave', onDragLeave);
            zone.addEventListener('drop',      onDrop);
        });
    }

    function onDragStart(e) {
        dragging = this; this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.id);
        ghost = Object.assign(document.createElement('div'), { className: 'board-card-ghost' });
    }
    function onDragEnd() {
        this.classList.remove('dragging');
        ghost?.remove(); ghost = null; dragging = null;
        document.querySelectorAll('.board-cards').forEach(z => z.classList.remove('drag-over'));
    }
    function onDragOver(e) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        if (!dragging) return;
        this.classList.add('drag-over');
        const afterEl = getDragAfterElement(this, e.clientY);
        ghost?.remove();
        this.querySelector('.board-empty-hint')?.remove();
        afterEl ? this.insertBefore(ghost, afterEl) : this.appendChild(ghost);
    }
    function onDragLeave(e) {
        if (!this.contains(e.relatedTarget)) this.classList.remove('drag-over');
    }

    // ── Recur: advance due_date when a recurring task is moved to Done ──
    function advanceRecurDate(dateStr, recur) {
        if (!dateStr || !recur || recur === 'none') return null;
        const d = new Date(dateStr + 'T00:00:00');
        if (recur === 'daily')   d.setDate(d.getDate() + 1);
        if (recur === 'weekly')  d.setDate(d.getDate() + 7);
        if (recur === 'monthly') d.setMonth(d.getMonth() + 1);
        return toYMD(d);
    }

    // Move recurring task back to todo with next due date instead of staying done
    async function handleRecurOnDone(task, newCol) {
        if (newCol !== 'done' || !task.recur || task.recur === 'none') return false;
        const nextDate = advanceRecurDate(task.due_date, task.recur);
        // Reset the task to todo with the next occurrence date
        const updates = { column: 'todo', due_date: nextDate };
        task.column   = 'todo';
        task.due_date = nextDate;
        await patchTask(task._id, updates);
        return true; // handled
    }
    async function onDrop(e) {
        e.preventDefault(); if (!dragging) return;
        const taskId = e.dataTransfer.getData('text/plain');
        const col    = this.dataset.col;
        const task   = tasks.find(t => t._id === taskId);
        if (!task) return;
        const old = task.column;
        if (old === col) return;
        // Check recurring: if dropped to done, advance date and reset to todo instead
        const wasRecur = await handleRecurOnDone(task, col);
        if (!wasRecur) {
            task.column = col;
            await patchTask(taskId, { column: col });
        }
        renderAll();
        renderCalendar();
    }
    function getDragAfterElement(container, y) {
        return [...container.querySelectorAll('.board-card:not(.dragging)')]
            .reduce((closest, child) => {
                const box    = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
            }, { offset: -Infinity }).element;
    }

    // ══════════════════════════════════════════
    // TOUCH DRAG & DROP (mobile)
    // ══════════════════════════════════════════
    function attachTouchDrag() {
        document.querySelectorAll('.board-card').forEach(card => {
            card.removeEventListener('touchstart', onTouchStart);
            card.addEventListener('touchstart', onTouchStart, { passive: false });
        });
    }

    function onTouchStart(e) {
        // Only start drag on the handle or if the press is > 200ms (long-press)
        const handle = e.target.closest('.board-card-drag-handle');
        if (!handle) {
            // Long-press detection
            const card = this;
            card._pressTimer = setTimeout(() => startTouchDrag(e, card), 300);
            card.addEventListener('touchend',  () => clearTimeout(card._pressTimer), { once: true });
            card.addEventListener('touchmove', () => clearTimeout(card._pressTimer), { once: true });
            return;
        }
        e.preventDefault();
        startTouchDrag(e, this);
    }

    function startTouchDrag(e, card) {
        if (touchDragging) return;
        touchDragging  = card;
        touchOriginCol = card.dataset.col;

        const touch    = e.touches[0];
        const rect     = card.getBoundingClientRect();

        // Create floating clone
        touchClone = card.cloneNode(true);
        touchClone.style.cssText = `
            position:fixed; left:${rect.left}px; top:${rect.top}px;
            width:${rect.width}px; opacity:0.85; z-index:9000;
            pointer-events:none; border-radius:0.5rem;
            box-shadow:0 8px 24px rgba(0,0,0,0.35);
            transition: none;
        `;
        document.body.appendChild(touchClone);
        card.style.opacity = '0.3';

        document.addEventListener('touchmove',  onTouchMove,  { passive: false });
        document.addEventListener('touchend',   onTouchEnd,   { once: true });
        document.addEventListener('touchcancel',onTouchCancel,{ once: true });
    }

    function onTouchMove(e) {
        if (!touchDragging) return;
        e.preventDefault();
        const touch = e.touches[0];

        touchClone.style.left = (touch.clientX - touchClone.offsetWidth  / 2) + 'px';
        touchClone.style.top  = (touch.clientY - touchClone.offsetHeight / 2) + 'px';

        // Find drop target
        touchClone.style.display = 'none';
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        touchClone.style.display = '';

        const zone = el?.closest('.board-cards');
        if (zone && zone !== touchLastTarget) {
            document.querySelectorAll('.board-cards').forEach(z => z.classList.remove('drag-over'));
            zone.classList.add('drag-over');
            touchLastTarget = zone;
        }
    }

    async function onTouchEnd(e) {
        if (!touchDragging) return;
        document.removeEventListener('touchmove', onTouchMove);

        const touch = e.changedTouches[0];
        touchClone.style.display = 'none';
        const el   = document.elementFromPoint(touch.clientX, touch.clientY);
        touchClone.style.display = '';

        const zone    = el?.closest('.board-cards');
        const newCol  = zone?.dataset.col;
        const task    = tasks.find(t => t._id === touchDragging.dataset.id);

        if (task && newCol && newCol !== touchOriginCol) {
            // Check recurring: if dragged to done, advance date and reset to todo
            const wasRecur = await handleRecurOnDone(task, newCol);
            if (!wasRecur) {
                task.column = newCol;
                await patchTask(task._id, { column: newCol });
            }
            renderAll();
            renderCalendar();
        } else {
            touchDragging.style.opacity = '1';
        }

        touchCleanup();
    }

    function onTouchCancel() {
        if (touchDragging) touchDragging.style.opacity = '1';
        touchCleanup();
    }

    function touchCleanup() {
        touchClone?.remove(); touchClone = null;
        touchDragging = null; touchOriginCol = null; touchLastTarget = null;
        document.querySelectorAll('.board-cards').forEach(z => z.classList.remove('drag-over'));
        document.removeEventListener('touchmove',   onTouchMove);
    }

    // ══════════════════════════════════════════
    // ADD / PATCH / DELETE
    // ══════════════════════════════════════════
    addBtn.addEventListener('click', addTask);
    newTitle.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

    async function addTask() {
        const title = newTitle.value.trim();
        if (!title) {
            newTitle.focus();
            newTitle.style.borderColor = 'var(--accent-rose)';
            setTimeout(() => { newTitle.style.borderColor = ''; }, 800);
            return;
        }
        addBtn.disabled = true; addBtn.textContent = '…';
        try {
            const res  = await fetch('/board/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({
                    title, column: newCol.value,
                    priority: parseInt(newPri.value)||0,
                    due_date: newDue.value||null, due_time: newTime.value||null,
                    recur:    newRecur.value,
                }),
            });
            const data = await res.json();
            if (data._id) {
                tasks.push(data);
                newTitle.value = ''; newDue.value = ''; newTime.value = '';
                newPri.value = '0'; newRecur.value = 'none';
                renderAll();
            }
        } catch (e) { console.error('Add task error:', e); }
        finally { addBtn.disabled = false; addBtn.textContent = '+ Add'; }
    }

    async function patchTask(taskId, updates) {
        try {
            await fetch(`/board/task/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify(updates),
            });
        } catch (e) { console.error('Patch error:', e); }
    }

    async function deleteTask(taskId) {
        try {
            await fetch(`/board/task/${taskId}`, {
                method: 'DELETE', headers: { 'X-CSRFToken': getCsrf() },
            });
            tasks = tasks.filter(t => t._id !== taskId);
            renderAll(); renderCalendar();
        } catch (e) { console.error('Delete error:', e); }
    }

    async function manualArchiveTask(task) {
        try {
            const res  = await fetch(`/board/task/${task._id}/archive`, {
                method: 'POST', headers: { 'X-CSRFToken': getCsrf() },
            });
            const data = await res.json();
            if (data.ok) {
                tasks = tasks.filter(t => t._id !== task._id);
                const r2 = await fetch('/board/data');
                const d2 = await r2.json();
                archives = d2.archives || [];
                renderAll(); renderCalendar();
            }
        } catch (e) { console.error('Archive error:', e); }
    }

    // ══════════════════════════════════════════
    // CUSTOM MODAL
    // ══════════════════════════════════════════
    function showModal(title, body, onConfirm) {
        document.getElementById('in-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'in-modal';
        overlay.className = 'in-modal-overlay';
        overlay.innerHTML = `<div class="in-modal-box">
            <p class="in-modal-title">${escHtml(title)}</p>
            ${body ? `<p class="in-modal-body">${escHtml(body)}</p>` : ''}
            <div class="in-modal-actions">
                <button class="in-modal-cancel">Cancel</button>
                <button class="in-modal-confirm">Delete</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.in-modal-cancel').addEventListener('click', close);
        overlay.querySelector('.in-modal-confirm').addEventListener('click', () => { close(); onConfirm(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }

    // ── Helpers ──
    function toYMD(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    function getCsrf() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }
    function escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Init ──
    loadBoard();

    // ── Injected confirm-pill styles ──
    const style = document.createElement('style');
    style.textContent = `
        .board-delete-confirm {
            display:flex; align-items:center; gap:0.25rem;
            position:absolute; right:0.4rem; bottom:0.4rem;
            background:var(--bg-card); border:1.5px solid var(--border);
            border-radius:0.5rem; padding:0.25rem 0.4rem;
            box-shadow:var(--shadow-md); animation:pop-in 0.12s ease; z-index:10;
        }
        @keyframes pop-in { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        .confirm-yes { color:#22c55e !important; }
        .confirm-yes:hover { background:rgba(34,197,94,0.1) !important; }
        .confirm-no  { color:var(--accent-rose) !important; }
    `;
    document.head.appendChild(style);
});