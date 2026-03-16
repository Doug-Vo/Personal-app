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

    // Track all live donut instances so theme changes can redraw them all
    const liveCharts = [];

    // Watch for theme changes (class toggle on <html>) and redraw all charts
    const themeObserver = new MutationObserver(() => {
        liveCharts.forEach(chart => chart.redraw());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

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

        let domMood = null, domCount = 0;
        Object.entries(mc).forEach(([m, c]) => { if (c > domCount) { domMood = m; domCount = c; } });

        layout.innerHTML = `
        <div class="ssum-grid">

            <div class="ssum-card">
                <div class="ssum-card-title">Tasks Overview</div>
                <div class="ssum-donut-wrap">
                    <canvas id="donut-status" width="220" height="220"></canvas>
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

            <div class="ssum-card">
                <div class="ssum-card-title">By Priority <span class="ssum-subtitle">(active tasks)</span></div>
                <div class="ssum-donut-wrap">
                    <canvas id="donut-priority" width="220" height="220"></canvas>
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
                    <div class="ssum-mood-emoji-zone" id="ssum-mood-piglet-zone">
                        <span class="ssum-mood-label-big" id="ssum-mood-label">${domMood || ''}</span>
                        ${moodTotal > 0 ? `<a href="/journal?tab=chart" class="ssum-journal-link">View feelings →</a>` : ''}
                    </div>
                </div>
            </div>

        </div>`;

        // Inject piglet emotion SVG
        if (domMood) {
            const src  = document.getElementById(`mood-piglet-${domMood}`);
            const zone = document.getElementById('ssum-mood-piglet-zone');
            if (src && zone) {
                const clone = src.cloneNode(true);
                clone.id = '';
                clone.style.display = '';
                clone.className = 'ssum-mood-piglet-clone';
                zone.insertBefore(clone, zone.firstChild);
            }
        }

        // Draw both charts and register them for theme-aware redraws
        const c1 = makeDonut('donut-status',
            [todo, inprogress, done],
            ['#a78bfa','#f59e0b','#22c55e'],
            ['To Do','In Progress','Done']
        );
        const c2 = makeDonut('donut-priority',
            [tp['3']||0, tp['2']||0, tp['1']||0, tp['0']||0],
            ['#f87171','#f59e0b','#22c55e','#6b7280'],
            ['High','Medium','Low','None']
        );
        if (c1) liveCharts.push(c1);
        if (c2) liveCharts.push(c2);
    }

    /* ════════════════════════════════════════
       EXPLODED DONUT — with hover glow + theme fix
       ════════════════════════════════════════ */
    function makeDonut(canvasId, values, colors, labels) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const ctx    = canvas.getContext('2d');
        const W      = canvas.width;
        const H      = canvas.height;
        const cx     = W / 2;
        const cy     = H / 2;
        const R      = 82;         // outer radius
        const INNER  = 48;         // inner hole radius
        const EXPLODE= 10;         // how far a hovered slice pops out
        const GAP    = 0.018;      // radians gap between slices

        const total = values.reduce((a, b) => a + b, 0);
        if (total === 0) {
            drawEmpty();
            return { redraw: drawEmpty };
        }

        // Build slice metadata
        const slices = [];
        let start = -Math.PI / 2;
        values.forEach((v, i) => {
            if (v === 0) return;
            const sweep = (v / total) * Math.PI * 2 - GAP;
            const mid   = start + sweep / 2;            // midpoint angle for explode direction
            slices.push({ start: start + GAP / 2, sweep, mid, color: colors[i], label: labels[i], count: v });
            start += sweep + GAP;
        });

        // Animation state per slice: current explode offset (0→EXPLODE, animated)
        const explodeState = slices.map(() => 0);   // 0 = resting
        let   hoveredIdx   = -1;
        let   rafId        = null;
        let   needsRedraw  = true;

        function getHoleBg() {
            return document.documentElement.classList.contains('dark') ? '#192016' : '#ffffff';
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);

            slices.forEach((s, i) => {
                const offset = explodeState[i];
                const ox = Math.cos(s.mid) * offset;
                const oy = Math.sin(s.mid) * offset;

                ctx.save();
                ctx.translate(ox, oy);

                // Glow effect on hovered slice
                if (i === hoveredIdx && offset > 0) {
                    ctx.shadowColor  = s.color;
                    ctx.shadowBlur   = 18;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                }

                // Draw slice
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, R, s.start, s.start + s.sweep);
                ctx.arc(cx, cy, INNER, s.start + s.sweep, s.start, true);
                ctx.closePath();
                ctx.fillStyle = s.color;
                ctx.fill();

                ctx.restore();
            });

            // Redraw inner hole on top to mask centre artifacts
            ctx.beginPath();
            ctx.arc(cx, cy, INNER - 1, 0, Math.PI * 2);
            ctx.fillStyle = getHoleBg();
            ctx.fill();
        }

        function drawEmpty() {
            ctx.clearRect(0, 0, W, H);
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.arc(cx, cy, INNER, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(120,120,120,0.12)';
            ctx.fill('evenodd');
            // Redraw hole in case theme changed
            ctx.beginPath();
            ctx.arc(cx, cy, INNER - 1, 0, Math.PI * 2);
            ctx.fillStyle = getHoleBg();
            ctx.fill();
        }

        // Animation loop — only runs when something is animating
        function animate() {
            let stillAnimating = false;
            slices.forEach((_, i) => {
                const target = i === hoveredIdx ? EXPLODE : 0;
                const diff   = target - explodeState[i];
                if (Math.abs(diff) > 0.2) {
                    explodeState[i] += diff * 0.18;   // ease factor
                    stillAnimating = true;
                } else {
                    explodeState[i] = target;
                }
            });
            draw();
            if (stillAnimating) {
                rafId = requestAnimationFrame(animate);
            } else {
                rafId = null;
            }
        }

        function startAnim() {
            if (!rafId) rafId = requestAnimationFrame(animate);
        }

        // Initial draw
        draw();

        // Hit-test: which slice is under (mx, my) in canvas coords?
        function hitSlice(mx, my) {
            const dx   = mx - cx;
            const dy   = my - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < INNER || dist > R + EXPLODE) return -1;
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += Math.PI * 2;
            for (let i = 0; i < slices.length; i++) {
                const s   = slices[i];
                let st    = s.start;
                let end   = s.start + s.sweep;
                // Normalise to same half-plane as angle
                if (st < -Math.PI / 2) { st += Math.PI * 2; end += Math.PI * 2; }
                if (angle >= st && angle <= end) return i;
            }
            return -1;
        }

        // Mouse events
        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            const sx   = W / rect.width;
            const sy   = H / rect.height;
            const mx   = (e.clientX - rect.left) * sx;
            const my   = (e.clientY - rect.top)  * sy;
            const idx  = hitSlice(mx, my);

            if (idx !== hoveredIdx) {
                hoveredIdx = idx;
                startAnim();
            }

            if (idx >= 0) {
                canvas.style.cursor = 'pointer';
                showTip(e, slices[idx], total);
            } else {
                canvas.style.cursor = 'default';
                hideTip();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            hoveredIdx = -1;
            canvas.style.cursor = 'default';
            hideTip();
            startAnim();
        });

        // Public redraw — called when theme changes
        function redraw() {
            draw();
        }

        return { redraw };
    }

    // ── Tooltip ──
    function ensureTip() {
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'donut-tooltip';
            document.body.appendChild(tooltip);
        }
    }
    function showTip(e, slice, total) {
        ensureTip();
        const pct = Math.round((slice.count / total) * 100);
        tooltip.innerHTML = `<strong>${slice.label}</strong>: ${slice.count} task${slice.count !== 1 ? 's' : ''} (${pct}%)`;
        tooltip.style.display = 'block';
        tooltip.style.left    = (e.clientX + 14) + 'px';
        tooltip.style.top     = (e.clientY - 36) + 'px';
    }
    function hideTip() {
        if (tooltip) tooltip.style.display = 'none';
    }

    function escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
});