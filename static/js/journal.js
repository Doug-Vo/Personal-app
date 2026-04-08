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

});
