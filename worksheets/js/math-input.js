/*
 * Visual math input (MathLive) for any text field of the editor.
 *
 * The "√ Math" button (or Ctrl+M) opens a small math editor for the field the
 * teacher was last typing in:
 *   - caret inside $...$ or $$...$$  -> that math is loaded and replaced on OK;
 *   - otherwise                       -> new $...$ is inserted at the caret
 *                                        (a selected piece of text is loaded as LaTeX).
 * The field keeps plain markup with LaTeX, so files are unchanged and MathLive is
 * only an input aid. MathLive (vendor/mathlive) is loaded the first time it is used,
 * and draws with the KaTeX fonts already in vendor/katex.
 */
(function (WS) {
  'use strict';

  var SCRIPT = '../vendor/mathlive/mathlive.min.js';
  var FONTS = '../vendor/katex/fonts';
  var loading = null;

  function load() {
    if (window.MathfieldElement) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SCRIPT;
      s.onload = function () {
        try {
          window.MathfieldElement.fontsDirectory = new URL(FONTS, document.baseURI).href;
          window.MathfieldElement.soundsDirectory = null;
        } catch (e) { /* older/newer MathLive: defaults are fine */ }
        resolve();
      };
      s.onerror = function () { loading = null; reject(new Error('The math editor (MathLive) could not be loaded.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /**
   * The math span around position `pos` of worksheet markup, or null.
   * Returns { start, end, tex, display }; start/end include the $ signs.
   * \$ is a literal dollar, never a delimiter.
   */
  function mathAt(text, pos) {
    var i = 0, n = text.length;
    while (i < n) {
      var c = text[i];
      if (c === '\\') { i += 2; continue; }
      if (c !== '$') { i++; continue; }
      var display = text[i + 1] === '$';
      var open = display ? 2 : 1;
      var j = i + open;
      var close = -1;
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$' && (!display || text[j + 1] === '$')) { close = j; break; }
        j++;
      }
      if (close < 0) return null;   // unclosed: not math yet
      var end = close + open;
      if (pos > i && pos < end) return { start: i, end: end, tex: text.slice(i + open, close), display: display };
      if (pos === i || pos === end) {
        // Caret right next to a delimiter counts as inside (easy to click).
        return { start: i, end: end, tex: text.slice(i + open, close), display: display };
      }
      i = end;
    }
    return null;
  }

  // MathLive writes \cdot for "*"; worksheets use \times. Also tidy spacing it adds.
  function tidy(tex) {
    return String(tex || '')
      .replace(/\\cdot(?![a-zA-Z])/g, '\\times')
      // \frac45 (MathLive's short form) -> \frac{4}{5}, easier to read and edit by hand
      .replace(/\\(d?frac)(\d)(\d)/g, '\\$1{$2}{$3}')
      .replace(/\\(d?frac)(\d)\{/g, '\\$1{$2}{')
      .replace(/\\exponentialE/g, 'e')
      .replace(/\\differentialD/g, 'd')
      .trim();
  }

  var dialog = null;

  function build() {
    var d = document.createElement('dialog');
    d.className = 'math-dialog';
    d.innerHTML =
      '<form method="dialog">' +
      '<div class="math-head"><b>Math</b> <span class="muted">Type normally: / makes a fraction, ^ a power, ' +
      '* a times sign. The keyboard button opens a math keyboard.</span></div>' +
      '<div class="math-slot"></div>' +
      '<div class="row math-foot">' +
      '<label class="check"><input type="checkbox" class="math-display"> On its own line ($$)</label>' +
      '<span class="spacer"></span>' +
      '<code class="math-tex mono" title="The LaTeX that will be written into the field"></code>' +
      '</div>' +
      '<div class="row math-foot">' +
      '<span class="spacer"></span>' +
      '<button value="cancel" class="btn">Cancel</button> ' +
      '<button value="ok" class="btn primary math-ok">Insert</button>' +
      '</div></form>';
    document.body.appendChild(d);
    return d;
  }

  /**
   * Open the math editor for `field` (an input or textarea of the editor).
   * Writes the result back into the field and fires an input event so the
   * document updates like any typing would.
   */
  function open(field) {
    if (!field || !document.body.contains(field)) {
      alert('Click in a text box first (a question, part or answer), then press √ Math.');
      return Promise.resolve(false);
    }
    var text = field.value;
    var selStart = field.selectionStart, selEnd = field.selectionEnd;
    var span = mathAt(text, selStart);
    var start, end, tex, display;
    if (span) { start = span.start; end = span.end; tex = span.tex; display = span.display; }
    else {
      start = selStart; end = selEnd; tex = text.slice(selStart, selEnd); display = false;
    }
    return load().then(function () {
      if (!dialog) dialog = build();
      var slot = dialog.querySelector('.math-slot');
      slot.innerHTML = '';
      var mf = new window.MathfieldElement();
      mf.className = 'math-field';
      slot.appendChild(mf);
      // Typing "*" gives a times sign, as on the worksheets (MathLive's default is \cdot).
      try { mf.inlineShortcuts = Object.assign({}, mf.inlineShortcuts, { '*': '\\times' }); } catch (e) { /* tidy() still writes \times */ }
      mf.value = tex;
      var initial = mf.value;   // MathLive's own spelling of the loaded math
      var disp = dialog.querySelector('.math-display');
      disp.checked = display;
      var out = dialog.querySelector('.math-tex');
      var okBtn = dialog.querySelector('.math-ok');
      okBtn.textContent = span ? 'Update' : 'Insert';
      function show() { out.textContent = (disp.checked ? '$$' : '$') + tidy(mf.value) + (disp.checked ? '$$' : '$'); }
      mf.addEventListener('input', show);
      disp.onchange = show;
      show();
      return new Promise(function (resolve) {
        dialog.onclose = function () {
          try { if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide(); } catch (e) { /* ignore */ }
          var ok = dialog.returnValue === 'ok';
          // Untouched math keeps its original spelling (\dfrac stays \dfrac, etc.).
          var value = span && mf.value === initial ? tex : tidy(mf.value);
          if (span && !disp.checked === !span.display && value === tex) ok = false;
          if (ok && value) {
            var md = disp.checked ? '$$' : '$';
            var insert = md + value + md;
            if (disp.checked && !span) {
              // Display math sits on its own line.
              if (start > 0 && text[start - 1] !== '\n') insert = '\n' + insert;
              if (end < text.length && text[end] !== '\n') insert = insert + '\n';
            } else if (!span && start > 0 && /[A-Za-z0-9.,:;!?)]/.test(text[start - 1])) {
              insert = ' ' + insert;   // "Evaluate" + math -> "Evaluate $…$"
            }
            field.focus();
            field.setRangeText(insert, start, end, 'end');
            field.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            field.focus();
          }
          resolve(ok);
        };
        dialog.returnValue = '';
        dialog.showModal();
        // Enter in the math field = OK.
        mf.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); dialog.close('ok'); }
        });
        setTimeout(function () { mf.focus(); }, 0);
      });
    }).catch(function (e) { alert(e.message || e); return false; });
  }

  WS.mathInput = { open: open, mathAt: mathAt, tidy: tidy, load: load };
})(window.WS = window.WS || {});
