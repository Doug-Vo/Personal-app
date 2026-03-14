// ── Inline delete confirm ──
function showDeleteConfirm(btn) {
    // Hide any other open confirms first
    document.querySelectorAll('.delete-confirm').forEach(el => el.classList.add('hidden'));
    const wrap = btn.closest('.entry-delete-wrap');
    btn.classList.add('hidden');
    wrap.querySelector('.delete-confirm').classList.remove('hidden');
}

function hideDeleteConfirm(btn) {
    const wrap = btn.closest('.entry-delete-wrap');
    wrap.querySelector('.delete-confirm').classList.remove('hidden');
    wrap.querySelector('.delete-confirm').classList.add('hidden');
    wrap.querySelector('.entry-delete').classList.remove('hidden');
}

// Close any open confirm if clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.entry-delete-wrap')) {
        document.querySelectorAll('.delete-confirm').forEach(el => {
            if (!el.classList.contains('hidden')) {
                el.classList.add('hidden');
                el.closest('.entry-delete-wrap').querySelector('.entry-delete').classList.remove('hidden');
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {

    // ── Feeling selector highlight ──
    const FEELING_BTN_COLORS = {
        'Excited':    '#f59e0b',
        'Happy':      '#22c55e',
        'Calm':       '#38bdf8',
        'Neutral':    '#a78bfa',
        'Tired':      '#94a3b8',
        'Sad':        '#818cf8',
        'Anxious':    '#fb923c',
        'Frustrated': '#f43f5e',
    };

    function applyFeelingColor(btn, word, selected) {
        const color = FEELING_BTN_COLORS[word];
        if (selected && color) {
            btn.style.background  = color;
            btn.style.borderColor = color;
            btn.style.boxShadow   = `0 0 0 3px ${color}33`;
            btn.querySelector('.feeling-word').style.color  = '#fff';
            btn.querySelector('.feeling-emoji').style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))';
        } else {
            btn.style.background  = '';
            btn.style.borderColor = '';
            btn.style.boxShadow   = '';
            btn.querySelector('.feeling-word').style.color  = '';
            btn.querySelector('.feeling-emoji').style.filter = '';
        }
    }

    document.querySelectorAll('.feeling-option input').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.feeling-option').forEach(opt => {
                const btn  = opt.querySelector('.feeling-btn');
                const word = opt.querySelector('input').value.replace(/^\S+\s+/, '').trim();
                btn.classList.remove('feeling-btn-selected');
                applyFeelingColor(btn, word, false);
            });
            const selectedBtn  = radio.closest('.feeling-option').querySelector('.feeling-btn');
            const selectedWord = radio.value.replace(/^\S+\s+/, '').trim();
            selectedBtn.classList.add('feeling-btn-selected');
            applyFeelingColor(selectedBtn, selectedWord, true);
        });
    });

    // ── Heatmap (only runs if heatmap grid exists) ──
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (!heatmapGrid) return;

    (async () => {
        const res  = await fetch("/journal/chart-data");
        const data = await res.json();

        // Build lookup: date string → {score, feeling}
        const lookup = {};
        data.forEach(d => { lookup[d.date] = d; });

        let current = new Date();
        current.setDate(1);

        // Per-emotion colors — rainbow-inspired, each feeling has its own distinct hue
        const FEELING_COLORS = {
            'Excited':    { bg: '#f59e0b', text: '#fff' },   // amber
            'Happy':      { bg: '#22c55e', text: '#fff' },   // green
            'Calm':       { bg: '#38bdf8', text: '#fff' },   // sky blue
            'Neutral':    { bg: '#a78bfa', text: '#fff' },   // violet
            'Tired':      { bg: '#94a3b8', text: '#fff' },   // slate
            'Sad':        { bg: '#818cf8', text: '#fff' },   // indigo
            'Anxious':    { bg: '#fb923c', text: '#fff' },   // orange
            'Frustrated': { bg: '#f43f5e', text: '#fff' },   // rose red
        };

        const PIGLET_SVGS = {
            "Excited": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <!-- Wide shiny eyes -->\n  <circle cx=\"40\" cy=\"40\" r=\"6.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"60\" cy=\"40\" r=\"6.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"42\" cy=\"37\" r=\"2.5\" fill=\"white\"/>\n  <circle cx=\"62\" cy=\"37\" r=\"2.5\" fill=\"white\"/>\n  <!-- Extra rosy cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"9\" ry=\"7\" fill=\"#f4a7b9\" opacity=\"0.4\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"9\" ry=\"7\" fill=\"#f4a7b9\" opacity=\"0.4\"/>\n  <!-- Open O mouth -->\n  <ellipse cx=\"50\" cy=\"63\" rx=\"4\" ry=\"3\" fill=\"#d4607a\"/>\n  <!-- Star sparkles -->\n  <text x=\"18\" y=\"28\" font-size=\"9\" text-anchor=\"middle\" opacity=\"0.9\">\u2728</text>\n  <text x=\"82\" y=\"28\" font-size=\"9\" text-anchor=\"middle\" opacity=\"0.9\">\u2728</text>\n</svg>",
            "Happy": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <!-- Squint eyes (arcs) -->\n  <path d=\"M 35,41 Q 40,35 45,41\" stroke=\"#2c1a1a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n  <path d=\"M 55,41 Q 60,35 65,41\" stroke=\"#2c1a1a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Wide smile below snout -->\n  <path d=\"M 40,64 Q 50,72 60,64\" stroke=\"#d4607a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n</svg>",
            "Calm": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Soft zen aura glow behind head -->\n  <ellipse cx=\"50\" cy=\"44\" rx=\"34\" ry=\"32\" fill=\"#c7f0e8\" opacity=\"0.35\"/>\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks \u2014 softer teal tint for zen -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#80cbc4\" opacity=\"0.35\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#80cbc4\" opacity=\"0.35\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <!-- Zen closed eyes \u2014 smooth curved arcs, relaxed -->\n  <path d=\"M 34,40 Q 40,36 46,40\" stroke=\"#2c1a1a\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/>\n  <path d=\"M 54,40 Q 60,36 66,40\" stroke=\"#2c1a1a\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Serene small smile -->\n  <path d=\"M 44,63 Q 50,68 56,63\" stroke=\"#d4607a\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Floating lotus/sparkle dots \u2014 zen energy -->\n  <circle cx=\"20\" cy=\"22\" r=\"2\" fill=\"#80cbc4\" opacity=\"0.8\"/>\n  <circle cx=\"28\" cy=\"14\" r=\"1.4\" fill=\"#80cbc4\" opacity=\"0.6\"/>\n  <circle cx=\"80\" cy=\"22\" r=\"2\" fill=\"#80cbc4\" opacity=\"0.8\"/>\n  <circle cx=\"72\" cy=\"14\" r=\"1.4\" fill=\"#80cbc4\" opacity=\"0.6\"/>\n  <circle cx=\"50\" cy=\"10\" r=\"2.2\" fill=\"#80cbc4\" opacity=\"0.7\"/>\n  <!-- Small tilde above head \u2014 meditation wave -->\n  <path d=\"M 40,6 Q 44,3 48,6 Q 52,9 56,6\" stroke=\"#80cbc4\" stroke-width=\"1.8\" fill=\"none\" stroke-linecap=\"round\" opacity=\"0.9\"/>\n</svg>",
            "Neutral": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <circle cx=\"40\" cy=\"40\" r=\"5.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"60\" cy=\"40\" r=\"5.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"42\" cy=\"38\" r=\"2\" fill=\"white\"/>\n  <circle cx=\"62\" cy=\"38\" r=\"2\" fill=\"white\"/>\n  <!-- Straight mouth -->\n  <line x1=\"44\" y1=\"64\" x2=\"56\" y2=\"64\" stroke=\"#d4607a\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n</svg>",
            "Tired": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <!-- Closed sleepy eyes -->\n  <path d=\"M 35,40 Q 40,44 45,40\" stroke=\"#2c1a1a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n  <path d=\"M 55,40 Q 60,44 65,40\" stroke=\"#2c1a1a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Tiny droopy frown -->\n  <path d=\"M 44,66 Q 50,63 56,66\" stroke=\"#d4607a\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Z Z -->\n  <text x=\"72\" y=\"25\" font-size=\"7\" fill=\"#94a3b8\" font-weight=\"bold\" opacity=\"0.9\">z</text>\n  <text x=\"78\" y=\"19\" font-size=\"9\" fill=\"#94a3b8\" font-weight=\"bold\" opacity=\"0.9\">z</text>\n  <text x=\"85\" y=\"13\" font-size=\"11\" fill=\"#94a3b8\" font-weight=\"bold\" opacity=\"0.9\">Z</text>\n</svg>",
            "Sad": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <circle cx=\"40\" cy=\"40\" r=\"5.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"60\" cy=\"40\" r=\"5.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"42\" cy=\"38\" r=\"2\" fill=\"white\"/>\n  <circle cx=\"62\" cy=\"38\" r=\"2\" fill=\"white\"/>\n  <!-- Teardrops -->\n  <ellipse cx=\"38\" cy=\"49\" rx=\"1.8\" ry=\"2.5\" fill=\"#93c5fd\" opacity=\"0.9\"/>\n  <ellipse cx=\"62\" cy=\"49\" rx=\"1.8\" ry=\"2.5\" fill=\"#93c5fd\" opacity=\"0.9\"/>\n  <!-- Downturned mouth -->\n  <path d=\"M 42,66 Q 50,61 58,66\" stroke=\"#d4607a\" stroke-width=\"2.5\" fill=\"none\" stroke-linecap=\"round\"/>\n</svg>",
            "Anxious": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#f4a7b9\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#f4a7b9\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#f4a7b9\"/>\n  <!-- Feet -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#f4a7b9\"/>\n  <!-- Body -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#fcd5e0\"/>\n  <!-- Ears outer -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#f4a7b9\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#f4a7b9\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#fce8ed\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#fce8ed\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#fcd5e0\"/>\n  <!-- Cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"8\" ry=\"6\" fill=\"#f4a7b9\" opacity=\"0.5\"/>\n  <!-- Snout -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#f4a7b9\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#d4607a\"/>\n  <!-- Wide anxious eyes -->\n  <circle cx=\"40\" cy=\"40\" r=\"6.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"60\" cy=\"40\" r=\"6.5\" fill=\"#2c1a1a\"/>\n  <circle cx=\"42\" cy=\"37.5\" r=\"2.2\" fill=\"white\"/>\n  <circle cx=\"62\" cy=\"37.5\" r=\"2.2\" fill=\"white\"/>\n  <!-- Sweat drop -->\n  <ellipse cx=\"76\" cy=\"30\" rx=\"2\" ry=\"3\" fill=\"#93c5fd\" opacity=\"0.85\"/>\n  <path d=\"M 74,28 Q 76,23 78,28\" fill=\"#93c5fd\" opacity=\"0.85\"/>\n  <!-- Wavy mouth -->\n  <path d=\"M 42,64 Q 46,68 50,64 Q 54,60 58,64\" stroke=\"#d4607a\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"/>\n</svg>",
            "Frustrated": "<svg viewBox=\"0 0 100 100\" width=\"48\" height=\"48\" xmlns=\"http://www.w3.org/2000/svg\" style=\"overflow:visible;\">\n  <!-- Tail \u2014 reddish tint -->\n  <path d=\"m 69.316456,75.189873 q 10,-7 7,2 7,-5 4,4\" stroke=\"#e57373\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Side nubs -->\n  <ellipse cx=\"16.392405\" cy=\"64.341774\" fill=\"#e57373\" rx=\"3.329114\" ry=\"4.5316458\"/>\n  <path d=\"m 83.822266,57.886719 a 3.329114,4.5316458 0 0 0 -3.328125,4.53125 3.329114,4.5316458 0 0 0 3.328125,4.53125 3.329114,4.5316458 0 0 0 3.330078,-4.53125 3.329114,4.5316458 0 0 0 -3.330078,-4.53125 z\" fill=\"#e57373\"/>\n  <!-- Feet \u2014 reddish -->\n  <ellipse cx=\"33.367088\" cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#e57373\"/>\n  <ellipse cx=\"61.06329\"  cy=\"82.367088\" rx=\"12\" ry=\"7\" fill=\"#e57373\"/>\n  <!-- Body \u2014 flushed red -->\n  <ellipse cx=\"49.810127\" cy=\"56.164558\" rx=\"33\" ry=\"24.822784\" fill=\"#ffb3b3\"/>\n  <!-- Ears outer \u2014 red -->\n  <ellipse cx=\"29.918684\" cy=\"38.188843\" rx=\"6.164351\" ry=\"11.339476\" fill=\"#e57373\" transform=\"matrix(0.91122667,-0.41190528,0.15686423,0.98762018,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"6.4294758\" ry=\"11.233117\" fill=\"#e57373\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Ears inner -->\n  <ellipse cx=\"30.568623\" cy=\"38.957729\" rx=\"2.9820859\" ry=\"6.1348157\" fill=\"#ffcdd2\" transform=\"matrix(0.8998367,-0.43622691,0.14650242,0.98921031,0,0)\"/>\n  <ellipse cx=\"72.346237\" cy=\"-2.7759662\" rx=\"3.5069866\" ry=\"6.4806447\" fill=\"#ffcdd2\" transform=\"matrix(0.92057459,0.3905668,-0.16685428,0.98598157,0,0)\"/>\n  <!-- Head \u2014 flushed red -->\n  <ellipse cx=\"50\" cy=\"46.405064\" rx=\"30\" ry=\"27.594936\" fill=\"#ffb3b3\"/>\n  <!-- Deep red blush flush on cheeks -->\n  <ellipse cx=\"30\" cy=\"50\" rx=\"10\" ry=\"8\" fill=\"#ef5350\" opacity=\"0.4\"/>\n  <ellipse cx=\"70\" cy=\"50\" rx=\"10\" ry=\"8\" fill=\"#ef5350\" opacity=\"0.4\"/>\n  <!-- Snout \u2014 darker red -->\n  <ellipse cx=\"50\" cy=\"53\" rx=\"13\" ry=\"9.5\" fill=\"#e57373\"/>\n  <!-- Nostrils -->\n  <ellipse cx=\"45\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#b71c1c\"/>\n  <ellipse cx=\"55\" cy=\"53\" rx=\"2.8\" ry=\"2.2\" fill=\"#b71c1c\"/>\n  <!-- Eyes \u2014 squinted angry -->\n  <circle cx=\"40\" cy=\"40\" r=\"5.5\" fill=\"#1a0a0a\"/>\n  <circle cx=\"60\" cy=\"40\" r=\"5.5\" fill=\"#1a0a0a\"/>\n  <circle cx=\"42\" cy=\"38\" r=\"1.5\" fill=\"white\"/>\n  <circle cx=\"62\" cy=\"38\" r=\"1.5\" fill=\"white\"/>\n  <!-- Heavy angry brows \u2014 sharp V shape -->\n  <path d=\"M 33,32 L 40,36 L 47,32\" stroke=\"#7f0000\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M 53,32 L 60,36 L 67,32\" stroke=\"#7f0000\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <!-- Gritted downturned mouth -->\n  <path d=\"M 41,65 Q 50,59 59,65\" stroke=\"#7f0000\" stroke-width=\"2.8\" fill=\"none\" stroke-linecap=\"round\"/>\n  <!-- Rage vein top left of head -->\n  <path d=\"M 23,28 L 27,24 L 23,20\" stroke=\"#c62828\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <!-- Rage vein top right -->\n  <path d=\"M 77,28 L 73,24 L 77,20\" stroke=\"#c62828\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>",
        };

        const feelingsMap = {
            7: 'Excited',
            6: 'Happy',
            5: 'Calm',
            4: 'Neutral',
            3: 'Tired',
            2: 'Sad',
            1: 'Frustrated'
        };

        function feelingColor(feeling) {
            // feeling string may be "😊 Happy" or plain "Happy"
            const word = feeling ? feeling.replace(/^\S+\s+/, '').trim() : '';
            return FEELING_COLORS[word] || FEELING_COLORS[feeling] || { bg: '#6a9e5e', text: '#fff' };
        }

        function renderMonth(date) {
            const year  = date.getFullYear();
            const month = date.getMonth();
            const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            document.getElementById('month-label').textContent = label;

            const grid = document.getElementById('heatmap-grid');
            grid.innerHTML = '';

            const firstDay    = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
                const blank = document.createElement('div');
                blank.className = 'heatmap-cell heatmap-cell-empty';
                grid.appendChild(blank);
            }

            const tip         = document.getElementById('heatmap-tooltip');
            let monthScores   = [];
            let monthFeelings = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const entry   = lookup[dateStr];
                const cell    = document.createElement('div');
                cell.className = 'heatmap-cell heatmap-cell-day';

                if (entry) {
                    const { bg } = feelingColor(entry.feeling);
                    cell.style.background = bg;
                    monthScores.push(entry.score);
                    monthFeelings.push(entry.feeling);

                    cell.addEventListener('mouseenter', () => {
                        const word = entry.feeling.replace(/^\S+\s+/, '').trim();
                        const pigSvg = PIGLET_SVGS[word] || '';
                        tip.innerHTML = `<span class="tip-piglet">${pigSvg}</span><span>${word}</span>`;
                        tip.classList.remove('hidden');
                    });
                    cell.addEventListener('mousemove', (e) => {
                        tip.style.left = e.clientX + 'px';
                        tip.style.top  = e.clientY - 42 + 'px';
                    }, { passive: true });
                    cell.addEventListener('mouseleave', () => {
                        tip.classList.add('hidden');
                    });
                } else {
                    cell.style.background = 'var(--border)';
                    cell.style.opacity    = '0.4';
                }

                const dayNum = document.createElement('span');
                dayNum.className    = 'heatmap-day-num';
                dayNum.textContent  = day;
                cell.appendChild(dayNum);
                grid.appendChild(cell);
            }

            // Monthly summary — rendered ABOVE the grid via month-summary (positioned in HTML before heatmap-weekdays)
            const summary = document.getElementById('month-summary');

            if (monthScores.length > 0) {
                const avg  = (monthScores.reduce((a, b) => a + b, 0) / monthScores.length).toFixed(1);

                // Avg mood label: map avg score to nearest feeling
                const avgScore = Math.round(parseFloat(avg));
                const avgLabel = avgScore >= 7 ? 'Excited'
                               : avgScore >= 6 ? 'Happy'
                               : avgScore >= 5 ? 'Calm'
                               : avgScore >= 4 ? 'Neutral'
                               : avgScore >= 3 ? 'Tired'
                               : avgScore >= 2 ? 'Sad'
                               : 'Frustrated';

                const avgColor = feelingColor(avgLabel);

                const avgPiglet  = PIGLET_SVGS[avgLabel] || '';
                summary.innerHTML = `
                    <div class="summary-stat">
                        <span class="summary-num">${monthScores.length}</span>
                        <span class="summary-label">entries</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-num summary-avg-pill" style="background:${avgColor.bg};color:${avgColor.text}">
                            <span class="summary-piglet">${avgPiglet}</span>${avg} · ${avgLabel}
                        </span>
                        <span class="summary-label">avg mood</span>
                    </div>
                `;
            } else {
                summary.innerHTML = '<p class="journal-empty-sm">No entries this month yet.</p>';
            }
        }

        renderMonth(current);

        let navLocked = false;
        function navMonth(delta) {
            if (navLocked) return;
            navLocked = true;
            current.setMonth(current.getMonth() + delta);
            renderMonth(current);
            setTimeout(() => { navLocked = false; }, 300);
        }

        document.getElementById('prev-month')?.addEventListener('click', () => navMonth(-1));
        document.getElementById('next-month')?.addEventListener('click', () => navMonth(1));
    })();

});