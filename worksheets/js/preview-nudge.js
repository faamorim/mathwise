/*
 * Layout nudging from the page preview (handout view only).
 *
 *   - Work space: hover a question's or a part's work area and drag the blue bar
 *     at its bottom edge up or down. On a part, the drag sets the work space of
 *     every part of the question; hold Shift to set this part only. Steps of
 *     ¼ line; double-click the bar to go back to the default.
 *   - Table columns: drag the bar on a column's right edge (in the first row of
 *     the table) to make it wider or narrower; the neighbour gives or takes the
 *     difference. Double-click to make all columns equal again.
 *
 * The editor gives `commit(fn)`, which snapshots for Undo, runs fn on the
 * document and re-renders. Nothing here is printed (the bars exist only while
 * hovering, and print CSS hides them).
 */
(function (WS) {
  'use strict';

  var opts = null;
  var bar = null;   // the work-space bar, moved to whichever space is hovered
  var tip = null;   // the floating "2.5 lines" label
  var drag = null;
  var justDragged = false;   // swallow the click that ends a drag

  function doc() { return opts.getDoc(); }
  function enabled() { return opts.enabled(); }

  function blockOf(e) {
    var f = e.closest('.frag[data-block]');
    return f ? +f.dataset.block : -1;
  }

  function lineHeightPx(inside) {
    var page = inside.closest('.page') || inside;
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--line);width:1px;top:0;left:0';
    page.appendChild(probe);
    var h = probe.getBoundingClientRect().height;
    probe.remove();
    return h || 30;
  }

  // The work space the renderer used for block b (part index pi or null).
  function currentSpace(b, pi) {
    var parts = WS.model.hasParts(b);
    if (pi != null && b.parts && b.parts[pi] && b.parts[pi].space != null) return +b.parts[pi].space;
    if (b.space != null) return +b.space;
    if (parts) return b.boxed === false ? 1 : 2;
    return b.kind === 'example' ? 4 : 3;
  }

  function fmt(n) { return (Math.round(n * 100) / 100) + (n === 1 ? ' line' : ' lines'); }

  function showTip(x, y, text) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'nudge-tip'; document.body.appendChild(tip); }
    tip.textContent = text;
    tip.style.left = (x + 14) + 'px';
    tip.style.top = (y + 12) + 'px';
    tip.hidden = false;
  }
  function hideTip() { if (tip) tip.hidden = true; }

  // ---------- work space ----------

  function onOver(ev) {
    if (drag || !enabled()) return;
    var s = ev.target.closest && ev.target.closest('#pages .space');
    if (s && blockOf(s) >= 0) {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'nudge-bar';
        bar.title = 'Drag to change the work space (Shift: this part only). Double-click: default.';
        bar.addEventListener('mousedown', startSpaceDrag);
        bar.addEventListener('dblclick', resetSpace);
        bar.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      if (bar.parentNode !== s) s.appendChild(bar);
    }
    var t = ev.target.closest && ev.target.closest('#pages table.ws-table');
    if (t && blockOf(t) >= 0) addColumnBars(t);
  }

  function spaceTarget(s) {
    var i = blockOf(s);
    var b = doc().blocks[i];
    var pi = s.dataset.part != null ? +s.dataset.part : null;
    return { i: i, b: b, pi: pi };
  }

  function startSpaceDrag(ev) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    var s = bar.parentNode;
    var t = spaceTarget(s);
    if (!t.b) return;
    drag = {
      kind: 'space', t: t, space: s, y0: ev.clientY, px: lineHeightPx(s),
      start: currentSpace(t.b, t.pi), lines: currentSpace(t.b, t.pi), shift: ev.shiftKey
    };
    document.body.classList.add('nudging-v');
    s.classList.add('nudge-active');
  }

  // The space elements a drag changes live: this one, or every part of the
  // question that has no space of its own.
  function liveSpaces(d) {
    var t = d.t;
    if (t.pi == null || d.shift || (t.b.parts[t.pi] && t.b.parts[t.pi].space != null)) return [d.space];
    var all = document.querySelectorAll('#pages .frag[data-block="' + t.i + '"] .space[data-part]');
    return [].filter.call(all, function (e) {
      var p = t.b.parts[+e.dataset.part];
      return p && p.space == null;
    });
  }

  function moveSpace(ev) {
    var d = drag;
    d.shift = d.shift || ev.shiftKey;
    var lines = Math.max(0, Math.round((d.start + (ev.clientY - d.y0) / d.px) * 4) / 4);
    d.lines = lines;
    liveSpaces(d).forEach(function (e) { e.style.minHeight = 'calc(var(--line) * ' + lines + ')'; });
    var who = d.t.pi == null ? '' : (liveSpaces(d).length > 1 ? ' · every part' : ' · this part');
    showTip(ev.clientX, ev.clientY, 'Work space: ' + fmt(lines) + who);
  }

  function endSpace() {
    var d = drag;
    var t = d.t;
    if (d.lines === d.start) { opts.refresh(); return; }
    opts.commit(function () {
      var b = doc().blocks[t.i];
      if (t.pi != null && (d.shift || (b.parts[t.pi] && b.parts[t.pi].space != null))) b.parts[t.pi].space = d.lines;
      else b.space = d.lines;
    });
  }

  function resetSpace(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var t = spaceTarget(bar.parentNode);
    if (!t.b) return;
    opts.commit(function () {
      var b = doc().blocks[t.i];
      if (t.pi != null && b.parts[t.pi] && b.parts[t.pi].space != null) delete b.parts[t.pi].space;
      else delete b.space;
    });
  }

  // ---------- table columns ----------

  function tableOf(b) { return b && (b.kind === 'table' ? b : b.table); }

  // Data cells (no row-label cell) of the first row of a rendered table.
  function dataCells(table, t) {
    var row = table.rows[0];
    if (!row) return [];
    var cells = [].slice.call(row.cells);
    return t.rowLabels ? cells.slice(1) : cells;
  }

  function addColumnBars(table) {
    var i = blockOf(table);
    var t = tableOf(doc().blocks[i]);
    if (!t || table.querySelector('.nudge-col')) return;
    var cells = dataCells(table, t);
    cells.slice(0, -1).forEach(function (c, k) {
      var h = document.createElement('div');
      h.className = 'nudge-col';
      h.title = 'Drag to change the column width. Double-click: equal columns.';
      h.addEventListener('mousedown', function (ev) { startColDrag(ev, table, i, k); });
      h.addEventListener('dblclick', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        opts.commit(function () { delete tableOf(doc().blocks[i]).widths; });
      });
      h.addEventListener('click', function (e) { e.stopPropagation(); });
      c.appendChild(h);
    });
  }

  function startColDrag(ev, table, i, k) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    var t = tableOf(doc().blocks[i]);
    var px = dataCells(table, t).map(function (c) { return c.getBoundingClientRect().width; });
    drag = { kind: 'col', i: i, k: k, x0: ev.clientX, px: px, now: px.slice() };
    document.body.classList.add('nudging-h');
  }

  function applyCols(i, widths) {
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var t = tableOf(doc().blocks[i]);
    document.querySelectorAll('#pages .frag[data-block="' + i + '"] table.ws-table, #pages table.ws-table.frag[data-block="' + i + '"]')
      .forEach(function (tb) {
        var cols = tb.querySelectorAll('col');
        var off = t.rowLabels ? 1 : 0;
        widths.forEach(function (w, n) { if (cols[n + off]) cols[n + off].style.width = (100 * w / total) + '%'; });
      });
  }

  function moveCol(ev) {
    var d = drag;
    var dx = ev.clientX - d.x0;
    var pair = d.px[d.k] + d.px[d.k + 1];
    var min = Math.max(12, 0.05 * d.px.reduce(function (a, b) { return a + b; }, 0));
    var a = Math.min(pair - min, Math.max(min, d.px[d.k] + dx));
    d.now = d.px.slice();
    d.now[d.k] = a;
    d.now[d.k + 1] = pair - a;
    applyCols(d.i, d.now);
    var total = d.now.reduce(function (x, y) { return x + y; }, 0);
    showTip(ev.clientX, ev.clientY, d.now.map(function (w) { return Math.round(100 * w / total) + '%'; }).join(' · '));
  }

  function endCol() {
    var d = drag;
    var total = d.now.reduce(function (x, y) { return x + y; }, 0);
    var pct = d.now.map(function (w) { return Math.max(1, Math.round(100 * w / total)); });
    if (JSON.stringify(d.now) === JSON.stringify(d.px)) { opts.refresh(); return; }
    opts.commit(function () { tableOf(doc().blocks[d.i]).widths = pct; });
  }

  // ---------- wiring ----------

  function onMove(ev) {
    if (!drag) return;
    ev.preventDefault();
    if (drag.kind === 'space') moveSpace(ev); else moveCol(ev);
  }

  function onUp() {
    if (!drag) return;
    var d = drag;
    document.body.classList.remove('nudging-v', 'nudging-h');
    hideTip();
    try { if (d.kind === 'space') endSpace(); else endCol(); }
    finally { drag = null; justDragged = true; setTimeout(function () { justDragged = false; }, 0); }
  }

  /**
   * opts.pane:     the preview pane element
   * opts.getDoc(): the current document
   * opts.enabled(): whether nudging is on (handout view)
   * opts.commit(fn): snapshot, run fn, mark changed, re-render
   * opts.refresh(): re-render without changes (after a drag that changed nothing)
   */
  function attach(o) {
    opts = o;
    o.pane.addEventListener('mouseover', onOver);
    o.pane.addEventListener('click', function (ev) {
      if (justDragged) { ev.stopPropagation(); ev.preventDefault(); }
    }, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  WS.nudge = { attach: attach };
})(window.WS = window.WS || {});
