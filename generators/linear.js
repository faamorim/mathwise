/*
 * Linear relations (Math 9 / Math 10): the first generators with graphs.
 * Graphs follow docs/graph-format.md: the generator describes the plane and what
 * is on it (answers marked key: true); pages draw it.
 * Needs core.js and graph.js first.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var M = root.Mathwise.math;
  var gcd = M.gcd, num = M.num;

  // y = (rise/run) x + b, reduced, as LaTeX ("y=-\frac{2}{3}x+1", "y=x", "y=-4").
  function slope(v) { var g = gcd(v.rise, v.run) || 1; return { n: v.rise / g, d: v.run / g }; }
  function coefTex(s) {
    if (s.n === 0) return '';
    var sign = s.n < 0 ? '-' : '';
    var a = Math.abs(s.n);
    if (s.d === 1) return sign + (a === 1 ? '' : a) + 'x';
    return sign + '\\frac{' + a + '}{' + s.d + '}x';
  }
  function eqTex(v) {
    var s = slope(v), c = coefTex(s);
    if (!c) return 'y=' + num(v.b);
    return 'y=' + c + (v.b === 0 ? '' : (v.b < 0 ? '-' : '+') + Math.abs(v.b));
  }
  // The same line in the graph expression language: "-2/3x+1".
  function exprOf(v) {
    var s = slope(v);
    var c = s.n === 0 ? '' : (s.n < 0 ? '-' : '') + Math.abs(s.n) + (s.d > 1 ? '/' + s.d : '') + 'x';
    if (!c) return String(v.b);
    return c + (v.b === 0 ? '' : (v.b < 0 ? '-' : '+') + Math.abs(v.b));
  }
  function pt(x, y) { return '(' + num(x) + ',\\ ' + num(y) + ')'; }

  function plane(size) {
    var step = size >= 8 ? 2 : 1;
    return {
      size: [size >= 8 ? 7 : 6, size >= 8 ? 7 : 6],
      x: { min: -size, max: size, grid: 1, numbers: step, label: 'x' },
      y: { min: -size, max: size, grid: 1, numbers: step, label: 'y' },
      items: []
    };
  }
  // Lattice points of the line inside the plane, every `run` units of x.
  function latticePoints(v, size) {
    var s = slope(v), out = [];
    for (var x = -size; x <= size; x++) {
      if (x % s.d !== 0) continue;
      var y = v.b + s.n * x / s.d;
      if (Math.abs(y) <= size) out.push([x, y]);
    }
    return out;
  }

  var SLOPES = [
    { value: 'integer', label: 'Whole numbers, like 2 or −3' },
    { value: 'fraction', label: 'Fractions, like 2/3 or −1/2' },
    { value: 'zero', label: 'Zero (horizontal lines)' }
  ];
  var PARAMS = [
    { key: 'slopes', label: 'Slopes', type: 'set', default: ['integer', 'fraction'], values: SLOPES },
    { key: 'negatives', label: 'Negative slopes', type: 'toggle', default: true },
    { key: 'maxIntercept', label: 'Largest y-intercept (size)', type: 'number', min: 0, max: 8, default: 4 },
    { key: 'size', label: 'Plane from −n to n', type: 'number', min: 5, max: 10, default: 6 }
  ];
  var VARS = [
    { key: 'rise', label: 'Rise (top of the slope)', kind: 'int', min: -20, max: 20 },
    { key: 'run', label: 'Run (bottom of the slope)', kind: 'int', min: 1, max: 20 },
    { key: 'b', label: 'y-intercept', kind: 'int', min: -20, max: 20 },
    { key: 'size', label: 'Plane from −n to n', kind: 'int', min: 3, max: 20 }
  ];
  function checkLine(v) {
    if (Math.abs(v.b) > v.size) return ['The y-intercept must be on the plane (between −' + v.size + ' and ' + v.size + ').'];
    if (latticePoints(v, v.size).length < 2) return ['The line needs at least two points with whole-number coordinates on the plane: make the plane bigger or the slope gentler.'];
    return [];
  }
  function pickLine(v, rng, ctx) {
    var kind = ctx.spread('slopes', rng), rise, run, b;
    for (var t = 0; t < 200; t++) {
      if (kind === 'zero') { rise = 0; run = 1; }
      else if (kind === 'integer') { rise = rng.int(1, 4); run = 1; }
      else { var f = rng.pick([[1, 2], [1, 3], [2, 3], [3, 2], [3, 4], [1, 4], [2, 5], [5, 2]]); rise = f[0]; run = f[1]; }
      if (v.negatives && kind !== 'zero' && rng.chance(0.5)) rise = -rise;
      b = rng.int(-v.maxIntercept, v.maxIntercept);
      var x = { rise: rise, run: run, b: b, size: v.size };
      if (checkLine(x).length === 0 && latticePoints(x, v.size).length >= 3) return x;
    }
    return { rise: 1, run: 1, b: 0, size: v.size };
  }

  // ---------------------------------------------------------------------
  var STEP_METHODS = [
    { value: 'table', label: 'Table of values' },
    { value: 'slope-intercept', label: 'y-intercept and slope (rise over run)' }
  ];

  G.register({
    name: 'linear.graph-line',
    topic: 'Linear relations',
    title: 'Graph a line from its equation',
    prompt: 'Graph',
    columns: 2,
    workSpace: 1,
    params: PARAMS.concat([{ key: 'methods', label: 'Worked steps by', type: 'set', default: ['table'], values: STEP_METHODS }]),
    variables: VARS.concat([{ key: 'methods', label: 'Worked steps by', kind: 'list', of: { kind: 'choice', values: STEP_METHODS }, minLength: 1, maxLength: 2 }]),
    checkVars: checkLine,
    pick: function (v, rng, ctx) { var x = pickLine(v, rng, ctx); x.methods = v.methods.slice(); return x; },
    render: function (v) {
      var s = slope(v), eq = eqTex(v), pts = latticePoints(v, v.size);
      // Up to five table points around the y-axis.
      pts.sort(function (p, q) { return Math.abs(p[0]) - Math.abs(q[0]) || p[0] - q[0]; });
      var table = pts.slice(0, Math.min(5, pts.length)).sort(function (p, q) { return p[0] - q[0]; });
      var g = plane(v.size);
      g.items.push({ type: 'function', expr: exprOf(v), label: '$' + eq + '$', key: true });
      g.items.push({ type: 'points', points: table, key: true });
      var methods = STEP_METHODS.filter(function (m) { return v.methods.indexOf(m.value) >= 0; }).map(function (m) {
        var steps;
        if (m.value === 'table') {
          steps = [
            'Choose values of $x$' + (s.d > 1 ? ' that are multiples of $' + s.d + '$' : '') + ' and work out $y$',
            '$\\begin{array}{c|' + table.map(function () { return 'c'; }).join('') + '}x & ' + table.map(function (p) { return num(p[0]); }).join(' & ') +
              '\\\\ \\hline y & ' + table.map(function (p) { return num(p[1]); }).join(' & ') + '\\end{array}$',
            'Plot the points and join them with a straight line'
          ];
        } else {
          var up = s.n > 0 ? 'up ' + s.n : s.n < 0 ? 'down ' + -s.n : 'not up or down';
          steps = [
            'The y-intercept is $' + num(v.b) + '$: plot $' + pt(0, v.b) + '$',
            s.n === 0 ? 'The slope is $0$: the line is horizontal'
              : 'The slope is $' + (s.d === 1 ? num(s.n) : (s.n < 0 ? '-' : '') + '\\frac{' + Math.abs(s.n) + '}{' + s.d + '}') + '$: from $' + pt(0, v.b) + '$ go ' + up + ' and right ' + s.d,
            'Plot $' + pt(s.d, v.b + s.n) + '$ and draw the line through both points'
          ];
        }
        return { method: m.value, label: m.label, steps: steps };
      });
      var steps = [];
      methods.forEach(function (m) { if (methods.length > 1) steps.push(m.label + ':'); steps = steps.concat(m.steps); });
      return {
        prompt: '$' + eq + '$',
        steps: steps,
        methods: methods,
        answer: 'Line through $' + pt(table[0][0], table[0][1]) + '$ and $' + pt(table[table.length - 1][0], table[table.length - 1][1]) + '$ (see the graph)',
        graph: g,
        slots: { equation: eq }
      };
    }
  });

  // ---------------------------------------------------------------------
  G.register({
    name: 'linear.equation-from-graph',
    topic: 'Linear relations',
    title: 'Write the equation of a line from its graph',
    prompt: 'Write the equation of each line in the form $y=mx+b$',
    columns: 2,
    workSpace: 1.5,
    params: PARAMS,
    variables: VARS,
    checkVars: checkLine,
    pick: pickLine,
    render: function (v) {
      var s = slope(v), eq = eqTex(v);
      var g = plane(v.size);
      g.items.push({ type: 'function', expr: exprOf(v) });
      var p2 = [s.d, v.b + s.n];
      if (Math.abs(p2[1]) > v.size) p2 = [-s.d, v.b - s.n];
      g.items.push({ type: 'points', points: [[0, v.b], p2], key: true });
      var rise = p2[1] - v.b, run = p2[0];
      var steps = [
        'The line crosses the $y$-axis at $' + pt(0, v.b) + '$, so $b=' + num(v.b) + '$',
        'Another point on the line: $' + pt(p2[0], p2[1]) + '$',
        '$m=\\dfrac{\\text{rise}}{\\text{run}}=\\dfrac{' + num(rise) + '}{' + num(run) + '}' + ('=' + (s.n === 0 ? '0' : s.d === 1 ? num(s.n) : (s.n < 0 ? '-' : '') + '\\frac{' + Math.abs(s.n) + '}{' + s.d + '}')) + '$',
        '$' + eq + '$'
      ];
      return { prompt: '$y=\\underline{\\qquad\\qquad}$', steps: steps, answer: '$' + eq + '$', graph: g, slots: { equation: eq } };
    }
  });

  root.Mathwise.linear = { eqTex: eqTex, exprOf: exprOf };
})(typeof window !== 'undefined' ? window : this);
