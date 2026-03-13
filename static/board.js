/* ══════════════════════════════════════════
   Ỉn's Planner — board.js
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── State ──
    let tasks    = [];
    let archives = [];
    let dragging = null;
    let ghost    = null;

    // Calendar state
    let calYear  = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    let calSelectedDate = null;

    const COLS = ['todo', 'inprogress', 'done'];
    const PRIORITY_LABEL = { 0: '', 1: '🟢', 2: '🟡', 3: '🔴' };
    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];

    // ── DOM refs ──
    const addBtn    = document.getElementById('board-add-btn');
    const newTitle  = document.getElementById('board-new-title');
    const newCol    = document.getElementById('board-new-col');
    const newPri    = document.getElementById('board-new-priority');
    const newDue    = document.getElementById('board-new-due');
    const newTime   = document.getElementById('board-new-time');
    const weekDates = document.getElementById('board-week-dates');
    const archiveEl = document.getElementById('board-archive');
    const archiveDrawer = document.getElementById('board-archive-drawer');

    const calGrid        = document.getElementById('cal-grid');
    const calMonthTitle  = document.getElementById('cal-month-title');
    const calDayPanel    = document.getElementById('cal-day-panel');
    const calDayTitle    = document.getElementById('cal-day-panel-title');
    const calDayTasks    = document.getElementById('cal-day-tasks');
    const calAddBtn      = document.getElementById('cal-add-btn');
    const calNewTitle    = document.getElementById('cal-new-title');
    const calNewTime     = document.getElementById('cal-new-time');
    const calNewPriority = document.getElementById('cal-new-priority');
    const calJumpBar     = document.getElementById('cal-jump-bar');
    const calJumpMonth   = document.getElementById('cal-jump-month');
    const calJumpYear    = document.getElementById('cal-jump-year');

    // ── Tab switching ──
    document.querySelectorAll('.board-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.board-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.board-tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'calendar') renderCalendar();
            if (btn.dataset.tab === 'board') renderAll();
        });
    });

    // ── Week banner ──
    function getWeekRange() {
        const now = new Date();
        const day = now.getDay();
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((day + 6) % 7));
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const fmt = d => d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        return `${fmt(mon)} – ${fmt(sun)}`;
    }
    weekDates.textContent = getWeekRange();

    // ── Fetch all tasks + archives ──
    async function loadBoard() {
        try {
            const res  = await fetch('/board/data');
            const data = await res.json();
            tasks    = data.tasks    || [];
            archives = data.archives || [];
            renderAll();
        } catch (e) {
            console.error('Board load error:', e);
        }
    }

    // ── Render everything ──
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
            if (colTasks.length === 0) {
                container.innerHTML = `<div class="board-empty-hint">Drop tasks here</div>`;
            } else {
                colTasks.forEach(t => container.appendChild(makeCard(t)));
            }
            document.getElementById(`count-${col}`).textContent = colTasks.length;
        });
        renderArchive();
        attachDropZones();
    }

    // ── Build a task card ──
    function makeCard(task) {
        const card = document.createElement('div');
        card.className   = 'board-card';
        card.draggable   = true;
        card.dataset.id  = task._id;
        card.dataset.col = task.column;

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

        const priEmoji = PRIORITY_LABEL[task.priority || 0];

        card.innerHTML = `
            <span class="board-card-drag-handle" title="Drag">⠿</span>
            <div class="board-card-body">
                <div class="board-card-title" data-id="${task._id}">${escHtml(task.title)}</div>
                <div class="board-card-meta-row">
                    ${priEmoji ? `<span class="board-card-priority">${priEmoji}</span>` : ''}
                    ${dueBadge}
                    ${created && !task.due_date ? `<span class="board-card-added">Added ${created}</span>` : ''}
                </div>
            </div>
            <div class="board-card-actions">
                <button class="board-card-btn edit"    title="Edit"    data-id="${task._id}">✏️</button>
                <button class="board-card-btn archive-btn" title="Archive" data-id="${task._id}">📦</button>
                <button class="board-card-btn delete"  title="Delete"  data-id="${task._id}">✕</button>
            </div>
        `;

        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragend',   onDragEnd);
        card.querySelector('.board-card-btn.edit').addEventListener('click', () => startInlineEdit(card, task));
        card.querySelector('.board-card-btn.archive-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmArchive(card, task);
        });
        card.querySelector('.board-card-btn.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete(card, task._id);
        });

        return card;
    }

    // ── Inline edit ──
    function startInlineEdit(card, task) {
        const titleEl = card.querySelector('.board-card-title');
        titleEl.contentEditable = 'true';
        titleEl.focus();
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        range.collapse(false);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        function save() {
            titleEl.contentEditable = 'false';
            const newText = titleEl.textContent.trim();
            if (newText && newText !== task.title) {
                task.title = newText;
                patchTask(task._id, { title: newText });
            } else {
                titleEl.textContent = task.title;
            }
        }
        titleEl.addEventListener('blur', save, { once: true });
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
            if (e.key === 'Escape') { titleEl.textContent = task.title; titleEl.contentEditable = 'false'; }
        });
    }

    // ── Inline archive confirm ──
    function confirmArchive(card, task) {
        if (card.querySelector('.board-action-confirm')) return;
        const pill = document.createElement('div');
        pill.className = 'board-delete-confirm board-action-confirm';
        pill.innerHTML = `
            <span style="font-size:0.78rem;color:var(--text-muted);">Archive?</span>
            <button class="board-card-btn confirm-yes">✓</button>
            <button class="board-card-btn confirm-no">✕</button>
        `;
        card.appendChild(pill);
        pill.querySelector('.confirm-yes').addEventListener('click', async () => {
            card.style.opacity = '0.4';
            await manualArchiveTask(task);
        });
        pill.querySelector('.confirm-no').addEventListener('click', () => pill.remove());
        setTimeout(() => {
            document.addEventListener('click', () => pill.remove(), { once: true });
        }, 0);
    }

    // ── Manual archive a task ──
    async function manualArchiveTask(task) {
        try {
            const res = await fetch(`/board/task/${task._id}/archive`, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCsrf() },
            });
            const data = await res.json();
            if (data.ok) {
                tasks = tasks.filter(t => t._id !== task._id);
                // Reload archives from server so we get the updated list
                const r2   = await fetch('/board/data');
                const d2   = await r2.json();
                archives   = d2.archives || [];
                renderAll();
                renderCalendar();
            }
        } catch (e) {
            console.error('Archive error:', e);
        }
    }

    // ── Inline delete confirm ──
    function confirmDelete(card, taskId) {
        if (card.querySelector('.board-action-confirm')) return;
        const pill = document.createElement('div');
        pill.className = 'board-delete-confirm board-action-confirm';
        pill.innerHTML = `
            <span style="font-size:0.78rem;color:var(--text-muted);">Delete?</span>
            <button class="board-card-btn confirm-yes">✓</button>
            <button class="board-card-btn confirm-no">✕</button>
        `;
        card.appendChild(pill);
        pill.querySelector('.confirm-yes').addEventListener('click', async () => {
            card.style.opacity = '0.4';
            await deleteTask(taskId);
        });
        pill.querySelector('.confirm-no').addEventListener('click', () => pill.remove());
        setTimeout(() => {
            document.addEventListener('click', () => pill.remove(), { once: true });
        }, 0);
    }

    // ── Archive drawer ──
    document.getElementById('board-view-archive-btn').addEventListener('click', () => {
        const isOpen = archiveDrawer.style.display !== 'none';
        archiveDrawer.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) archiveDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.getElementById('archive-drawer-close').addEventListener('click', () => {
        archiveDrawer.style.display = 'none';
    });

    // ── Archive bulk delete buttons ──
    document.getElementById('archive-del-week').addEventListener('click', () => {
        confirmBulkDelete('week');
    });
    document.getElementById('archive-del-month').addEventListener('click', () => {
        confirmBulkDelete('month');
    });
    document.getElementById('archive-del-all').addEventListener('click', () => {
        confirmBulkDelete('all');
    });

    function confirmBulkDelete(scope) {
        const labels = { week: 'older than 1 week', month: 'older than 1 month', all: 'ALL archives' };
        showModal(
            `Delete archives ${labels[scope]}?`,
            'This cannot be undone.',
            () => bulkDeleteArchives(scope)
        );
    }

    async function bulkDeleteArchives(scope) {
        try {
            const res = await fetch(`/board/archive/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({ scope }),
            });
            const data = await res.json();
            if (data.ok) {
                archives = [];
                const r2  = await fetch('/board/data');
                const d2  = await r2.json();
                archives  = d2.archives || [];
                renderArchive();
            }
        } catch (e) {
            console.error('Bulk delete error:', e);
        }
    }

    // ── Render archived weeks ──
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
            toggle.innerHTML = `
                <span>📦 ${escHtml(week.week_label)}</span>
                <span style="color:var(--text-muted);font-weight:400;">${count} task${count !== 1 ? 's' : ''} completed</span>
                <svg class="board-archive-chevron" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            `;
            const body = document.createElement('div');
            body.className = 'board-archive-body';
            week.tasks.forEach(t => {
                const item = document.createElement('div');
                item.className   = 'board-archive-card';
                item.textContent = t.title;
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
        calMonthTitle.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

        const priorityMap = {};
        tasks.forEach(t => {
            if (t.due_date && t.column !== 'done') {
                const p = t.priority || 0;
                priorityMap[t.due_date] = Math.max(priorityMap[t.due_date] || 0, p);
            }
        });

        const firstDay    = new Date(calYear, calMonth, 1);
        const startDow    = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const todayStr    = toYMD(new Date());

        // Current + next week ranges
        const _now      = new Date();
        const _dow      = (_now.getDay() + 6) % 7;
        const _curMon   = new Date(_now); _curMon.setDate(_now.getDate() - _dow); _curMon.setHours(0,0,0,0);
        const _curSun   = new Date(_curMon); _curSun.setDate(_curMon.getDate() + 6); _curSun.setHours(23,59,59,999);
        const _nextMon  = new Date(_curMon); _nextMon.setDate(_curMon.getDate() + 7);
        const _nextSun  = new Date(_nextMon); _nextSun.setDate(_nextMon.getDate() + 6); _nextSun.setHours(23,59,59,999);
        const _curMonStr  = toYMD(_curMon);
        const _curSunStr  = toYMD(_curSun);
        const _nextMonStr = toYMD(_nextMon);
        const _nextSunStr = toYMD(_nextSun);

        calGrid.innerHTML = '';

        for (let i = 0; i < startDow; i++) {
            const blank = document.createElement('div');
            blank.className = 'cal-cell cal-blank';
            calGrid.appendChild(blank);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const cell    = document.createElement('div');

            const maxPri = priorityMap[dateStr] || 0;
            let priClass = '';
            if (maxPri === 1) priClass = 'cal-pri-low';
            if (maxPri === 2) priClass = 'cal-pri-med';
            if (maxPri === 3) priClass = 'cal-pri-high';

            const isSelected = dateStr === calSelectedDate;
            const isToday    = dateStr === todayStr;
            const isCurWeek  = dateStr >= _curMonStr && dateStr <= _curSunStr;
            const isNextWeek = dateStr >= _nextMonStr && dateStr <= _nextSunStr;

            cell.className = [
                'cal-cell', priClass,
                isToday    ? 'cal-today'    : '',
                isSelected ? 'cal-selected' : '',
                isCurWeek  ? 'cal-cur-week' : '',
                isNextWeek ? 'cal-next-week': '',
            ].filter(Boolean).join(' ');
            cell.dataset.date = dateStr;

            const taskCount = tasks.filter(t => t.due_date === dateStr && t.column !== 'done').length;
            cell.innerHTML = `
                <span class="cal-day-num">${d}</span>
                ${taskCount > 0 ? `<span class="cal-task-count">${taskCount}</span>` : ''}
            `;
            cell.addEventListener('click', () => selectCalDay(dateStr));
            calGrid.appendChild(cell);
        }

        if (calSelectedDate) renderDayPanel(calSelectedDate);
    }

    function selectCalDay(dateStr) {
        calSelectedDate = dateStr;
        document.querySelectorAll('.cal-cell').forEach(c => {
            c.classList.toggle('cal-selected', c.dataset.date === dateStr);
        });
        renderDayPanel(dateStr);
        calDayPanel.style.display = 'block';
        calDayPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderDayPanel(dateStr) {
        const parts = dateStr.split('-');
        const label = new Date(+parts[0], +parts[1]-1, +parts[2])
            .toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });
        calDayTitle.textContent = label;

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
            const item     = document.createElement('div');
            item.className = 'cal-task-item' + (t.column === 'done' ? ' cal-task-done' : '');
            const priEmoji = PRIORITY_LABEL[t.priority || 0];
            const timeStr  = t.due_time ? `<span class="cal-task-time">${t.due_time}</span>` : '';
            const colLabel = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' }[t.column] || '';
            item.innerHTML = `
                <div class="cal-task-left">
                    ${priEmoji ? `<span>${priEmoji}</span>` : ''}
                    ${timeStr}
                    <span class="cal-task-title">${escHtml(t.title)}</span>
                </div>
                <div class="cal-task-right">
                    <span class="cal-task-col-badge" data-col="${t.column}">${colLabel}</span>
                    <button class="board-card-btn delete cal-task-del" data-id="${t._id}" title="Delete">✕</button>
                </div>
            `;
            item.querySelector('.cal-task-del').addEventListener('click', async () => {
                await deleteTask(t._id);
                renderCalendar();
            });
            calDayTasks.appendChild(item);
        });
    }

    // Calendar month nav
    document.getElementById('cal-prev').addEventListener('click', () => {
        calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
    });

    // Jump to month
    calMonthTitle.style.cursor = 'pointer';
    calMonthTitle.addEventListener('click', () => {
        const visible = calJumpBar.style.display !== 'none';
        calJumpBar.style.display = visible ? 'none' : 'flex';
        if (!visible) {
            calJumpMonth.value = calMonth;
            calJumpYear.value  = calYear;
        }
    });
    document.getElementById('cal-jump-go').addEventListener('click', () => {
        const m = parseInt(calJumpMonth.value);
        const y = parseInt(calJumpYear.value);
        if (!isNaN(m) && !isNaN(y) && y >= 2020 && y <= 2040) {
            calMonth = m;
            calYear  = y;
            calJumpBar.style.display = 'none';
            renderCalendar();
        }
    });
    document.getElementById('cal-jump-cancel').addEventListener('click', () => {
        calJumpBar.style.display = 'none';
    });

    // Return to current month
    document.getElementById('cal-today-btn').addEventListener('click', () => {
        const now = new Date();
        calYear   = now.getFullYear();
        calMonth  = now.getMonth();
        calJumpBar.style.display = 'none';
        renderCalendar();
        // Scroll to today cell if visible
        setTimeout(() => {
            const todayCell = calGrid.querySelector('.cal-today');
            if (todayCell) todayCell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    });

    // Close day panel
    document.getElementById('cal-day-panel-close').addEventListener('click', () => {
        calDayPanel.style.display = 'none';
        calSelectedDate = null;
        document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
    });

    // Calendar quick-add
    calAddBtn.addEventListener('click', addCalTask);
    calNewTitle.addEventListener('keydown', e => { if (e.key === 'Enter') addCalTask(); });

    async function addCalTask() {
        if (!calSelectedDate) return;
        const title = calNewTitle.value.trim();
        if (!title) { calNewTitle.focus(); return; }
        calAddBtn.disabled    = true;
        calAddBtn.textContent = '…';
        try {
            const res  = await fetch('/board/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({
                    title, column: 'todo',
                    priority: parseInt(calNewPriority.value) || 0,
                    due_date: calSelectedDate,
                    due_time: calNewTime.value || null,
                }),
            });
            const data = await res.json();
            if (data._id) {
                tasks.push(data);
                calNewTitle.value    = '';
                calNewTime.value     = '';
                calNewPriority.value = '0';
                renderCalendar();
                renderAll();
            }
        } catch (e) {
            console.error('Cal add error:', e);
        } finally {
            calAddBtn.disabled    = false;
            calAddBtn.textContent = '+ Add';
        }
    }

    // ── Drop zones ──
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
        ghost = document.createElement('div');
        ghost.className = 'board-card-ghost';
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
        const hint = this.querySelector('.board-empty-hint');
        if (hint) hint.remove();
        if (afterEl) this.insertBefore(ghost, afterEl);
        else this.appendChild(ghost);
    }

    function onDragLeave(e) {
        if (!this.contains(e.relatedTarget)) this.classList.remove('drag-over');
    }

    async function onDrop(e) {
        e.preventDefault();
        if (!dragging) return;
        const taskId = e.dataTransfer.getData('text/plain');
        const newCol = this.dataset.col;
        const task   = tasks.find(t => t._id === taskId);
        if (!task) return;
        const oldCol = task.column;
        task.column  = newCol;
        renderAll();
        if (oldCol !== newCol) {
            await patchTask(taskId, { column: newCol });
            renderCalendar();
        }
    }

    function getDragAfterElement(container, y) {
        return [...container.querySelectorAll('.board-card:not(.dragging)')]
            .reduce((closest, child) => {
                const box    = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
            }, { offset: -Infinity }).element;
    }

    // ── Add task from board ──
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
        addBtn.disabled    = true;
        addBtn.textContent = '…';
        try {
            const res  = await fetch('/board/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify({
                    title, column: newCol.value,
                    priority: parseInt(newPri.value) || 0,
                    due_date: newDue.value || null,
                    due_time: newTime.value || null,
                }),
            });
            const data = await res.json();
            if (data._id) {
                tasks.push(data);
                newTitle.value = ''; newDue.value = ''; newTime.value = ''; newPri.value = '0';
                renderAll();
            }
        } catch (e) {
            console.error('Add task error:', e);
        } finally {
            addBtn.disabled    = false;
            addBtn.textContent = '+ Add';
        }
    }

    // ── PATCH task ──
    async function patchTask(taskId, updates) {
        try {
            await fetch(`/board/task/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
                body: JSON.stringify(updates),
            });
        } catch (e) { console.error('Patch error:', e); }
    }

    // ── DELETE task ──
    async function deleteTask(taskId) {
        try {
            await fetch(`/board/task/${taskId}`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCsrf() },
            });
            tasks = tasks.filter(t => t._id !== taskId);
            renderAll();
            renderCalendar();
        } catch (e) { console.error('Delete error:', e); }
    }

    // ── Custom modal (replaces native confirm()) ──
    function showModal(title, body, onConfirm) {
        // Remove any existing modal
        document.getElementById('in-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'in-modal';
        overlay.className = 'in-modal-overlay';
        overlay.innerHTML = `
            <div class="in-modal-box">
                <p class="in-modal-title">${escHtml(title)}</p>
                ${body ? `<p class="in-modal-body">${escHtml(body)}</p>` : ''}
                <div class="in-modal-actions">
                    <button class="in-modal-cancel">Cancel</button>
                    <button class="in-modal-confirm">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('.in-modal-cancel').addEventListener('click', close);
        overlay.querySelector('.in-modal-confirm').addEventListener('click', () => {
            close();
            onConfirm();
        });
        // Click outside to cancel
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

    // ── Injected styles ──
    const style = document.createElement('style');
    style.textContent = `
        .board-delete-confirm {
            display: flex; align-items: center; gap: 0.25rem;
            position: absolute; right: 0.4rem; bottom: 0.4rem;
            background: var(--bg-card); border: 1.5px solid var(--border);
            border-radius: 0.5rem; padding: 0.25rem 0.4rem;
            box-shadow: var(--shadow-md); animation: pop-in 0.12s ease; z-index: 10;
        }
        @keyframes pop-in { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
        .confirm-yes { color: #22c55e !important; }
        .confirm-yes:hover { background: rgba(34,197,94,0.1) !important; }
        .confirm-no  { color: var(--accent-rose) !important; }
    `;
    document.head.appendChild(style);

});