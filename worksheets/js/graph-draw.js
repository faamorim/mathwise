/*
 * Draws a graph (docs/graph-format.md) as an SVG at its print size.
 *
 *   WS.graph.el(graph, { key, scale }) -> element, or null when there is nothing
 *   to show (a key-only graph outside the key, or a graph that does not check).
 *
 * The maths (curves, ticks) comes from Mathwise.graph in generators/graph.js;
 * this file only maps graph units to millimetres. Numbers are SVG text; labels and
 * titles use worksheet markup ($...$), so they sit in an HTML layer on top.
 */
(function (WS) {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var NUM = 2.7;        // number size, mm
  var ARROW = 2.2;      // arrow head length, mm

  function lib() { return window.Mathwise && window.Mathwise.graph; }
  function s(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    return e;
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function hasKeyItems(g) {
    return !!(g && (g.key || (g.items || []).some(function (it) { return it && it.key; })));
  }

  function problems(g) {
    if (!lib()) return ['The graph library is not loaded.'];
    try { return lib().check(g) || []; } catch (e) { return [e.message || String(e)]; }
  }

  function el(g, opts) {
    opts = opts || {};
    if (!g || typeof g !== 'object') return null;
    if (g.key && !opts.key) return null;
    var errs = problems(g);
    if (errs.length) {
      var bad = document.createElement('div');
      bad.className = 'ws-graph-error';
      bad.textContent = 'Graph: ' + errs.join(' ');
      return bad;
    }
    var G = lib();
    var data = G.sample(g, { key: !!opts.key });
    var size = g.size || [6, 6];
    var W = size[0] * 10, H = size[1] * 10;
    var xa = g.x, ya = g.y;
    var mode = g.axes || 'zero';
    var arrows = g.arrows != null ? !!g.arrows : mode === 'zero';
    // Where the axes cross: at 0, or along the bottom / left edge.
    var axisY = mode === 'edge' || !(ya.min <= 0 && ya.max >= 0) ? ya.min : 0;
    var axisX = mode === 'edge' || !(xa.min <= 0 && xa.max >= 0) ? xa.min : 0;
    var showAxes = mode !== 'none';
    var xNums = showAxes && xa.numbers !== false, yNums = showAxes && ya.numbers !== false;
    var reach = arrows ? ARROW + 1.5 : 1.5;

    var m = {
      top: 2 + (showAxes && (arrows || ya.label) ? Math.max(reach, ya.label ? 5 : 0) : 0) + (g.title ? 6 : 0),
      right: 2 + (showAxes ? Math.max(reach, xa.label ? 6 : 0) : 0),
      bottom: 2 + (xNums && axisY === ya.min ? 4.5 : showAxes ? reach - 1.5 : 0) + (xa.title ? 5.5 : 0),
      left: 2 + (yNums && axisX === xa.min ? 6.5 : showAxes ? reach - 1.5 : 0) + (ya.title ? 5.5 : 0)
    };
    var TW = W + m.left + m.right, TH = H + m.top + m.bottom;
    function X(v) { return m.left + (v - xa.min) / (xa.max - xa.min) * W; }
    function Y(v) { return m.top + (ya.max - v) / (ya.max - ya.min) * H; }

    var svg = s('svg', { viewBox: '0 0 ' + r2(TW) + ' ' + r2(TH), class: 'ws-graph-svg', 'aria-hidden': 'true' });

    // Grid
    if (g.grid !== false) {
      var grid = s('g', { class: 'g-grid' });
      function lines(a, vertical) {
        var step = a.grid == null ? 1 : +a.grid;
        if (!(step > 0) || (a.max - a.min) / step > 200) return;
        for (var v = Math.ceil(a.min / step - 1e-9) * step; v <= a.max + 1e-9; v += step) {
          grid.appendChild(vertical
            ? s('line', { x1: r2(X(v)), y1: r2(m.top), x2: r2(X(v)), y2: r2(m.top + H) })
            : s('line', { x1: r2(m.left), y1: r2(Y(v)), x2: r2(m.left + W), y2: r2(Y(v)) }));
        }
      }
      lines(xa, true); lines(ya, false);
      svg.appendChild(grid);
    }

    function arrowHead(x, y, dx, dy, cls) {
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len; dy /= len;
      var bx = x - dx * ARROW, by = y - dy * ARROW, w = ARROW * 0.38;
      return s('path', { class: cls, d: 'M' + r2(x) + ' ' + r2(y) + 'L' + r2(bx - dy * w) + ' ' + r2(by + dx * w) +
        'L' + r2(bx + dy * w) + ' ' + r2(by - dx * w) + 'Z' });
    }

    // Axes, numbers, breaks
    if (showAxes) {
      var ax = s('g', { class: 'g-axes' });
      var ext = arrows ? ARROW + 0.8 : 0;
      var x0 = X(xa.min) - (arrows && mode === 'zero' && axisX !== xa.min ? ext : 0), x1 = X(xa.max) + ext;
      var y0 = Y(ya.min) + (arrows && mode === 'zero' && axisY !== ya.min ? ext : 0), y1 = Y(ya.max) - ext;
      ax.appendChild(s('line', { x1: r2(x0), y1: r2(Y(axisY)), x2: r2(x1), y2: r2(Y(axisY)) }));
      ax.appendChild(s('line', { x1: r2(X(axisX)), y1: r2(y0), x2: r2(X(axisX)), y2: r2(y1) }));
      if (arrows) {
        ax.appendChild(arrowHead(x1, Y(axisY), 1, 0, 'g-arrow'));
        ax.appendChild(arrowHead(X(axisX), y1, 0, -1, 'g-arrow'));
        if (mode === 'zero' && axisX !== xa.min) ax.appendChild(arrowHead(x0, Y(axisY), -1, 0, 'g-arrow'));
        if (mode === 'zero' && axisY !== ya.min) ax.appendChild(arrowHead(X(axisX), y0, 0, 1, 'g-arrow'));
      }
      function zig(cx, cy, vertical) {
        var d = vertical
          ? 'M' + r2(cx) + ' ' + r2(cy + 1.6) + 'l-1.1 -0.55l2.2 -1.1l-2.2 -1.1l2.2 -1.1l-1.1 -0.55'
          : 'M' + r2(cx - 1.6) + ' ' + r2(cy) + 'l0.55 -1.1l1.1 2.2l1.1 -2.2l1.1 2.2l0.55 -1.1';
        var gap = vertical ? s('rect', { x: r2(cx - 1.3), y: r2(cy - 1.6), width: 2.6, height: 3.2, class: 'g-gap' })
          : s('rect', { x: r2(cx - 1.6), y: r2(cy - 1.3), width: 3.2, height: 2.6, class: 'g-gap' });
        ax.appendChild(gap);
        ax.appendChild(s('path', { d: d, class: 'g-break' }));
      }
      if (xa.break) zig(X(xa.min) + Math.min(4, W / 6), Y(axisY), false);
      if (ya.break) zig(X(axisX), Y(ya.min) - Math.min(4, H / 6), true);
      svg.appendChild(ax);

      var nums = s('g', { class: 'g-nums', 'font-size': NUM });
      var crossAtZero = axisX === 0 && axisY === 0;
      var zeroMode = mode === 'zero';   // crossing in the middle: no 0 at all; on the edge: one 0, under the corner
      if (xNums) G.ticks(xa).forEach(function (t) {
        if (crossAtZero && zeroMode && t.at === 0) return;
        nums.appendChild(s('line', { x1: r2(X(t.at)), y1: r2(Y(axisY) - 0.7), x2: r2(X(t.at)), y2: r2(Y(axisY) + 0.7), class: 'g-tick' }));
        var tx = s('text', { x: r2(X(t.at)), y: r2(Y(axisY) + 1.2 + NUM * 0.8), 'text-anchor': 'middle' });
        tx.textContent = t.text;
        nums.appendChild(tx);
      });
      if (yNums) G.ticks(ya).forEach(function (t) {
        if (crossAtZero && t.at === 0 && (zeroMode || xNums)) return;
        nums.appendChild(s('line', { x1: r2(X(axisX) - 0.7), y1: r2(Y(t.at)), x2: r2(X(axisX) + 0.7), y2: r2(Y(t.at)), class: 'g-tick' }));
        var ty = s('text', { x: r2(X(axisX) - 1.2), y: r2(Y(t.at) + NUM * 0.35), 'text-anchor': 'end' });
        ty.textContent = t.text;
        nums.appendChild(ty);
      });
      svg.appendChild(nums);
    }

    // Lines, then dots on top
    var marks = s('g', { class: 'g-marks' });
    data.lines.forEach(function (ln) {
      var pts = ln.points || [];
      if (pts.length < 2) return;
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + r2(X(p[0])) + ' ' + r2(Y(p[1])); }).join('');
      var cls = 'g-line' + (ln.key ? ' key' : '') + (ln.style === 'dashed' ? ' dashed' : '');
      marks.appendChild(s('path', { d: d, class: cls }));
      var ends = ln.ends || [];
      function headAt(a, b) {
        var ax2 = X(pts[a][0]), ay2 = Y(pts[a][1]), bx2 = X(pts[b][0]), by2 = Y(pts[b][1]);
        marks.appendChild(arrowHead(ax2, ay2, ax2 - bx2, ay2 - by2, 'g-head' + (ln.key ? ' key' : '')));
      }
      // Use a point a little way back so curved ends point the right way.
      function back(from, dir) {
        var i = from, tx = X(pts[from][0]), ty = Y(pts[from][1]);
        while (i + dir >= 0 && i + dir < pts.length) {
          i += dir;
          var dx = X(pts[i][0]) - tx, dy = Y(pts[i][1]) - ty;
          if (dx * dx + dy * dy >= 1) break;
        }
        return i;
      }
      if (ends[0] === 'arrow') headAt(0, back(0, 1));
      if (ends[1] === 'arrow') headAt(pts.length - 1, back(pts.length - 1, -1));
    });
    data.dots.forEach(function (dt) {
      marks.appendChild(s('circle', { cx: r2(X(dt.at[0])), cy: r2(Y(dt.at[1])), r: 0.85,
        class: 'g-dot' + (dt.open ? ' open' : '') + (dt.key ? ' key' : '') }));
    });
    svg.appendChild(marks);

    // HTML layer for markup: labels, titles, free text.
    var wrap = document.createElement('div');
    wrap.className = 'ws-graph' + (opts.key && hasKeyItems(g) ? ' has-key' : '');
    var scale = opts.scale || 1;
    wrap.style.width = r2(TW * scale) + 'mm';
    if (scale < 1) wrap.style.fontSize = Math.round(scale * 110) + '%';
    wrap.appendChild(svg);
    function put(x, y, html, cls, tf) {
      var e = document.createElement('div');
      e.className = 'g-label ' + (cls || '');
      e.style.left = r2(x / TW * 100) + '%';
      e.style.top = r2(y / TH * 100) + '%';
      if (tf) e.style.transform = tf;
      e.innerHTML = html;
      wrap.appendChild(e);
      return e;
    }
    var M = WS.markup;
    if (g.title) put(m.left + W / 2, 0.5, M.inline(g.title), 'g-title', 'translate(-50%, 0)');
    if (showAxes) {
      if (xa.label) put(X(xa.max) + (arrows ? ARROW + 1.4 : 1.2), Y(axisY), M.inline(xa.label), 'g-axis-label', 'translate(0, -50%)');
      if (ya.label) put(X(axisX), Y(ya.max) - (arrows ? ARROW + 1.2 : 1), M.inline(ya.label), 'g-axis-label', 'translate(-50%, -100%)');
    }
    if (xa.title) put(m.left + W / 2, TH - 0.4, M.inline(xa.title), 'g-axis-title', 'translate(-50%, -100%)');
    if (ya.title) put(2.75, m.top + H / 2, M.inline(ya.title), 'g-axis-title y', 'translate(-50%, -50%) rotate(-90deg)');
    data.lines.forEach(function (ln) {
      if (!ln.label || !ln.labelAt) return;
      // Beside the point, on the side away from the line.
      var pts = ln.points, best = 0, bd = Infinity;
      pts.forEach(function (p, i) {
        var d = Math.abs(p[0] - ln.labelAt[0]) + Math.abs(p[1] - ln.labelAt[1]);
        if (d < bd) { bd = d; best = i; }
      });
      var a = pts[Math.max(0, best - 1)], b = pts[Math.min(pts.length - 1, best + 1)];
      var rising = (Y(b[1]) - Y(a[1])) * (X(b[0]) - X(a[0])) < 0;   // up to the right on paper
      // Rising lines leave the upper left and lower right free; falling lines the other two.
      var right = m.left + W - X(ln.labelAt[0]) > 4 + String(ln.label).replace(/[$\\{}]/g, "").length * 1.6;   // room for it on the right?
      var below = rising === right;
      put(X(ln.labelAt[0]), Y(ln.labelAt[1]), M.inline(ln.label), 'g-line-label' + (ln.key ? ' key' : ''),
        'translate(' + (right ? '1.4mm' : 'calc(-100% - 1.4mm)') + ', ' + (below ? '0.6mm' : 'calc(-100% - 0.6mm)') + ')');
    });
    data.dots.forEach(function (dt) {
      if (!dt.label) return;
      put(X(dt.at[0]) + 1.1, Y(dt.at[1]) - 0.9, M.inline(dt.label), 'g-dot-label' + (dt.key ? ' key' : ''), 'translate(0, -100%)');
    });
    data.texts.forEach(function (t) {
      put(X(t.at[0]), Y(t.at[1]), M.inline(t.text), 'g-text' + (t.key ? ' key' : ''), 'translate(-50%, -50%)');
    });
    return wrap;
  }

  WS.graph = { el: el, hasKeyItems: hasKeyItems, problems: problems };
})(window.WS = window.WS || {});
