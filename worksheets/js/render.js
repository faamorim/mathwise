/*
 * Renders a document into printable pages.
 *
 * Every block is turned into one or more "fragments" (a question's prompt,
 * each row of its parts grid, each row of a table, ...). The paginator then
 * flows fragments onto fixed-size pages, so long question groups and tables
 * can continue on the next page. A fragment marked "keep" stays on the same
 * page as the fragment after it (e.g. a question prompt and its first row).
 */
(function (WS) {
  'use strict';

  var M = WS.markup;
  var FIELD_LABELS = { name: 'Name', date: 'Date', period: 'Period', block: 'Block' };
  var FIELD_WIDTHS = { name: 'l', date: 'm', period: 's', block: 's' };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function fmtMarks(n) {
    return String(Math.round(n * 1000) / 1000);
  }

  // Copy of opts carrying an answer to drop into the first empty blank.
  function withFill(opts, fill) {
    return { showAnswers: opts.showAnswers, fill: fill };
  }

  // part: the part's index when the space belongs to a part (lets the editor
  // map a dragged work space back to the question or part it came from).
  function spaceEl(lines, answerHtml, part, lined) {
    var s = el('div', 'space' + (lined ? ' lined' : ''));
    if (part != null) s.dataset.part = part;
    // Lined: ruled lines to write sentences on (one per line of space), drawn as
    // real borders so they print without "background graphics".
    if (lined) for (var n = 0; n < Math.floor(+lines || 0); n++) s.appendChild(el('div', 'rule-line'));
    s.style.minHeight = 'calc(var(--line) * ' + Math.max(0, +lines || 0) + ')';
    if (answerHtml) s.appendChild(el('div', 'ans', answerHtml));
    return s;
  }

  function headerEl(doc, full) {
    var h = el('div', 'sheet-header');
    h.appendChild(el('div', 'sh-title', M.inline(doc.title)));
    if (!full) return h;
    var fields = el('div', 'sh-fields');
    var hd = doc.header;
    hd.fields.forEach(function (f) {
      fields.appendChild(el('span', 'sh-field',
        FIELD_LABELS[f] + ':<span class="fill fill-' + FIELD_WIDTHS[f] + '"></span>'));
    });
    hd.custom.forEach(function (c) {
      fields.appendChild(el('span', 'sh-field',
        M.inline(c.label) + ':<span class="fill fill-' + c.width + '"></span>'));
    });
    if (hd.showGrade) {
      var label = hd.gradeLabel != null && hd.gradeLabel !== '' ? hd.gradeLabel
        : (doc.type === 'quiz' ? 'Quiz' : 'Mark');
      fields.appendChild(el('span', 'sh-field sh-grade',
        M.inline(label) + ':<span class="fill fill-m"></span>/&nbsp;' + fmtMarks(WS.model.gradeTotal(doc))));
    }
    if (fields.children.length) h.appendChild(fields);
    return h;
  }

  // ---------- fragments ----------

  function frag(e, blockIndex, keep) {
    e.classList.add('frag');
    if (blockIndex != null) e.dataset.block = blockIndex;
    e._keep = !!keep;
    return e;
  }

  function tableFragments(t, blockIndex, opts, standalone) {
    var out = [];
    var cols = 0;
    if (t.header) cols = t.header.length;
    t.rows.forEach(function (r) { cols = Math.max(cols, r.length); });
    var widths = Array.isArray(t.widths) && t.widths.length === cols ? t.widths : null;
    var sum = 0;
    if (widths) widths.forEach(function (w) { sum += +w || 0; });
    function colgroup() {
      var cg = '<colgroup>';
      if (t.rowLabels) cg += '<col style="width:2.4em">';
      for (var i = 0; i < cols; i++) {
        cg += widths && sum ? '<col style="width:' + (100 * (+widths[i] || 0) / sum) + '%">' : '<col>';
      }
      return cg + '</colgroup>';
    }
    function rowTable(cellsHtml, cls) {
      var tb = el('table', 'ws-table' + (standalone ? ' standalone' : '') + (cls ? ' ' + cls : ''));
      tb.innerHTML = colgroup() + '<tr>' + cellsHtml + '</tr>';
      return tb;
    }
    var minH = t.rowSpace ? ' style="height:calc(var(--line) * ' + (+t.rowSpace) + ')"' : '';
    if (t.header) {
      var hc = t.rowLabels ? '<th></th>' : '';
      t.header.forEach(function (c) { hc += '<th>' + M.inline(c) + '</th>'; });
      out.push(frag(rowTable(hc, 'head'), blockIndex, true));
    }
    t.rows.forEach(function (r, ri) {
      var cells = t.rowLabels ? '<td class="row-label">' + WS.model.rowLabel(ri) + '</td>' : '';
      r.forEach(function (c) {
        if (WS.model.isBlankCell(c)) {
          var a = opts.showAnswers && c.answer ? '<span class="ans">' + M.inline(c.answer) + '</span>' : '';
          cells += '<td class="blank-cell"' + minH + '>' + a + '</td>';
        } else {
          cells += '<td' + minH + '>' + M.inline(c) + '</td>';
        }
      });
      var tb = rowTable(cells, out.length ? 'cont' : '');
      out.push(frag(tb, blockIndex, false));
    });
    return out;
  }

  function questionFragments(q, index, label, doc, opts) {
    var out = [];
    var isQ = q.kind === 'question';
    var parts = WS.model.hasParts(q);
    var defaultSpace = isQ ? 3 : 4;
    var head = el('div', 'q-head ' + q.kind);
    var lab = el('span', 'q-label', M.escapeHtml(label));
    if (!label) lab.classList.add('empty');
    head.appendChild(lab);
    var body = el('div', 'q-body');
    var qFill = { answer: !parts && !q.table && q.answer ? q.answer : '' };
    var prompt = el('div', 'q-prompt', M.html(q.prompt, withFill(opts, qFill)));
    if (doc.showMarks && isQ) {
      var mk = WS.model.questionMarks(q, doc);
      prompt.insertAdjacentHTML('beforeend',
        '<span class="q-marks">[' + fmtMarks(mk) + (mk === 1 ? ' mark' : ' marks') + ']</span>');
    }
    body.appendChild(prompt);
    head.appendChild(body);
    if (!parts && !q.table) {
      var sp = doc.compact ? 0 : q.space != null ? q.space : defaultSpace;   // compact: work goes on separate paper
      var ans = opts.showAnswers && qFill.answer ? M.inline(q.answer) : '';
      if (sp > 0 || ans || opts.nudge) body.appendChild(spaceEl(sp, ans, null, !!q.lined));
      out.push(frag(head, index, false));
      return out;
    }
    out.push(frag(head, index, true));

    if (parts) {
      var cols = Math.min(4, Math.max(1, +q.columns || 1));
      var boxed = q.boxed !== false;
      var partSpace = q.space != null ? q.space : (boxed ? 2 : 1);
      for (var i = 0; i < q.parts.length; i += cols) {
        var row = el('div', 'parts-row cols-' + cols + (boxed ? ' boxed' : ' plain') + (i > 0 ? ' cont' : ''));
        row.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
        for (var j = i; j < i + cols; j++) {
          var cell = el('div', 'part');
          var p = q.parts[j];
          if (p) {
            var line = el('div', 'p-line');
            line.appendChild(el('span', 'p-label', M.escapeHtml(WS.model.partLabel(j, p))));
            var pFill = { answer: p.answer || '' };
            line.appendChild(el('span', 'p-prompt', M.inline(p.prompt, withFill(opts, pFill))));
            cell.appendChild(line);
            // An open-ended (thinking) part gets at least 3 lines unless set by hand.
            var ps = doc.compact ? 0 : p.space != null ? p.space : (p.thinking ? Math.max(partSpace, 3) : partSpace);
            var pa = opts.showAnswers && pFill.answer ? M.inline(p.answer) : '';
            if (ps > 0 || pa || opts.nudge) cell.appendChild(spaceEl(ps, pa, j, p.lined != null ? !!p.lined : !!q.lined));
          } else {
            cell.classList.add('empty');
          }
          row.appendChild(cell);
        }
        out.push(frag(row, index, false));
      }
    }
    if (q.table) {
      var tf = tableFragments(q.table, index, opts);
      if (parts && tf.length) tf[0].classList.add('after-parts');
      out = out.concat(tf);
    }
    return out;
  }

  function buildFragments(doc, opts) {
    opts = opts || {};
    var labels = WS.model.labels(doc);
    var out = [];
    doc.blocks.forEach(function (b, i) {
      var fr = [];
      switch (b.kind) {
        case 'pageBreak':
          out.push({ pageBreak: true });
          return;
        case 'heading':
          var hEl = el('div', 'ws-heading size-' + (b.size || 'm'), M.inline(b.text));
          hEl.style.textAlign = b.align || 'left';
          fr.push(frag(hEl, i, true));
          break;
        case 'text':
          var chunks = M.blocks(b.content, opts);
          if (!chunks.length) chunks = ['<p class="empty-text">&nbsp;</p>'];
          chunks.forEach(function (c) {
            var t = el('div', 'ws-text', c);
            if (b.align) t.style.textAlign = b.align;
            fr.push(frag(t, i, false));
          });
          break;
        case 'image':
          var fig = el('figure', 'ws-image');
          fig.style.textAlign = b.align || 'center';
          if (b.src) {
            var img = el('img');
            img.src = b.src;
            img.alt = b.alt || b.caption || '';
            img.style.width = Math.max(5, Math.min(100, +b.width || 50)) + '%';
            fig.appendChild(img);
          } else {
            fig.appendChild(el('div', 'img-placeholder', 'No image selected'));
          }
          if (b.caption) fig.appendChild(el('figcaption', null, M.inline(b.caption)));
          fr.push(frag(fig, i, false));
          break;
        case 'table':
          fr = tableFragments(b, i, opts, true);
          break;
        case 'notes':
          // A ruled box for the student's own words (notes, summary, note to future self).
          var nb = el('div', 'ws-notes');
          if (b.title) nb.appendChild(el('div', 'notes-title', M.inline(b.title)));
          if (b.prompt) nb.appendChild(el('div', 'notes-prompt', M.html(b.prompt, opts)));
          nb.appendChild(spaceEl(+b.lines || 0, '', null, !!b.lined));
          fr.push(frag(nb, i, false));
          break;
        case 'question':
        case 'example':
          fr = questionFragments(b, i, labels[i], doc, opts);
          break;
      }
      if (fr.length) fr[0].classList.add('block-start');
      out = out.concat(fr);
    });

    if (doc.answers.handout === 'final') {
      out.push({ pageBreak: true });
      out.push(frag(el('div', 'ws-heading size-m', 'Answers'), null, true));
      out = out.concat(finalAnswerFragments(doc));
    }
    return out;
  }

  function keyLabel(label) {
    var lab = label.replace(/\)$/, '');
    return /^\d+$/.test(lab) ? '#' + lab : lab;
  }

  // "#1: a) ..., b) ..." one line per question.
  function finalAnswerFragments(doc) {
    var key = WS.model.answerKey(doc);
    var out = key.map(function (q) {
      var items = q.items.filter(function (it) { return it.answer; }).map(function (it) {
        return (it.label ? '<span class="ak-part">' + M.escapeHtml(it.label) + '</span>&nbsp;' : '') +
          M.inline(it.answer);
      }).join(',&ensp; ');
      return frag(el('div', 'ak-item', '<span class="ak-q">' + M.escapeHtml(keyLabel(q.label)) + ':</span> ' + items),
        q.blockIndex, false);
    });
    if (!out.length) out.push(frag(el('p', 'ak-empty', 'No answers stored yet.'), null, false));
    return out;
  }

  // Each question with its parts, the worked steps and the final answer.
  function workedFragments(doc) {
    var key = WS.model.answerKey(doc);
    var out = [];
    key.forEach(function (q) {
      var head = el('div', 'wk-q block-start');
      head.appendChild(el('span', 'q-label', M.escapeHtml(q.label)));
      head.appendChild(el('div', 'q-body', M.html(q.prompt || '')));
      out.push(frag(head, q.blockIndex, true));
      // Lay the parts out in the same columns as the questions (at most 4), one
      // fragment per row, so the key uses the page width like the handout does.
      var block = doc.blocks[q.blockIndex] || {};
      // Single-column questions still get two key columns: steps are narrower than the work space.
      var cols = Math.max(1, Math.min(4, Math.max(2, +block.columns || 1), q.items.length));
      var grid = null;
      q.items.forEach(function (it, k) {
        if (k % cols === 0) {
          grid = el('div', 'wk-row');
          grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
          out.push(frag(grid, q.blockIndex, false));
        }
        var row = el('div', 'wk-item');
        row.appendChild(el('span', 'wk-label', it.label ? M.escapeHtml(it.label) : ''));
        var b = el('div', 'wk-body');
        if (it.solution) {
          if (it.prompt) b.appendChild(el('div', 'wk-prompt', M.inline(it.prompt)));
          b.appendChild(el('div', 'wk-steps', M.html(it.solution)));
          if (it.answer) b.appendChild(el('div', 'wk-ans', '<span class="wk-ans-label">Answer:</span> ' + M.inline(it.answer)));
        } else {
          // No steps written: prompt and answer on one line.
          b.appendChild(el('div', 'wk-prompt', (it.prompt ? M.inline(it.prompt) + '&ensp;' : '') +
            (it.answer ? '<span class="wk-ans">' + M.inline(it.answer) + '</span>' : '')));
        }
        row.appendChild(b);
        grid.appendChild(row);
      });
    });
    if (!out.length) out.push(frag(el('p', 'ak-empty', 'No answers or solutions stored yet.'), null, false));
    return out;
  }

  function buildKeyFragments(doc) {
    var worked = doc.answers.key === 'worked';
    var out = [frag(el('div', 'ws-heading size-m', worked ? 'Teacher key: worked solutions' : 'Teacher key: answers'), null, true)];
    return out.concat(worked ? workedFragments(doc) : finalAnswerFragments(doc));
  }

  // ---------- pagination ----------

  function overflows(body, e) {
    return e.offsetTop + e.offsetHeight > body.clientHeight + 0.5;
  }

  function paginate(container, doc, frags, isKey) {
    container.innerHTML = '';
    var pages = [];
    var body = null;

    var inKey = !!isKey;
    function newPage() {
      var first = pages.length === 0;
      var page = el('div', 'page paper-' + doc.paper + (inKey ? ' key-page' : ''));
      page.appendChild(headerEl(doc, !inKey && (first || doc.header.repeat)));
      body = el('div', 'page-body');
      page.appendChild(body);
      page.appendChild(el('div', 'page-footer'));
      container.appendChild(page);
      pages.push(page);
      return body;
    }
    newPage();

    frags.forEach(function (f) {
      if (f.pageBreak) {
        if (body.children.length) newPage();
        return;
      }
      body.appendChild(f);
      if (!overflows(body, f)) return;
      // Move this fragment plus any "keep with next" fragments right before
      // it onto a new page, unless that would leave the current page empty.
      var chain = [f];
      var prev = f.previousElementSibling;
      while (prev && prev._keep) { chain.unshift(prev); prev = prev.previousElementSibling; }
      if (!prev) return; // whole page is one chain: let it overflow
      var nb = newPage();
      chain.forEach(function (c) { nb.appendChild(c); });
    });

    var main = pages.filter(function (p) { return !p.classList.contains('key-page'); });
    var keyPages = pages.filter(function (p) { return p.classList.contains('key-page'); });
    if (doc.footer.pageNumbers) {
      main.forEach(function (p, i) {
        p.querySelector('.page-footer').textContent = (i + 1) + ' out of ' + main.length;
      });
    }
    keyPages.forEach(function (p, i) {
      p.querySelector('.page-footer').textContent = 'Teacher key' +
        (keyPages.length > 1 ? ' · ' + (i + 1) + ' of ' + keyPages.length : '');
    });
    pages.forEach(function (p) {
      var b = p.querySelector('.page-body');
      if (b.scrollHeight > b.clientHeight + 1) p.classList.add('overfull');
    });
    return pages;
  }

  function waitForImages(frags) {
    var imgs = [];
    frags.forEach(function (f) {
      if (f.querySelectorAll) imgs = imgs.concat([].slice.call(f.querySelectorAll('img')));
    });
    return Promise.all(imgs.map(function (img) {
      if (img.complete) return null;
      return new Promise(function (res) { img.onload = img.onerror = res; });
    }));
  }

  // Render `doc` into `container` as pages. Returns a promise of the pages.
  // opts.view: 'handout' (default) or 'key' (the separate teacher key).
  function render(container, doc, opts) {
    opts = opts || {};
    if (WS.themes) WS.themes.apply(container, doc.theme);   // the look; content is below
    var isKey = opts.view === 'key';
    var frags = isKey ? buildKeyFragments(doc) : buildFragments(doc, opts);
    // Images need their size before we can measure; stage them off-screen.
    var staging = el('div', 'staging');
    frags.forEach(function (f) { if (f.nodeType) staging.appendChild(f); });
    document.body.appendChild(staging);
    return waitForImages(frags).then(function () {
      staging.remove();
      return paginate(container, doc, frags, isKey);
    });
  }

  WS.render = { render: render, buildFragments: buildFragments, headerEl: headerEl };
})(window.WS = window.WS || {});
