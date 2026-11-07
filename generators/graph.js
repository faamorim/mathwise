/*
 * Graph helpers shared by generators and pages: check a graph object, turn a
 * function expression into points, list axis ticks. The format is described in
 * docs/graph-format.md. Pages draw what sample() returns; they never parse maths.
 * Classic script, no dependencies.
 */
(function (root) {
  'use strict';
  var MW = root.Mathwise = root.Mathwise || {};

  // ---------- expression language: numbers, x, + - * / ^, ( ), sqrt, abs ----------

  function tokenize(src) {
    var s = String(src).replace(/\s+/g, ''), out = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i);
      if ((m = /^\d+(\.\d+)?|^\.\d+/.exec(rest))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^(sqrt|abs)/.exec(rest))) { out.push({ t: 'fn', v: m[0] }); i += m[0].length; continue; }
      if (s[i] === 'x') { out.push({ t: 'x' }); i++; continue; }
      if ('+-*/^()'.indexOf(s[i]) >= 0) { out.push({ t: s[i] }); i++; continue; }
      throw new Error('Cannot read "' + rest + '" in ' + src);
    }
    return out;
  }

  // Returns a tree; evaluated by run(). Grammar (low to high):
  //   sum := term (('+'|'-') term)*      term := unary (('*'|'/') unary)*
  //   unary := '-' unary | implicit      implicit := power power*   (2x, 3(x-1), x(x+1))
  //   power := atom ('^' unary)?         atom := num | x | fn '(' sum ')' | '(' sum ')'
  // Board convention: a number divided by a number right before x is a coefficient,
  // so 1/2x = (1/2)x and -3/4x = (-3/4)x.
  function parse(src) {
    var tk = tokenize(src), p = 0;
    function peek() { return tk[p] && tk[p].t; }
    function eat(t) { if (peek() !== t) throw new Error('Expected ' + t + ' in ' + src); return tk[p++]; }
    function atom() {
      var k = peek();
      if (k === 'num') return { n: tk[p++].v };
      if (k === 'x') { p++; return { x: true }; }
      if (k === 'fn') { var f = tk[p++].v; eat('('); var a = sum(); eat(')'); return { f: f, a: a }; }
      if (k === '(') { p++; var e = sum(); eat(')'); return e; }
      throw new Error('Unexpected ' + (k || 'end') + ' in ' + src);
    }
    function power() {
      var b = atom();
      if (peek() === '^') { p++; return { op: '^', a: b, b: unary() }; }
      return b;
    }
    function implicit() {
      var v = power();
      while (peek() === 'x' || peek() === '(' || peek() === 'fn') v = { op: '*', a: v, b: power() };
      return v;
    }
    function unary() {
      if (peek() === '-') { p++; return { op: 'neg', a: unary() }; }
      if (peek() === '+') { p++; return unary(); }
      return implicit();
    }
    function term() {
      var v = unary();
      for (;;) {
        if (peek() === '*') { p++; v = { op: '*', a: v, b: unary() }; }
        else if (peek() === '/') {
          p++;
          // 1/2x: number / number followed by x or ( -> coefficient
          if (peek() === 'num' && tk[p + 1] && (tk[p + 1].t === 'x' || tk[p + 1].t === '(')) {
            var d = { n: tk[p++].v };
            v = { op: '*', a: { op: '/', a: v, b: d }, b: implicitRest() };
          } else v = { op: '/', a: v, b: unary() };
        } else return v;
      }
    }
    function implicitRest() {
      var v = power();
      while (peek() === 'x' || peek() === '(' || peek() === 'fn') v = { op: '*', a: v, b: power() };
      return v;
    }
    function sum() {
      var v = term();
      for (;;) {
        if (peek() === '+') { p++; v = { op: '+', a: v, b: term() }; }
        else if (peek() === '-') { p++; v = { op: '-', a: v, b: term() }; }
        else return v;
      }
    }
    var tree = sum();
    if (p !== tk.length) throw new Error('Unread input in ' + src);
    return tree;
  }

  function run(e, x) {
    if (e.n !== undefined) return e.n;
    if (e.x) return x;
    if (e.f === 'sqrt') { var a = run(e.a, x); return a < 0 ? NaN : Math.sqrt(a); }
    if (e.f === 'abs') return Math.abs(run(e.a, x));
    var l = run(e.a, x);
    switch (e.op) {
      case 'neg': return -l;
      case '+': return l + run(e.b, x);
      case '-': return l - run(e.b, x);
      case '*': return l * run(e.b, x);
      case '/': return l / run(e.b, x);
      case '^': return Math.pow(l, run(e.b, x));
    }
    throw new Error('Bad expression');
  }

  function compile(expr) {
    var tree = parse(expr);
    return function (x) { return run(tree, x); };
  }

  // ---------- checking ----------

  var ENDS = ['arrow', 'closed', 'open', 'none'];
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isPt(p) { return Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1]); }

  function check(g) {
    var errs = [];
    if (!g || typeof g !== 'object') return ['A graph must be an object.'];
    ['x', 'y'].forEach(function (k) {
      var a = g[k];
      if (!a || !isNum(a.min) || !isNum(a.max) || a.min >= a.max) errs.push('The ' + k + '-axis needs min smaller than max.');
      else {
        if (a.grid != null && !(isNum(a.grid) && a.grid > 0)) errs.push('The ' + k + '-axis grid must be a positive number.');
        if (a.numbers != null && a.numbers !== false && !(isNum(a.numbers) && a.numbers > 0)) errs.push('The ' + k + '-axis numbers must be a positive number or false.');
        if (a.grid && (a.max - a.min) / a.grid > 200) errs.push('The ' + k + '-axis has too many grid lines.');
      }
    });
    if (g.size != null && !(Array.isArray(g.size) && g.size.length === 2 && g.size.every(function (v) { return isNum(v) && v > 0 && v <= 30; }))) errs.push('size must be [width, height] in cm (up to 30).');
    if (g.axes != null && ['zero', 'edge', 'none'].indexOf(g.axes) < 0) errs.push('axes must be zero, edge or none.');
    if (g.place != null && ['below', 'right', 'left'].indexOf(g.place) < 0) errs.push('place must be below, right or left.');
    (g.items || []).forEach(function (it, i) {
      var w = 'Item ' + (i + 1) + ': ';
      if (it.ends != null && !(Array.isArray(it.ends) && it.ends.length === 2 && it.ends.every(function (e) { return ENDS.indexOf(e) >= 0; }))) errs.push(w + 'ends must be two of ' + ENDS.join(', ') + '.');
      if (it.type === 'function') {
        try { compile(it.expr); } catch (e) { errs.push(w + 'cannot read the function "' + it.expr + '".'); }
        if (it.domain != null && !(Array.isArray(it.domain) && it.domain.length === 2 && isNum(it.domain[0]) && isNum(it.domain[1]) && it.domain[0] < it.domain[1])) errs.push(w + 'domain must be [from, to].');
      } else if (it.type === 'points') {
        if (!Array.isArray(it.points) || !it.points.every(isPt)) errs.push(w + 'points must be a list of [x, y] (or [x, y, "name"]).');
      } else if (it.type === 'segment') {
        if (!isPt(it.from) || !isPt(it.to)) errs.push(w + 'a segment needs from and to as [x, y].');
      } else if (it.type === 'text') {
        if (!isPt(it.at) || typeof it.text !== 'string') errs.push(w + 'text needs at [x, y] and text.');
      } else errs.push(w + 'unknown type "' + it.type + '".');
    });
    return errs;
  }

  // ---------- what to draw ----------

  // Numbered tick positions of an axis: multiples of `numbers` inside the range (not 0
  // when both axes cross there), or the custom ticks.
  function ticks(a) {
    if (a.ticks) return a.ticks.map(function (t) { return { at: t.at, text: String(t.text) }; });
    var step = a.numbers === undefined ? (a.grid || 1) : a.numbers;
    if (!step) return [];
    var out = [];
    for (var v = Math.ceil(a.min / step - 1e-9) * step; v <= a.max + 1e-9; v += step) {
      var r = Math.round(v / step) * step;
      r = Math.round(r * 1e9) / 1e9;
      out.push({ at: r, text: String(r).replace('-', '−') });
    }
    return out;
  }

  // Points of y = f(x) over [a, b], cut into pieces where the curve leaves the plane
  // (a little past the edge, so lines reach the border) or is undefined.
  function curve(f, a, b, g) {
    var ymin = g.y.min, ymax = g.y.max, pad = (ymax - ymin) * 0.02;
    var n = 400, pieces = [], cur = [];
    for (var i = 0; i <= n; i++) {
      var x = a + (b - a) * i / n, y = f(x);
      var inside = isFinite(y) && y >= ymin - pad && y <= ymax + pad;
      if (inside) cur.push([round(x), round(y)]);
      else if (cur.length) { pieces.push(cur); cur = []; }
    }
    if (cur.length) pieces.push(cur);
    return pieces.filter(function (p) { return p.length > 1; });
  }
  function round(v) { return Math.round(v * 1e6) / 1e6; }

  function sample(g, opts) {
    var withKey = !!(opts && opts.key);
    var out = { lines: [], dots: [], texts: [] };
    if (g.key && !withKey) return out;
    (g.items || []).forEach(function (it) {
      if (it.key && !withKey) return;
      var key = !!(it.key || g.key);
      if (it.type === 'function') {
        var f = compile(it.expr);
        var whole = !it.domain;
        var a = Math.max(g.x.min, whole ? -Infinity : it.domain[0]), b = Math.min(g.x.max, whole ? Infinity : it.domain[1]);
        var pieces = curve(f, a, b, g);
        var ends = it.ends || (whole ? ['arrow', 'arrow'] : ['closed', 'closed']);
        pieces.forEach(function (pts, i) {
          out.lines.push({ points: pts, style: it.style || 'solid', ends: [i === 0 ? ends[0] : 'none', i === pieces.length - 1 ? ends[1] : 'none'], label: i === pieces.length - 1 ? it.label : undefined, key: key });
        });
        // Dots for open / closed ends of a domain (drawn by the page as dots, not line caps).
        if (!whole) [[it.domain[0], ends[0]], [it.domain[1], ends[1]]].forEach(function (e) {
          if ((e[1] === 'open' || e[1] === 'closed') && isFinite(f(e[0]))) out.dots.push({ at: [round(e[0]), round(f(e[0]))], open: e[1] === 'open', key: key });
        });
      } else if (it.type === 'points') {
        var pts = it.points.map(function (p) { return [p[0], p[1]]; });
        if (it.join === 'segments' || it.join === 'smooth') out.lines.push({ points: pts, style: it.style || 'solid', smooth: it.join === 'smooth', ends: ['none', 'none'], label: it.label, key: key });
        if (it.dots !== 'none') it.points.forEach(function (p) { out.dots.push({ at: [p[0], p[1]], open: it.dots === 'open', label: p[2], key: key }); });
      } else if (it.type === 'segment') {
        var se = it.ends || ['none', 'none'];
        out.lines.push({ points: [it.from.slice(0, 2), it.to.slice(0, 2)], style: it.style || 'solid', ends: se, label: it.label, key: key });
        [[it.from, se[0]], [it.to, se[1]]].forEach(function (e) {
          if (e[1] === 'open' || e[1] === 'closed') out.dots.push({ at: e[0].slice(0, 2), open: e[1] === 'open', key: key });
        });
      } else if (it.type === 'text') {
        out.texts.push({ at: it.at, text: it.text, key: key });
      }
    });
    return out;
  }

  MW.graph = { check: check, compile: compile, sample: sample, ticks: ticks };
})(typeof window !== 'undefined' ? window : this);
