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

  // Compact sheets (work on separate paper): "5^{-1} =" reads as "5^{-1}".
  // Only a trailing equals sign goes; prompts with fill-in blanks are kept.
  // A graph beside or below `textEl` (its `place`); returns what to put in the page.
  function withGraph(textEl, g, opts) {
    var ge = g && WS.graph ? WS.graph.el(g, { key: !!opts.showAnswers }) : null;
    if (!ge) return [textEl];
    if (g.place === 'right' || g.place === 'left') {
      var row = el('div', 'q-graph-row' + (g.place === 'left' ? ' left' : ''));
      textEl.classList.add('q-graph-text');
      if (g.place === 'left') { row.appendChild(ge); row.appendChild(textEl); }
      else { row.appendChild(textEl); row.appendChild(ge); }
      return [row];
    }
    return [textEl, ge];
  }

  // Matching cards A, B, C... under the prompt (`choices`), one element per row.
  function choiceLetter(i, c) { return (c && c.label) || String.fromCharCode(65 + i); }
  function choiceRows(q, opts, paper) {
    var list = Array.isArray(q.choices) ? q.choices : [];
    if (!list.length) return [];
    var cut = !!q.cut;
    var cols = Math.max(1, Math.min(4, +q.choiceColumns || (cut ? 3 : 4), list.length));
    var avail = (paper === "a4" ? 166 : 171) - (cut ? 4 : 2) * cols;
    // Which parts go with each card (shown in the key).
    var matched = list.map(function () { return []; });
    if (opts.showAnswers && q.parts) q.parts.forEach(function (p, j) {
      String(p.answer || '').split(/[\s,;]+/).forEach(function (a) {
        list.forEach(function (c, i) { if (a && a.toUpperCase() === choiceLetter(i, c).toUpperCase()) matched[i].push(WS.model.partLabel(j, p)); });
      });
    });
    var rows = [];
    for (var i = 0; i < list.length; i += cols) {
      var row = el('div', 'choices' + (cut ? ' cut' : ''));
      row.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
      for (var j = i; j < i + cols; j++) {
        var c = list[j];
        if (!c) { row.appendChild(el('div', 'choice-card empty')); continue; }
        var card = el('div', 'choice-card');
        var top = el('div', 'choice-head');
        top.appendChild(el('span', 'choice-label', M.escapeHtml(choiceLetter(j, c))));
        if (c.text) top.appendChild(el('div', 'choice-text', M.html(c.text)));
        card.appendChild(top);
        if (c.graph && WS.graph) {
          var ge = WS.graph.el(c.graph, { key: !!opts.showAnswers, maxWidth: avail / cols - 6 });
          if (ge) card.appendChild(ge);
        }
        if (matched[j].length) card.appendChild(el('div', 'choice-key', '= ' + M.escapeHtml(matched[j].join(', '))));
        row.appendChild(card);
      }
      rows.push(row);
    }
    return rows;
  }

  function noTrailingEquals(src) {
    src = String(src == null ? '' : src);
    if (src.indexOf('[[') >= 0) return src;
    return src.replace(/\s*=\s*\$\$\s*$/, '$$$$').replace(/\s*=\s*\$\s*$/, '$$').replace(/\s*=\s*$/, '');
  }

  // Rough length of a prompt as printed (for choosing columns on compact sheets).
  function printedLength(src) {
    return String(src || '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}$^_\\]/g, '').length;
  }

  function questionFragments(q, index, label, doc, opts) {
    var compact = !!doc.compact;
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
    var prompt = el('div', 'q-prompt', M.html(compact && !parts ? noTrailingEquals(q.prompt) : q.prompt, withFill(opts, qFill)));
    if (doc.showMarks && isQ) {
      var mk = WS.model.questionMarks(q, doc);
      prompt.insertAdjacentHTML('beforeend',
        '<span class="q-marks">[' + fmtMarks(mk) + (mk === 1 ? ' mark' : ' marks') + ']</span>');
    }
    withGraph(prompt, q.graph, opts).forEach(function (e) { body.appendChild(e); });
    head.appendChild(body);
    var choices = choiceRows(q, opts, doc.paper);
    if (!parts && !q.table) {
      choices.forEach(function (r) { body.appendChild(r); });
      var sp = doc.compact ? 0 : q.space != null ? q.space : defaultSpace;   // compact: work goes on separate paper
      var ans = opts.showAnswers && qFill.answer ? M.inline(q.answer) : '';
      if (sp > 0 || ans || opts.nudge) body.appendChild(spaceEl(sp, ans, null, !!q.lined));
      out.push(frag(head, index, false));
      return out;
    }
    out.push(frag(head, index, true));
    choices.forEach(function (r) { out.push(frag(r, index, true)); });

    if (parts) {
      var cols = Math.min(4, Math.max(1, +q.columns || 1));
      var boxed = q.boxed !== false;
      if (compact) {
        // No work space: no boxes, and short parts sit four to a row.
        boxed = false;
        var longest = Math.max.apply(null, q.parts.map(function (pp) { return printedLength(noTrailingEquals(pp.prompt)); }));
        cols = Math.max(cols, longest <= 12 ? 4 : longest <= 18 ? 3 : cols);
      }
      var partSpace = q.space != null ? q.space : choices.length ? 0 : (boxed ? 2 : 1);
      var cutParts = !!q.cut && choices.length > 0;
      for (var i = 0; i < q.parts.length; i += cols) {
        var row = el('div', 'parts-row cols-' + cols + (cutParts ? ' cut' : boxed ? ' boxed' : ' plain') + (i > 0 ? ' cont' : ''));
        row.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
        for (var j = i; j < i + cols; j++) {
          var cell = el('div', 'part');
          var p = q.parts[j];
          if (p) {
            var line = el('div', 'p-line');
            line.appendChild(el('span', 'p-label', M.escapeHtml(WS.model.partLabel(j, p))));
            var pFill = { answer: p.answer || '' };
            line.appendChild(el('span', 'p-prompt', M.inline(compact ? noTrailingEquals(p.prompt) : p.prompt, withFill(opts, pFill))));
            if (choices.length) {
              // Matching: a box for the card's letter.
              line.appendChild(el('span', 'match-blank', opts.showAnswers && p.answer ? M.inline(p.answer) : ''));
            }
            withGraph(line, p.graph, opts).forEach(function (e) { cell.appendChild(e); });
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
    var out = [];
    key.forEach(function (q) {
      var items = q.items.filter(function (it) { return it.answer; }).map(function (it) {
        return (it.label ? '<span class="ak-part">' + M.escapeHtml(it.label) + '</span>&nbsp;' : '') +
          M.inline(it.answer);
      }).join(',&ensp; ');
      out.push(frag(el('div', 'ak-item', '<span class="ak-q">' + M.escapeHtml(keyLabel(q.label)) + ':</span> ' + items),
        q.blockIndex, false));
      // Answers drawn on a graph: small copies under the line.
      var withG = (q.graph ? [{ label: '', graph: q.graph }] : []).concat(q.items).filter(function (it) {
        return it.graph && WS.graph && WS.graph.hasKeyItems(it.graph);
      });
      if (withG.length) {
        var row = el('div', 'ak-graphs');
        withG.forEach(function (it) {
          var ge = WS.graph.el(it.graph, { key: true, scale: 0.6 });
          if (!ge) return;
          var box = el('div', 'ak-graph');
          if (it.label) box.appendChild(el('span', 'ak-part', M.escapeHtml(it.label)));
          box.appendChild(ge);
          row.appendChild(box);
        });
        out.push(frag(row, q.blockIndex, false));
      }
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
      var qb = el('div', 'q-body', M.html(q.prompt || ''));
      choiceRows(doc.blocks[q.blockIndex] || {}, { showAnswers: true }, doc.paper).forEach(function (r) { qb.appendChild(r); });
      if (q.graph && WS.graph && WS.graph.hasKeyItems(q.graph)) {
        var qg = WS.graph.el(q.graph, { key: true });
        if (qg) qb.appendChild(qg);
      }
      head.appendChild(qb);
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
        if (it.graph && WS.graph && WS.graph.hasKeyItems(it.graph)) {
          var ig = WS.graph.el(it.graph, { key: true });
          if (ig) b.appendChild(ig);
        }
        row.appendChild(b);
        grid.appendChild(row);
      });
    });
    if (!out.length) out.push(frag(el('p', 'ak-empty', 'No answers or solutions stored yet.'), null, false));
    return out;
  }

  function keyName(doc) { return doc.answers.keyTitle === 'solutions' ? 'Solutions' : 'Teacher key'; }

  // The separate key: final answers, worked solutions, or both (a quick answers page
  // to check with, then the worked solutions for when a student is stuck).
  function buildKeyFragments(doc) {
    var mode = doc.answers.key;
    var name = keyName(doc);
    function heading(t) { return frag(el('div', 'ws-heading size-m', name + ': ' + t), null, true); }
    if (mode === 'worked') return [heading('worked solutions')].concat(workedFragments(doc));
    var out = [heading('answers')].concat(finalAnswerFragments(doc));
    if (mode === 'both') out = out.concat([{ pageBreak: true }, heading('worked solutions')], workedFragments(doc));
    return out;
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
      p.querySelector('.page-footer').textContent = keyName(doc) +
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
    container.classList.toggle('compact', !!doc.compact && opts.view !== 'key');
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
