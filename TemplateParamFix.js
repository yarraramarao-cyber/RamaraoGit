/* TemplateParamFix v3.3 — Floating Button + Draggable Popup + Live CodeMirror Highlight + Namespace Filter
   Author: You + ChatGPT
   Notes:
   - Works on namespaces: Main(0), User(2), Template(10)
   - Shows the floating button only on source edit pages (when #wpTextbox1 exists)
   - Includes cite-templates in scan by default (configurable)
*/
(function () {
    'use strict';

    // ======= Config =======
    const ALLOWED_NS = [0, 2, 10];         // Main, User, Template
    const INCLUDE_CITE_TEMPLATES = true;   // true => cite మూసలు కూడా స్కాన్
    const FLOAT_BTN_SIZE = 50;             // px

    // ======= Guards =======
    const ns = mw.config.get('wgNamespaceNumber');
    if (!ALLOWED_NS.includes(ns)) return;

    // Run only on source edit pages
    function isSourceEditPage() {
        const action = mw.config.get('wgAction');
        return (action === 'edit' || action === 'submit') && document.querySelector('#wpTextbox1');
    }
    if (!isSourceEditPage()) return;

    // ======= CodeMirror helpers =======
    let cm = null;
    let cmMarks = []; // to clear previous highlights

    function getCodeMirror() {
        if (cm) return cm;
        const cmEl = document.querySelector('.CodeMirror');
        if (cmEl && cmEl.CodeMirror) {
            cm = cmEl.CodeMirror;
        }
        return cm;
    }

    function clearHighlights() {
        cmMarks.forEach(m => { try { m.clear(); } catch(e){} });
        cmMarks = [];
        // Also remove line-class if any used later
    }

    function highlightNameAtGlobalRange(startIndex, nameLength) {
        const editor = getCodeMirror();
        if (!editor) return;
        const from = editor.posFromIndex(startIndex);
        const to   = editor.posFromIndex(startIndex + nameLength);
        const mark = editor.markText(from, to, { css: 'background-color: rgba(255,0,0,0.33);' });
        cmMarks.push(mark);
    }

    // ======= Parser: find duplicate params with global positions =======
    // Simple, robust-enough approach for wikitext templates {{ ... }} (non-nested best effort)
    function findDuplicateParamsWithPositions(wikitext) {
        const results = []; // { templateName, paramName, startNameIndex, matchText }
        // Match template blocks (best-effort; nested templates may not be perfect)
        const tplRe = /\{\{[\s\S]*?\}\}/g;
        let m;
        while ((m = tplRe.exec(wikitext)) !== null) {
            const tplText = m[0];
            const tplStart = m.index;

            // Template name
            const firstBar = tplText.indexOf('|');
            const rawName = (firstBar === -1 ? tplText.slice(2, -2) : tplText.slice(2, firstBar)).trim();
            const templateName = rawName.toLowerCase();

            // Cite include/exclude
            if (!INCLUDE_CITE_TEMPLATES && /^cite\s/i.test(templateName)) {
                continue;
            }

            // Iterate params like: | name = value
            const paramRe = /\|\s*([^=|]+?)\s*=/g;
            let pm;
            const seen = Object.create(null);   // paramName => first occurrence count
            while ((pm = paramRe.exec(tplText)) !== null) {
                const whole = pm[0];              // e.g. "| name ="
                const pName = pm[1].trim();       // "name"
                if (!pName) continue;

                // Compute global index for parameter NAME (not the whole match)
                // Find where the captured name begins inside 'whole'
                const relInWhole = whole.indexOf(pm[1]);
                const globalNameStart =
                    tplStart + pm.index + relInWhole; // absolute index in the full wikitext

                if (seen[pName]) {
                    // This is a duplicate occurrence — record it
                    results.push({
                        templateName: templateName,
                        paramName: pName,
                        startNameIndex: globalNameStart,
                        nameLength: pName.length
                    });
                } else {
                    seen[pName] = 1;
                }
            }
        }
        return results;
    }

    // ======= UI: Floating button (bottom-right) =======
    function addFloatingButton() {
        const btn = document.createElement('button');
        btn.title = 'డూప్లికేట్ మూస పరామితులు స్కాన్ చేయండి';
        btn.textContent = '🔍 స్కాన్';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: FLOAT_BTN_SIZE + 'px',
            height: FLOAT_BTN_SIZE + 'px',
            borderRadius: '25px',
            backgroundColor: '#0078D7',
            color: '#fff',
            fontSize: '13px',
            lineHeight: '1.1',
            border: 'none',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            zIndex: 9999,
            padding: '6px'
        });
        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = '#0a67c2');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = '#0078D7');
        btn.addEventListener('click', onScanClick);
        document.body.appendChild(btn);
    }

    // ======= UI: Draggable popup =======
    function showPopup(html) {
        // Container
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'fixed',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1px solid #444',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
            zIndex: 10000,
            maxWidth: '600px'
        });

        // Header (drag handle)
        const header = document.createElement('div');
        header.textContent = 'TemplateParamFix — Duplicates';
        Object.assign(header.style, {
            padding: '8px 12px',
            background: '#f0f2f5',
            borderBottom: '1px solid #ccc',
            cursor: 'move',
            fontWeight: '600'
        });
        wrap.appendChild(header);

        // Body
        const body = document.createElement('div');
        Object.assign(body.style, {
            padding: '10px 12px',
            maxHeight: '50vh',
            overflowY: 'auto'
        });
        body.innerHTML = html;
        wrap.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '8px 12px',
            borderTop: '1px solid #eee',
            textAlign: 'right'
        });
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        Object.assign(ok.style, {
            padding: '6px 10px',
            border: '1px solid #999',
            background: '#f7f7f7',
            cursor: 'pointer'
        });
        ok.addEventListener('click', () => wrap.remove());
        footer.appendChild(ok);
        wrap.appendChild(footer);

        document.body.appendChild(wrap);

        // Make draggable
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
        header.addEventListener('mousedown', (e) => {
            dragging = true;
            const rect = wrap.getBoundingClientRect();
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            wrap.style.left = (e.clientX - ox) + 'px';
            wrap.style.top  = (e.clientY - oy) + 'px';
            wrap.style.transform = ''; // remove centering while dragging
        });
        document.addEventListener('mouseup', () => dragging = false);
    }

    // ======= Scan handler =======
    function onScanClick() {
        const ta = document.querySelector('#wpTextbox1');
        if (!ta) return;

        // Clear old highlights
        clearHighlights();

        const text = getCodeMirror() ? cm.getValue() : ta.value;
        const dups = findDuplicateParamsWithPositions(text);

        if (!dups.length) {
            showPopup('<div style="color:green;font-weight:600;">డూప్లికేట్ పరామితులు లభించలేదు.</div>');
            return;
        }

        // Group by template -> params list
        const byTemplate = {};
        dups.forEach(d => {
            const t = d.templateName || '(unknown)';
            if (!byTemplate[t]) byTemplate[t] = new Set();
            byTemplate[t].add(d.paramName);
        });

        // Highlight all duplicate NAME occurrences
        if (getCodeMirror()) {
            dups.forEach(d => {
                highlightNameAtGlobalRange(d.startNameIndex, d.nameLength);
            });
        }

        // Build popup HTML
        let html = '<div style="margin-bottom:6px;"><b>డూప్లికేట్ పరామితులు కనబడ్డాయి:</b></div>';
        html += '<ol style="margin:0;padding-left:20px;">';
        Object.keys(byTemplate).forEach(t => {
            html += `<li><b>${mw.html.escape(t)}</b>: `;
            html += Array.from(byTemplate[t]).map(p => `<span style="color:#c00;">${mw.html.escape(p)}</span>`).join(', ');
            html += '</li>';
        });
        html += '</ol>';
        html += '<div style="margin-top:8px;color:#666;">గమనిక: హైలైట్‌లు ఎడిటర్‌లో పేరామీటర్ పేర్లపైన మాత్రమే చూపిస్తాయి.</div>';

        showPopup(html);
    }

    // ======= Boot =======
    // Add CSS (in case we later add classes; current mark uses inline css)
    mw.util.addCSS(`
        /* future-proof placeholder class */
        .tpfix-highlight { background-color: rgba(255,0,0,0.33) !important; }
    `);

    // Add floating button after editor ready
    // In practice, CodeMirror may attach a bit later; we only need the button now.
    addFloatingButton();

})();
