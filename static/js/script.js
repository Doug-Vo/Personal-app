document.addEventListener("DOMContentLoaded", () => {


    const featuresToggle = document.getElementById('features-dropdown-toggle');
    const featuresMenu = document.getElementById('features-dropdown-menu');

    if (featuresToggle && featuresMenu) {
        featuresToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            featuresMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            featuresMenu.classList.remove('show');
        });

        featuresMenu.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // ── Utilities ──
    function debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => { func.apply(this, args); }, delay);
        };
    }

    // ── Theme Toggle (inside account dropdown) ──
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeLabel     = document.getElementById("theme-toggle-label");

    function applyTheme() {
        const isDark = document.documentElement.classList.contains("dark");
        if (themeLabel) themeLabel.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
    }

    themeToggleBtn?.addEventListener("click", (e) => {
        e.stopPropagation(); // keep dropdown open
        const isDark = document.documentElement.classList.toggle("dark");
        localStorage.setItem("theme", isDark ? "dark" : "light");
        applyTheme();
    });

    applyTheme();

    // ── Piglet Interactions (shared — piglet lives in base.html header) ──
    const group  = document.getElementById("piglet-group");
    const eyeL   = document.getElementById("eye-left");
    const eyeR   = document.getElementById("eye-right");
    const hearts = ["heart1", "heart2", "heart3"].map(id => document.getElementById(id));
    const stars  = ["star1",  "star2",  "star3" ].map(id => document.getElementById(id));

    if (group) {
        function clearAnimClass() { group.classList.remove("bounce", "wiggle", "spin"); }

        function squintEyes() {
            eyeL?.setAttribute("ry", "2");
            eyeR?.setAttribute("ry", "2");
            setTimeout(() => {
                eyeL?.setAttribute("ry", "5.5");
                eyeR?.setAttribute("ry", "5.5");
            }, 500);
        }

        function popHearts() {
            hearts.forEach((h, i) => {
                if (!h) return;
                h.classList.remove("pop");
                void h.offsetWidth;
                setTimeout(() => h.classList.add("pop"), i * 80);
            });
        }

        function burstStars() {
            stars.forEach((s, i) => {
                if (!s) return;
                s.classList.remove("burst");
                void s.offsetWidth;
                setTimeout(() => s.classList.add("burst"), i * 60);
            });
        }

        let clickTimer = null, clickCount = 0;

        document.getElementById("piglet-svg")?.addEventListener("click", () => {
            clickCount++;
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                clearAnimClass();
                void group.offsetWidth;
                if (clickCount === 1) {
                    group.classList.add("bounce");
                    squintEyes();
                    popHearts();
                } else {
                    group.classList.add("spin");
                    squintEyes();
                    burstStars();
                }
                clickCount = 0;
                group.addEventListener("animationend", clearAnimClass, { once: true });
            }, 220);
        });

        document.getElementById("piglet-svg")?.addEventListener("mouseenter", () => {
            if (!group.classList.contains("bounce") && !group.classList.contains("spin")) {
                clearAnimClass();
                void group.offsetWidth;
                group.classList.add("wiggle");
                group.addEventListener("animationend", clearAnimClass, { once: true });
            }
        });
    }

    // ── Account Dropdown (all pages) ──
    const toggle = document.getElementById("account-dropdown-toggle");
    const menu   = document.getElementById("account-dropdown-menu");

    if (toggle && menu) {
        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.toggle("account-dropdown-open");
            toggle.classList.toggle("account-dropdown-btn-active", isOpen);
        });

        document.addEventListener("click", () => {
            menu.classList.remove("account-dropdown-open");
            toggle.classList.remove("account-dropdown-btn-active");
        });
    }

    // ── Translator Logic (only runs if translator boxes exist) ──
    const enBox = document.getElementById("text-en");
    if (!enBox) return;

    const boxes = {
        en:        { text: document.getElementById("text-en"),  clear: document.getElementById("clear-en"),  copy: document.getElementById("copy-en")  },
        fi:        { text: document.getElementById("text-fi"),  clear: document.getElementById("clear-fi"),  copy: document.getElementById("copy-fi")  },
        vi:        { text: document.getElementById("text-vi"),  clear: document.getElementById("clear-vi"),  copy: document.getElementById("copy-vi")  },
        "zh-Hans": { text: document.getElementById("text-zh"),  clear: document.getElementById("clear-zh"),  copy: document.getElementById("copy-zh")  }
    };
    const spinner    = document.getElementById("spinner");
    const csrfToken  = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    function showSpinner(show) {
        spinner?.classList.toggle("hidden", !show);
    }

    function showCopiedFeedback(btn) {
        const original = btn.innerHTML;
        btn.innerHTML = `<svg class="icon" style="color: #6a9e5e;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        setTimeout(() => { btn.innerHTML = original; }, 1500);
    }

    // Clear & Copy buttons
    Object.keys(boxes).forEach(lang => {
        const el = boxes[lang];

        el.copy?.addEventListener("click", () => {
            if (el.text.value.trim() === "") return;
            navigator.clipboard.writeText(el.text.value);
            showCopiedFeedback(el.copy);
        });

        el.clear?.addEventListener("click", () => {
            Object.values(boxes).forEach(b => {
                b.text.value = "";
                b.clear.classList.add("hidden");
            });
        });

        el.text?.addEventListener("input", () => {
            el.clear.classList.toggle("hidden", el.text.value === "");
        });
    });

    // Translation API call
    async function performTranslation(sourceText, sourceLang) {
        if (!sourceText.trim()) {
            Object.keys(boxes).forEach(key => {
                if (key !== sourceLang) {
                    boxes[key].text.value = "";
                    boxes[key].clear.classList.add("hidden");
                }
            });
            return;
        }

        showSpinner(true);
        try {
            const response = await fetch("/api/translate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken
                },
                body: JSON.stringify({ text: sourceText, source_lang: sourceLang }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Translation API Failed");
            }

            const results = await response.json();
            Object.keys(results).forEach(langKey => {
                if (boxes[langKey]) {
                    boxes[langKey].text.value = results[langKey];
                    boxes[langKey].clear.classList.remove("hidden");
                }
            });

        } catch (e) {
            console.error("Translation failed", e);
            Object.keys(boxes).forEach(key => {
                if (key !== sourceLang) {
                    boxes[key].text.value = `Error: ${e.message}`;
                }
            });
        } finally {
            showSpinner(false);
        }
    }

    const debouncedTranslate = debounce(performTranslation, 600);
    Object.keys(boxes).forEach(lang => {
        boxes[lang].text?.addEventListener("input", () => {
            debouncedTranslate(boxes[lang].text.value, lang);
        });
    });

    


});