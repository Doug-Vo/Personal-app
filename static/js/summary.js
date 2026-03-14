/* ══════════════════════════════════════════
   Summary page — summary.js
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {

    const layout = document.getElementById('summary-layout');

    const MOOD_COLORS = {
        Excited: '#f59e0b', Happy: '#22c55e', Calm: '#38bdf8', Neutral: '#a78bfa',
        Tired: '#94a3b8', Anxious: '#fb923c', Sad: '#818cf8', Frustrated: '#f87171'
    };
    const MOOD_ORDER = ['Excited','Happy','Calm','Neutral','Tired','Anxious','Sad','Frustrated'];

    let tooltip = null;

    try {
        const res  = await fetch('/summary/data');
        const data = await res.json();
        render(data);
    } catch (e) {
        layout.innerHTML = '<p style="color:var(--accent-rose);text-align:center;padding:3rem;">Could not load summary data.</p>';
    }

    function render(data) {
        const tc = data.task_cols     || {};
        const tp = data.task_priority || {};
        const mc = data.mood_counts   || {};

        const todo       = tc.todo       || 0;
        const inprogress = tc.inprogress || 0;
        const done       = tc.done       || 0;
        const total      = todo + inprogress + done;
        const archived   = data.archived_total || 0;
        const priTotal   = Object.values(tp).reduce((a, b) => a + b, 0);
        const moodTotal  = Object.values(mc).reduce((a, b) => a + b, 0);

        // Dominant mood
        let domMood = null, domCount = 0;
        Object.entries(mc).forEach(([m, c]) => { if (c > domCount) { domMood = m; domCount = c; } });

        layout.innerHTML = `
        <div class="ssum-grid">

            <!-- Task Status Donut -->
            <div class="ssum-card">
                <div class="ssum-card-title">Tasks Overview</div>
                <div class="ssum-donut-wrap">
                    <canvas id="donut-status" width="200" height="200"></canvas>
                    <div class="ssum-donut-center">
                        <span class="ssum-big-num">${total}</span>
                        <span class="ssum-big-label">active</span>
                    </div>
                </div>
                <div class="ssum-legend">
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#a78bfa"></span><span>To Do</span><b>${todo}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#f59e0b"></span><span>In Progress</span><b>${inprogress}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#22c55e"></span><span>Done</span><b>${done}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#94a3b8"></span><span>Archived</span><b>${archived}</b></div>
                </div>
            </div>

            <!-- Priority Donut (active only) -->
            <div class="ssum-card">
                <div class="ssum-card-title">By Priority <span class="ssum-subtitle">(active tasks)</span></div>
                <div class="ssum-donut-wrap">
                    <canvas id="donut-priority" width="200" height="200"></canvas>
                    <div class="ssum-donut-center">
                        <span class="ssum-big-num">${priTotal}</span>
                        <span class="ssum-big-label">active</span>
                    </div>
                </div>
                <div class="ssum-legend">
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#f87171"></span><span>High</span><b>${tp['3']||0}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#f59e0b"></span><span>Medium</span><b>${tp['2']||0}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#22c55e"></span><span>Low</span><b>${tp['1']||0}</b></div>
                    <div class="ssum-legend-row"><span class="ssum-dot" style="background:#6b7280"></span><span>None</span><b>${tp['0']||0}</b></div>
                </div>
            </div>

            <!-- Mood: 70% bars + 30% piglet emotion -->
            <div class="ssum-card ssum-card-mood">
                <div class="ssum-card-title">
                    Mood This Month — ${escHtml(data.month||'')}
                    ${data.avg_mood ? `<span class="ssum-avg-pill">avg ${data.avg_mood}/7</span>` : ''}
                </div>
                <div class="ssum-mood-body">
                    <div class="ssum-mood-bars">
                        ${moodTotal === 0
                            ? `<a href="/journal" class="ssum-no-mood-link">No journal entries yet this month. Start writing →</a>`
                            : MOOD_ORDER.filter(m => mc[m]).map(m => {
                                const pct = Math.round((mc[m] / moodTotal) * 100);
                                return `<div class="ssum-mood-row">
                                    <span class="ssum-mood-lbl">${m}</span>
                                    <div class="ssum-mood-track">
                                        <div class="ssum-mood-fill" style="width:${pct}%;background:${MOOD_COLORS[m]||'#888'}"></div>
                                    </div>
                                    <a href="/journal?tab=chart" class="ssum-mood-count" title="View ${m} entries">${mc[m]}×</a>
                                </div>`;
                            }).join('')
                        }
                    </div>
                    <!-- Piglet emotion zone: cloned from the pre-rendered hidden SVGs -->
                    <div class="ssum-mood-emoji-zone" id="ssum-mood-piglet-zone">
                        <span class="ssum-mood-label-big" id="ssum-mood-label">${domMood || ''}</span>
                        ${moodTotal > 0 ? `<a href="/journal?tab=chart" class="ssum-journal-link">View feelings →</a>` : ''}
                    </div>
                </div>
            </div>

        </div>`;

        // Inject the piglet emotion SVG into the zone
        if (domMood) {
            const src = document.getElementById(`mood-piglet-${domMood}`);
            const zone = document.getElementById('ssum-mood-piglet-zone');
            if (src && zone) {
                // Clone the SVG from the hidden pre-rendered block and inject before the label
                const clone = src.cloneNode(true);
                clone.id = '';
                clone.style.display = '';
                clone.className = 'ssum-mood-piglet-clone';
                zone.insertBefore(clone, zone.firstChild);
            }
        }

        drawDonut('donut-status',
            [todo, inprogress, done],
            ['#a78bfa','#f59e0b','#22c55e'],
            ['To Do','In Progress','Done']
        );
        drawDonut('donut-priority',
            [tp['3']||0, tp['2']||0, tp['1']||0, tp['0']||0],
            ['#f87171','#f59e0b','#22c55e','#6b7280'],
            ['High','Medium','Low','None']
        );
    }

    function drawDonut(canvasId, values, colors, labels) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx   = canvas.getContext('2d');
        const cx    = canvas.width  / 2;
        const cy    = canvas.height / 2;
        const r     = 82, inner = 50;
        const total = values.reduce((a,b) => a+b, 0);
        const slices = [];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (total === 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI*2);
            ctx.arc(cx, cy, inner, 0, Math.PI*2, true);
            ctx.fillStyle = 'rgba(120,120,120,0.12)';
            ctx.fill('evenodd');
            return;
        }

        let start = -Math.PI / 2;
        values.forEach((v, i) => {
            if (v === 0) return;
            const sweep = (v / total) * Math.PI * 2;
            slices.push({ start, sweep, color: colors[i], label: labels[i], count: v });
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, start + sweep);
            ctx.arc(cx, cy, inner, start + sweep, start, true);
            ctx.closePath();
            ctx.fillStyle = colors[i];
            ctx.fill();
            start += sweep;
        });

        // Inner hole
        ctx.beginPath();
        ctx.arc(cx, cy, inner - 1, 0, Math.PI * 2);
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#192016' : '#ffffff';
        ctx.fill();

        // Hover tooltip
        function ensureTip() {
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.className = 'donut-tooltip';
                document.body.appendChild(tooltip);
            }
        }
        function getSlice(mx, my) {
            const dx = mx - cx, dy = my - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < inner || dist > r) return null;
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI/2) angle += Math.PI * 2;
            return slices.find(s => {
                let end = s.start + s.sweep, st = s.start;
                if (st < -Math.PI/2) { st += Math.PI*2; end += Math.PI*2; }
                return angle >= st && angle < end;
            }) || null;
        }
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
            const slice = getSlice((e.clientX - rect.left)*sx, (e.clientY - rect.top)*sy);
            if (slice) {
                ensureTip();
                const pct = Math.round((slice.count / total) * 100);
                tooltip.innerHTML = `<strong>${slice.label}</strong>: ${slice.count} task${slice.count!==1?'s':''} (${pct}%)`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 12) + 'px';
                tooltip.style.top  = (e.clientY - 32) + 'px';
                canvas.style.cursor = 'pointer';
            } else {
                if (tooltip) tooltip.style.display = 'none';
                canvas.style.cursor = 'default';
            }
        });
        canvas.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
            canvas.style.cursor = 'default';
        });
    }

    function escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
});