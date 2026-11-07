/*
 * Powers and exponent laws (Math 9): negative exponents, product / quotient /
 * power-of-a-power laws, monomials, simple exponential equations.
 * Needs generators/core.js first.
 *
 * Every generator here is a question template: pick() makes all the random
 * choices (vars), render() writes the question, answer and steps from them.
 * render() must be right for ANY vars that pass checkVars, not only the ones
 * pick() would choose, because a teacher can type their own.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var M = root.Mathwise.math;
  var pow = M.pow, num = M.num, frac = M.frac, fracTex = M.fracTex, opExp = M.opExp, mono = M.mono;

  // Letters that read clearly next to numbers (no i, l, o, e, s).
  var LETTERS = ['a', 'b', 'c', 'd', 'k', 'm', 'n', 'p', 'r', 't', 'w', 'x', 'y', 'z'];

  function ipow(b, n) { var r = 1; for (var i = 0; i < n; i++) r *= b; return r; }
  function dfrac(a, b) { return '\\dfrac{' + a + '}{' + b + '}'; }
  function paren(x) { return '(' + x + ')'; }
  function mulExp(a, b) { return a + '\\times' + (b < 0 ? paren(b) : b); }
  function opTex(op) { return op === 'multiply' ? '\\times ' : '\\div '; }

  // Nonzero exponent in [-max, max] (or [1, max] without negatives).
  // Skips +-1 when there is room, so every power shows a real exponent.
  function exponent(rng, max, negatives) {
    var lo = max >= 4 ? 2 : 1;
    var e = rng.int(lo, max);
    return negatives && rng.chance(0.5) ? -e : e;
  }

  // Every way to write v as B^N with N >= 2 (for answers like 1/2^6 = 1/4^3 = 1/8^2).
  function powerForms(v, odd) {
    var out = [];
    for (var b = 2; b <= v; b++) {
      for (var n = 2, p = b * b; p <= v; n++, p *= b) {
        if (p === v && (!odd || n % 2 === 1)) out.push([b, n]);
      }
    }
    return out;
  }

  // Answer b^r, with r = 1 or 0 written out (only reached from vars a teacher typed).
  function powAnswer(base, r) {
    if (r === 0) return '1';
    if (r === 1) return typeof base === 'number' ? num(base) : base;
    return pow(base, r);
  }
  function zeroSteps(steps, base, r) {
    if (r === 0) steps.push('$= ' + pow(base, 0) + '$');
    return steps;
  }
  function tooBig(x) { return Math.abs(x) > 1e9; }
  function choices(values) { return values.map(function (v) { return { value: v.value, label: v.label }; }); }

  var OPS = [{ value: 'multiply', label: '×' }, { value: 'divide', label: '÷' }];

  // ---------------------------------------------------------------------
  var NEG_FORMS = [
    { value: 'basic', label: 'b⁻ⁿ, like 2⁻³' },
    { value: 'ten', label: '10⁻ⁿ' },
    { value: 'fraction', label: '(1/b)⁻ⁿ' },
    { value: 'reciprocal', label: '1 / b⁻ⁿ' },
    { value: 'coefficient', label: 'k / b⁻ⁿ' },
    { value: 'decimal', label: '(0.5)⁻ⁿ' }
  ];
  var DEC = { 2: '0.5', 4: '0.25', 5: '0.2', 10: '0.1' };

  G.register({
    name: 'powers.negative-exponent',
    topic: 'Powers',
    title: 'Evaluate powers with negative exponents',
    prompt: 'Evaluate',
    columns: 3,
    workSpace: 1,
    params: [
      { key: 'forms', label: 'Forms', type: 'set', default: ['basic', 'ten', 'fraction', 'reciprocal', 'coefficient', 'decimal'],
        values: choices(NEG_FORMS) },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 1, max: 5, default: 3 },
      { key: 'maxValue', label: 'Largest value of bⁿ', type: 'number', min: 4, max: 1000, default: 64 }
    ],
    variables: [
      { key: 'form', label: 'Form', kind: 'choice', values: choices(NEG_FORMS) },
      { key: 'base', label: 'Base b', kind: 'int', min: 2 },
      { key: 'exponent', label: 'Exponent n', kind: 'int', min: 1 },
      { key: 'k', label: 'Coefficient k', kind: 'int', min: 2, when: { form: ['coefficient'] } }
    ],
    checkVars: function (x) {
      if (x.form === 'decimal' && !DEC[x.base]) return ['For the decimal form the base must be 2, 4, 5 or 10.'];
      if (tooBig(ipow(x.base, x.exponent))) return ['b to the power n is too big to write out.'];
      return [];
    },
    pick: function (v, rng, ctx) {
      var form = ctx.spread('forms', rng);
      function bn(bases) {
        var n = rng.intWhere(1, v.maxExponent, function (n) { return bases.some(function (b) { return ipow(b, n) <= v.maxValue; }); });
        var b = rng.pick(bases.filter(function (b) { return ipow(b, n) <= v.maxValue; }));
        return { form: form, base: b, exponent: n };
      }
      switch (form) {
        case 'basic': return bn([2, 3, 4, 5, 6, 7, 8, 9]);
        case 'ten': return { form: form, base: 10, exponent: rng.int(2, Math.min(6, v.maxExponent + 2)) };
        case 'fraction': return bn([2, 3, 4, 5, 6, 7, 8, 9, 10]);
        case 'reciprocal': return bn([2, 3, 4, 5, 6, 7, 8, 9]);
        case 'coefficient':
          var x = bn([2, 3, 4, 5, 6]);
          x.k = rng.intWhere(2, 5, function (k) { return k !== x.base; });
          return x;
        default: return bn([2, 4, 5, 10]);
      }
    },
    render: function (x) {
      var b = x.base, n = x.exponent, V = ipow(b, n);
      var slots = { value: num(V) };
      switch (x.form) {
        case 'basic':
        case 'ten':
          return { prompt: '$' + pow(b, -n) + ' =$', steps: ['$= ' + dfrac(1, pow(b, n)) + '$'], answer: '$' + fracTex(frac(1, V)) + '$', slots: slots };
        case 'fraction':
          return { prompt: '$\\left(' + dfrac(1, b) + '\\right)^{' + -n + '} =$', steps: ['$= ' + pow(b, n) + '$'], answer: '$' + num(V) + '$', slots: slots };
        case 'reciprocal':
          return { prompt: '$' + dfrac(1, pow(b, -n)) + ' =$', steps: ['$= ' + pow(b, n) + '$'], answer: '$' + num(V) + '$', slots: slots };
        case 'coefficient':
          var st = ['$= ' + x.k + '\\times' + pow(b, n) + '$'];
          if (n > 1) st.push('$= ' + x.k + '\\times' + num(V) + '$');
          return { prompt: '$' + dfrac(x.k, pow(b, -n)) + ' =$', steps: st, answer: '$' + num(x.k * V) + '$', slots: slots };
        default: // decimal
          return {
            prompt: '$(' + DEC[b] + ')^{' + -n + '} =$',
            steps: ['$= \\left(' + dfrac(1, b) + '\\right)^{' + -n + '}$', '$= ' + pow(b, n) + '$'],
            answer: '$' + num(V) + '$',
            slots: slots
          };
      }
    }
  });

  // ---------------------------------------------------------------------
  G.register({
    name: 'powers.product-quotient',
    topic: 'Powers',
    title: 'Multiply or divide powers with the same base',
    prompt: 'Simplify',
    columns: 3,
    workSpace: 1.5,
    params: [
      { key: 'bases', label: 'Base', type: 'set', default: ['number'],
        values: [
          { value: 'number', label: 'Positive number, like 7' },
          { value: 'negative', label: 'Negative number, like (−5)' },
          { value: 'variable', label: 'Variable, like p' }
        ] },
      { key: 'operations', label: 'Operations', type: 'set', default: ['multiply', 'divide'], values: OPS },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 2, max: 30, default: 12 },
      { key: 'negatives', label: 'Negative exponents', type: 'toggle', default: true }
    ],
    variables: [
      { key: 'base', label: 'Base', kind: 'int-or-letter' },
      { key: 'm', label: 'First exponent', kind: 'int' },
      { key: 'op', label: 'Operation', kind: 'choice', values: OPS },
      { key: 'n', label: 'Second exponent', kind: 'int' }
    ],
    checkVars: function (x) { return x.base === 0 ? ['The base cannot be 0.'] : []; },
    pick: function (v, rng, ctx) {
      var kind = ctx.spread('bases', rng);
      var op = rng.pick(v.operations);
      var base = kind === 'variable' ? rng.pick(LETTERS) : kind === 'negative' ? -rng.int(2, 9) : rng.int(2, 9);
      var m, n, r;
      for (var t = 0; t < 200; t++) {
        m = exponent(rng, v.maxExponent, v.negatives);
        n = exponent(rng, v.maxExponent, v.negatives);
        if (v.negatives && m > 0 && n > 0) m = -m;
        r = op === 'multiply' ? m + n : m - n;
        if (r !== 0 && r !== 1) break;
      }
      return { base: base, m: m, op: op, n: n };
    },
    render: function (x) {
      var base = x.base, m = x.m, n = x.n, op = x.op;
      var r = op === 'multiply' ? m + n : m - n;
      var steps = ['$= ' + pow(base, opExp(m, op === 'multiply' ? '+' : '-', n)) + '$'];
      if (op === 'divide' && n < 0) steps.push('$= ' + pow(base, m + '+' + -n) + '$');
      return {
        prompt: '$' + pow(base, m) + opTex(op) + pow(base, n) + ' =$',
        steps: zeroSteps(steps, base, r),
        answer: '$' + powAnswer(base, r) + '$',
        slots: { result: r }
      };
    }
  });

  // ---------------------------------------------------------------------
  G.register({
    name: 'powers.power-of-power',
    topic: 'Powers',
    title: 'Power of a power, then multiply or divide',
    prompt: 'Simplify',
    columns: 2,
    workSpace: 1,
    params: [
      { key: 'bases', label: 'Base', type: 'set', default: ['variable', 'number'],
        values: [{ value: 'variable', label: 'Variable, like y' }, { value: 'number', label: 'Number, like 5' }] },
      { key: 'operations', label: 'Operations', type: 'set', default: ['multiply', 'divide'], values: OPS },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 2, max: 6, default: 4 },
      { key: 'negatives', label: 'Negative exponents', type: 'toggle', default: true }
    ],
    variables: [
      { key: 'base', label: 'Base', kind: 'int-or-letter' },
      { key: 'a', label: 'First inner exponent', kind: 'int' },
      { key: 'c', label: 'First outer exponent', kind: 'int' },
      { key: 'op', label: 'Operation', kind: 'choice', values: OPS },
      { key: 'd', label: 'Second inner exponent', kind: 'int' },
      { key: 'e', label: 'Second outer exponent', kind: 'int' }
    ],
    checkVars: function (x) { return x.base === 0 ? ['The base cannot be 0.'] : []; },
    pick: function (v, rng, ctx) {
      var kind = ctx.spread('bases', rng);
      var base = kind === 'variable' ? rng.pick(LETTERS) : rng.int(2, 9);
      var op = rng.pick(v.operations);
      var a, c, d, e, p, q, r;
      for (var t = 0; t < 200; t++) {
        a = exponent(rng, v.maxExponent, v.negatives); c = exponent(rng, v.maxExponent, v.negatives);
        d = exponent(rng, v.maxExponent, v.negatives); e = exponent(rng, v.maxExponent, v.negatives);
        if (v.negatives && a > 0 && c > 0 && d > 0 && e > 0) d = -d;
        if (a === d && c === e) continue;
        p = a * c; q = d * e; r = op === 'multiply' ? p + q : p - q;
        if (r !== 0) break;
      }
      return { base: base, a: a, c: c, op: op, d: d, e: e };
    },
    render: function (x) {
      var base = x.base, op = x.op, a = x.a, c = x.c, d = x.d, e = x.e;
      var p = a * c, q = d * e, r = op === 'multiply' ? p + q : p - q;
      var sym = op === 'multiply' ? '+' : '-';
      var steps = [
        '$= ' + pow(base, mulExp(a, c)) + opTex(op) + pow(base, mulExp(d, e)) + '$',
        '$= ' + pow(base, p) + opTex(op) + pow(base, q) + '$',
        '$= ' + pow(base, opExp(p, sym, q)) + '$'
      ];
      if (op === 'divide' && q < 0) steps.push('$= ' + pow(base, p + '+' + -q) + '$');
      return {
        prompt: '$' + pow(paren(pow(base, a)), c) + opTex(op) + pow(paren(pow(base, d)), e) + ' =$',
        steps: zeroSteps(steps, base, r),
        answer: '$' + powAnswer(base, r) + '$',
        slots: { result: r }
      };
    }
  });

  // ---------------------------------------------------------------------
  G.register({
    name: 'powers.monomials',
    topic: 'Powers',
    title: 'Multiply and divide monomials (coefficients and powers)',
    prompt: 'Simplify',
    columns: 2,
    workSpace: 1,
    params: [
      { key: 'terms', label: 'Terms', type: 'choice', default: 2,
        values: [{ value: 2, label: '2 terms, like 12t⁴ ÷ 3t⁻³' }, { value: 3, label: '3 terms, left to right' }] },
      { key: 'operations', label: 'Operations', type: 'set', default: ['divide', 'multiply'],
        values: [{ value: 'divide', label: '÷' }, { value: 'multiply', label: '×' }] },
      { key: 'maxCoefficient', label: 'Largest coefficient factor', type: 'number', min: 2, max: 12, default: 9 },
      { key: 'negativeCoefficients', label: 'Negative coefficients', type: 'toggle', default: true },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 2, max: 20, default: 12 },
      { key: 'negatives', label: 'Negative exponents', type: 'toggle', default: true }
    ],
    variables: [
      { key: 'letter', label: 'Variable', kind: 'letter' },
      { key: 'coefficients', label: 'Coefficients', kind: 'list', of: { kind: 'int', nonzero: true }, minLength: 2, maxLength: 4 },
      { key: 'exponents', label: 'Exponents', kind: 'list', of: { kind: 'int' }, minLength: 2, maxLength: 4 },
      { key: 'ops', label: 'Operations (between terms)', kind: 'list', of: { kind: 'choice', values: OPS }, minLength: 1, maxLength: 3 }
    ],
    checkVars: function (x) {
      var n = x.coefficients.length;
      if (x.exponents.length !== n) return ['Give one exponent for each coefficient.'];
      if (x.ops.length !== n - 1) return ['Give one operation between each pair of terms (' + (n - 1) + ').'];
      var c = x.coefficients[0];
      for (var i = 1; i < n; i++) {
        if (x.ops[i - 1] === 'divide' && c % x.coefficients[i] !== 0) return ['Each division must come out whole: ' + c + ' ÷ ' + x.coefficients[i] + ' does not.'];
        c = x.ops[i - 1] === 'multiply' ? c * x.coefficients[i] : c / x.coefficients[i];
        if (tooBig(c)) return ['The coefficients get too big.'];
      }
      return [];
    },
    pick: function (v, rng, ctx) {
      var x = rng.pick(LETTERS);
      var nt = v.terms;
      var ops = [];
      for (var i = 1; i < nt; i++) ops.push(nt === 2 ? ctx.spread('operations', rng) : rng.pick(v.operations));
      function sgn() { return v.negativeCoefficients && rng.chance(0.3) ? -1 : 1; }
      var coefs, exps;
      for (var t = 0; t < 300; t++) {
        // Choose the divisors first so every division comes out whole.
        var start = rng.int(nt === 2 ? 2 : 1, v.maxCoefficient);
        coefs = [0];
        for (i = 0; i < ops.length; i++) {
          var f = rng.int(2, v.maxCoefficient) * sgn();
          coefs.push(f);
          if (ops[i] === 'divide') start *= Math.abs(f);
        }
        coefs[0] = start * sgn();
        exps = [];
        for (i = 0; i < nt; i++) exps.push(exponent(rng, v.maxExponent, v.negatives));
        if (v.negatives && exps.every(function (e) { return e > 0; })) exps[1] = -exps[1];
        // Keep numbers friendly: every coefficient along the way at most 99, final at most 72,
        // final exponent at most 20 in size.
        var cc = coefs[0], ee = exps[0], ok = Math.abs(cc) <= 99 && coefs[0] !== coefs[1];
        for (i = 1; i < nt && ok; i++) {
          cc = ops[i - 1] === 'multiply' ? cc * coefs[i] : cc / coefs[i];
          ee = ops[i - 1] === 'multiply' ? ee + exps[i] : ee - exps[i];
          ok = Math.abs(cc) <= 99;
        }
        if (ok && Math.abs(cc) <= 72 && Math.abs(ee) <= 20) break;
      }
      return { letter: x, coefficients: coefs, exponents: exps, ops: ops };
    },
    render: function (vars) {
      var x = vars.letter, coefs = vars.coefficients, exps = vars.exponents, ops = vars.ops;
      var nt = coefs.length, i;
      function termTex(i) {
        var s = mono(coefs[i], x, exps[i]);
        if (i === 0) return s;
        var wrap = coefs[i] < 0 || (nt === 2 && ops[i - 1] === 'multiply');
        return opTex(ops[i - 1]) + (wrap ? paren(s) : s);
      }
      // One rule application: coefficients together, exponents together.
      function combine(cA, eA, op, cB, eB) {
        if (op === 'multiply') {
          return { tex: paren(num(cA)) + paren(num(cB)) + '\\,' + pow(x, opExp(eA, '+', eB)), c: cA * cB, e: eA + eB };
        }
        return { tex: '\\frac{' + num(cA) + '}{' + num(cB) + '}\\,' + pow(x, opExp(eA, '-', eB)), c: cA / cB, e: eA - eB };
      }
      var prompt = '';
      for (i = 0; i < nt; i++) prompt += termTex(i);
      var steps = [];
      var c = coefs[0], e = exps[0];
      for (i = 1; i < nt; i++) {
        var rest = '';
        for (var j = i + 1; j < nt; j++) rest += termTex(j);
        var s = combine(c, e, ops[i - 1], coefs[i], exps[i]);
        steps.push('$= ' + s.tex + rest + '$');
        c = s.c; e = s.e;
        if (rest) steps.push('$= ' + mono(c, x, e) + rest + '$');
      }
      if (e === 0) {
        steps.push('$= ' + (c === 1 ? '' : c === -1 ? '-' : num(c)) + x + '^0$');
        steps.push('$= ' + num(c) + '(1)$');
      }
      return { prompt: '$' + prompt + ' =$', steps: steps, answer: '$' + mono(c, x, e) + '$', slots: { coefficient: num(c), exponent: e } };
    }
  });

  // ---------------------------------------------------------------------
  var MIXED_FORMS = [
    { value: 'power-plus-reciprocal', label: 'bᵐ + b⁻¹' },
    { value: 'power-of-product', label: '(a × b)⁻ⁿ' },
    { value: 'sum-of-reciprocals', label: 'b⁻¹ + b⁻²' },
    { value: 'power-of-difference', label: '(a² − c)⁻ⁿ' }
  ];

  G.register({
    name: 'powers.evaluate-mixed',
    topic: 'Powers',
    title: 'Evaluate expressions with negative exponents',
    prompt: 'Evaluate',
    columns: 2,
    workSpace: 1.5,
    params: [
      { key: 'forms', label: 'Forms', type: 'set', default: ['power-plus-reciprocal', 'power-of-product', 'sum-of-reciprocals', 'power-of-difference'],
        values: choices(MIXED_FORMS) }
    ],
    variables: [
      { key: 'form', label: 'Form', kind: 'choice', values: choices(MIXED_FORMS) },
      { key: 'a', label: 'a', kind: 'int', min: 2, when: { form: ['power-of-product', 'power-of-difference'] } },
      { key: 'b', label: 'b', kind: 'int', min: 2, when: { form: ['power-plus-reciprocal', 'power-of-product', 'sum-of-reciprocals'] } },
      { key: 'c', label: 'c', kind: 'int', min: 1, when: { form: ['power-of-difference'] } },
      { key: 'n', label: 'Exponent', kind: 'int', min: 1, when: { form: ['power-plus-reciprocal', 'power-of-product', 'power-of-difference'] } }
    ],
    checkVars: function (x) {
      if (x.form === 'power-of-difference' && x.a * x.a - x.c < 2) return ['a² − c must be at least 2.'];
      if (x.form === 'power-plus-reciprocal' && tooBig(ipow(x.b, x.n))) return ['bⁿ is too big to write out.'];
      if (x.form === 'power-of-product' && tooBig(ipow(x.a * x.b, x.n))) return ['(a × b)ⁿ is too big to write out.'];
      if (x.form === 'power-of-difference' && tooBig(ipow(x.a * x.a - x.c, x.n))) return ['(a² − c)ⁿ is too big to write out.'];
      return [];
    },
    pick: function (v, rng, ctx) {
      var form = ctx.spread('forms', rng);
      var b, n;
      if (form === 'power-plus-reciprocal') {
        b = rng.int(2, 6); n = rng.intWhere(2, 3, function (n) { return ipow(b, n) <= 125; });
        return { form: form, b: b, n: n };
      }
      if (form === 'power-of-product') {
        var a = rng.int(2, 5); b = rng.intWhere(2, 5, function (b) { return b !== a; });
        n = a * b <= 10 && rng.chance(0.6) ? 2 : 1;
        return { form: form, a: a, b: b, n: n };
      }
      if (form === 'sum-of-reciprocals') return { form: form, b: rng.int(2, 5) };
      // power-of-difference: (a^2 - c)^-n
      var aa = rng.int(2, 5), d = rng.intWhere(2, 5, function (d) { return d < aa * aa; });
      n = rng.int(1, 2);
      return { form: form, a: aa, c: aa * aa - d, n: n };
    },
    render: function (x) {
      var b = x.b, n = x.n, V;
      if (x.form === 'power-plus-reciprocal') {
        V = ipow(b, n);
        return {
          prompt: '$' + pow(b, n) + '+' + pow(b, -1) + ' =$',
          steps: ['$= ' + num(V) + ' + ' + dfrac(1, pow(b, 1)) + '$', '$= ' + num(V) + ' + ' + dfrac(1, b) + '$'],
          answer: '$' + M.mixedTex(frac(V * b + 1, b)) + '$'
        };
      }
      if (x.form === 'power-of-product') {
        var ab = x.a * b; V = ipow(ab, n);
        return {
          prompt: '$(' + x.a + '\\times' + b + ')^{' + -n + '} =$',
          steps: ['$= ' + pow(ab, -n) + '$', '$= ' + dfrac(1, pow(ab, n)) + '$'],
          answer: '$' + fracTex(frac(1, V)) + '$'
        };
      }
      if (x.form === 'sum-of-reciprocals') {
        var b2 = b * b;
        return {
          prompt: '$' + pow(b, -1) + '+' + pow(b, -2) + ' =$',
          steps: [
            '$= ' + dfrac(1, b) + ' + ' + dfrac(1, pow(b, 2)) + '$',
            '$= ' + dfrac(1, b) + ' + ' + dfrac(1, b2) + '$',
            '$= ' + dfrac(b, b2) + ' + ' + dfrac(1, b2) + '$'
          ],
          answer: '$' + fracTex(frac(b + 1, b2)) + '$'
        };
      }
      var aa = x.a, cc = x.c, d = aa * aa - cc;
      V = ipow(d, n);
      return {
        prompt: '$(' + pow(aa, 2) + '-' + cc + ')^{' + -n + '} =$',
        steps: ['$= (' + aa * aa + '-' + cc + ')^{' + -n + '}$', '$= ' + pow(d, -n) + '$', '$= ' + dfrac(1, pow(d, n)) + '$'],
        answer: '$' + fracTex(frac(1, V)) + '$'
      };
    }
  });

  // ---------------------------------------------------------------------
  var POS_FORMS = [
    { value: 'fraction', label: '1/1000 → 1/10³' },
    { value: 'negative', label: '1/−32 → 1/(−2)⁵' },
    { value: 'decimal', label: '0.25 → 1/2²' }
  ];

  G.register({
    name: 'powers.positive-exponents',
    topic: 'Powers',
    title: 'Write numbers as powers with positive exponents',
    prompt: 'Express as powers with positive exponents',
    columns: 4,
    workSpace: 1,
    params: [
      { key: 'forms', label: 'Forms', type: 'set', default: ['fraction', 'negative', 'decimal'], values: choices(POS_FORMS) },
      { key: 'maxValue', label: 'Largest denominator', type: 'number', min: 8, max: 10000, default: 1000 }
    ],
    variables: [
      { key: 'form', label: 'Form', kind: 'choice', values: choices(POS_FORMS) },
      { key: 'base', label: 'Base', kind: 'int', min: 2 },
      { key: 'exponent', label: 'Exponent', kind: 'int', min: 2 }
    ],
    checkVars: function (x) {
      var V = ipow(x.base, x.exponent);
      if (tooBig(V)) return ['The power is too big to write out.'];
      if (x.form === 'negative' && x.exponent % 2 === 0) return ['For a negative number the exponent must be odd.'];
      if (x.form === 'decimal') {
        var r = V; while (r % 2 === 0) r /= 2; while (r % 5 === 0) r /= 5;
        if (r !== 1 || V > 1e6) return ['For a decimal the base must be made of 2s and 5s (2, 4, 5, 8, 10, …), up to 1 000 000.'];
      }
      return [];
    },
    pick: function (v, rng, ctx) {
      var form = ctx.spread('forms', rng);
      function pickBN(bases, odd) {
        var c = [];
        bases.forEach(function (b) {
          for (var n = 2; ipow(b, n) <= v.maxValue; n++) if (!odd || n % 2) c.push([b, n]);
        });
        return rng.pick(c);
      }
      var bn;
      if (form === 'negative') bn = pickBN([2, 3, 4, 5], true);
      else if (form === 'decimal') {
        // At most three decimal places (0.25, 0.125, 0.008), like the paper quizzes.
        do { bn = pickBN([2, 4, 5, 10]); } while (1000 % ipow(bn[0], bn[1]));
      } else bn = pickBN([2, 3, 5, 6, 7, 10]);
      return { form: form, base: bn[0], exponent: bn[1] };
    },
    render: function (x) {
      var bn = [x.base, x.exponent], V = ipow(x.base, x.exponent);
      function answerOf(first, neg) {
        var forms = powerForms(V, neg).filter(function (f) { return f[0] !== first[0]; });
        var all = [first].concat(forms).map(function (f) { return '\\frac{1}{' + pow(neg ? -f[0] : f[0], f[1]) + '}'; });
        return '$' + all.join('\\text{ or }') + '$';
      }
      if (x.form === 'negative') {
        var prod = []; for (var i = 0; i < bn[1]; i++) prod.push('(-' + bn[0] + ')');
        return {
          prompt: '$' + dfrac(1, num(-V)) + ' =$',
          steps: bn[1] <= 5 ? ['$= ' + dfrac(1, prod.join('')) + '$'] : [],
          answer: answerOf(bn, true)
        };
      }
      if (x.form === 'decimal') {
        var k = 1; while (ipow(10, k) % V) k++;
        var top = ipow(10, k) / V;
        var dec = '0.' + String(top).padStart(k, '0');
        var steps = [];
        if (top !== 1) steps.push('$= ' + dfrac(top, num(ipow(10, k))) + '$');
        steps.push('$= ' + dfrac(1, num(V)) + '$');
        return { prompt: '$' + dec + ' =$', steps: steps, answer: answerOf(bn) };
      }
      var f = []; for (var j = 0; j < bn[1]; j++) f.push(bn[0]);
      return {
        prompt: '$' + dfrac(1, num(V)) + ' =$',
        steps: bn[1] <= 4 ? ['$= ' + dfrac(1, f.join('\\times')) + '$'] : [],
        answer: answerOf(bn)
      };
    }
  });

  // ---------------------------------------------------------------------
  G.register({
    name: 'powers.order',
    topic: 'Powers',
    title: 'Write as powers of one base and put in order',
    prompt: 'Express as a power, and then arrange in order from least to greatest',
    whole: true,
    workSpace: 3,
    params: [
      { key: 'bases', label: 'Base', type: 'set', default: [2, 3],
        values: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 5, label: '5' }, { value: 10, label: '10' }] },
      { key: 'count', label: 'How many numbers', type: 'number', min: 4, max: 8, default: 6 },
      { key: 'maxValue', label: 'Largest denominator', type: 'number', min: 8, max: 10000, default: 1000 }
    ],
    validate: function (v) {
      var ok = v.bases.some(function (r) { var c = 1; for (var e = 1; ipow(r, e) <= v.maxValue; e++) c += 2; return c >= v.count + 1; });
      return ok ? [] : ['Not enough different powers below the largest denominator: raise it or ask for fewer numbers.'];
    },
    variables: [
      { key: 'base', label: 'Base', kind: 'int', min: 2 },
      { key: 'exponents', label: 'Exponents (in the order shown)', kind: 'list', of: { kind: 'int' }, minLength: 2, maxLength: 10 }
    ],
    checkVars: function (x) {
      var seen = {};
      for (var i = 0; i < x.exponents.length; i++) {
        if (seen[x.exponents[i]]) return ['Each exponent can appear only once.'];
        seen[x.exponents[i]] = true;
        if (tooBig(ipow(x.base, Math.abs(x.exponents[i])))) return ['A power is too big to write out.'];
      }
      return [];
    },
    pick: function (v, rng) {
      var r = rng.pick(v.bases.filter(function (r) { return ipow(r, 2) <= v.maxValue; }).concat([]));
      if (r === undefined) r = v.bases[0];
      var cand = [];
      for (var e = -12; e <= 12; e++) if (ipow(r, Math.abs(e)) <= v.maxValue) cand.push(e);
      var picked;
      for (var t = 0; t < 200; t++) {
        picked = rng.shuffle(cand).slice(0, v.count);
        var neg = picked.filter(function (e) { return e < 0; }).length;
        if (picked.some(function (e) { return e > 0; }) && neg >= Math.min(3, v.count - 2)) break;
      }
      return { base: r, exponents: picked };
    },
    render: function (x) {
      var r = x.base, picked = x.exponents;
      function valTex(e) { return e < 0 ? '\\frac{1}{' + num(ipow(r, -e)) + '}' : num(ipow(r, e)); }
      var steps = picked.map(function (e) {
        if (e < 0) return '$' + valTex(e) + ' = \\frac{1}{' + pow(r, -e) + '} = ' + pow(r, e) + '$';
        return '$' + valTex(e) + ' = ' + pow(r, e) + '$';
      });
      steps.push('Same base (bigger than 1): the bigger the exponent, the bigger the number');
      var sorted = picked.slice().sort(function (a, b) { return a - b; });
      return {
        prompt: 'Express as a power of $' + r + '$, and then arrange in order from least to greatest\n$$' +
          picked.map(valTex).join(',\\ ') + '$$',
        steps: steps,
        answer: '$' + sorted.map(function (e) { return pow(r, e); }).join(' < ') + '$'
      };
    }
  });

  // ---------------------------------------------------------------------
  var SOLVE_FORMS = [
    { value: 'unknown-exponent', label: '2ˣ = 1/2' },
    { value: 'unknown-base', label: 'x⁻³ = 1/125' },
    { value: 'square', label: 'x² = 1/25' },
    { value: 'power-of-ten', label: '10²⁻ˣ = 0.001' },
    { value: 'reciprocal-base', label: '243 = (1/3)ˣ⁺⁴' },
    { value: 'common-base', label: '9¹⁺ˣ = 27' }
  ];
  function whenForm() { return { form: Array.prototype.slice.call(arguments) }; }

  G.register({
    name: 'powers.solve-exponential',
    topic: 'Powers',
    title: 'Solve equations with powers',
    prompt: 'Solve',
    columns: 2,
    workSpace: 3,
    params: [
      { key: 'forms', label: 'Forms', type: 'set',
        default: ['unknown-exponent', 'unknown-base', 'square', 'power-of-ten', 'reciprocal-base', 'common-base'],
        values: choices(SOLVE_FORMS) }
    ],
    variables: [
      { key: 'form', label: 'Form', kind: 'choice', values: choices(SOLVE_FORMS) },
      { key: 'b', label: 'Base b', kind: 'int', min: 2, when: whenForm('unknown-exponent', 'unknown-base', 'square', 'reciprocal-base') },
      { key: 'k', label: 'k (bᵏ, or the number added to x)', kind: 'int', min: 1, when: whenForm('unknown-exponent', 'power-of-ten', 'reciprocal-base') },
      { key: 'n', label: 'Power of x', kind: 'int', min: 2, when: whenForm('unknown-base') },
      { key: 'm', label: 'Decimal places', kind: 'int', min: 1, max: 9, when: whenForm('power-of-ten') },
      { key: 'flip', label: 'Exponent written x + k (off: k − x)', kind: 'toggle', when: whenForm('power-of-ten') },
      { key: 'p', label: 'Power of b on the left', kind: 'int', min: 1, when: whenForm('reciprocal-base') },
      { key: 'r', label: 'Common base r', kind: 'int', min: 2, when: whenForm('common-base') },
      { key: 'a', label: 'Left base is r to the power', kind: 'int', min: 2, when: whenForm('common-base') },
      { key: 'c', label: 'Right side is r to the power', kind: 'int', min: 1, when: whenForm('common-base') },
      { key: 'j', label: 'Number added to x', kind: 'int', nonzero: true, when: whenForm('common-base') }
    ],
    checkVars: function (x) {
      var big = { 'unknown-exponent': [x.b, x.k], 'unknown-base': [x.b, x.n], 'reciprocal-base': [x.b, x.p], 'common-base': [x.r, Math.max(x.a, x.c)] }[x.form];
      if (big && tooBig(ipow(big[0], big[1]))) return ['The numbers are too big to write out.'];
      return [];
    },
    pick: function (v, rng, ctx) {
      var form = ctx.spread('forms', rng);
      var b, k, n;
      switch (form) {
        case 'unknown-exponent':
          b = rng.int(2, 6); k = rng.intWhere(1, 3, function (k) { return ipow(b, k) <= 125; });
          return { form: form, b: b, k: k };
        case 'unknown-base':
          n = rng.pick([2, 3, 3]); b = rng.intWhere(2, 9, function (b) { return ipow(b, n) <= 1000; });
          return { form: form, n: n, b: b };
        case 'square':
          return { form: form, b: rng.int(2, 12) };
        case 'power-of-ten':
          k = rng.int(1, 4); var m = rng.int(2, 5);
          return { form: form, k: k, m: m, flip: rng.chance(0.5) };
        case 'reciprocal-base':
          b = rng.pick([2, 3, 5]); var p = rng.intWhere(2, 9, function (p) { return ipow(b, p) >= 8 && ipow(b, p) <= 1000; });
          return { form: form, b: b, p: p, k: rng.int(1, 4) };
        default: // common-base: (r^a)^(x+j) = r^c
          var pairs = [[2, 2], [2, 3], [3, 2], [5, 2]];
          var pr = rng.pick(pairs), r = pr[0], a = pr[1];
          var c = rng.intWhere(1, 9, function (c) { return ipow(r, c) <= 1000 && c % a !== 0; });
          return { form: form, r: r, a: a, c: c, j: rng.pick([-2, -1, 1, 2]) };
      }
    },
    render: function (x) {
      function lin(x, k) { return k === 0 ? x : x + (k > 0 ? '+' : '-') + Math.abs(k); }
      var b = x.b, k = x.k, n = x.n, V;
      switch (x.form) {
        case 'unknown-exponent':
          V = ipow(b, k);
          var st = [];
          if (k > 1) st.push('$' + b + '^x = ' + dfrac(1, pow(b, k)) + '$');
          st.push('$' + b + '^x = ' + pow(b, -k) + '$', 'Same base, so the exponents are equal');
          return { prompt: '$' + b + '^x = ' + dfrac(1, num(V)) + '$', steps: st, answer: '$x=' + -k + '$' };
        case 'unknown-base':
          V = ipow(b, n);
          return {
            prompt: '$x^{' + -n + '} = ' + dfrac(1, num(V)) + '$',
            steps: ['$' + dfrac(1, 'x^' + n) + ' = ' + dfrac(1, pow(b, n)) + '$', '$x^' + n + ' = ' + pow(b, n) + '$'],
            answer: '$x=' + (n % 2 ? '' : '\\pm') + b + '$'
          };
        case 'square':
          return {
            prompt: '$x^2 = ' + dfrac(1, b * b) + '$',
            steps: ['$x^2 = \\left(' + dfrac(1, b) + '\\right)^2$ or $x^2 = \\left(-' + dfrac(1, b) + '\\right)^2$'],
            answer: '$x=\\pm\\frac{1}{' + b + '}$'
          };
        case 'power-of-ten':
          var m = x.m, flip = x.flip;
          var dec = '0.' + '0'.repeat(m - 1) + '1';
          var ex = flip ? 'x+' + k : k + '-x';
          var s = ['$10^{' + ex + '} = ' + dfrac(1, num(ipow(10, m))) + ' = ' + dfrac(1, pow(10, m)) + '$', '$10^{' + ex + '} = 10^{' + -m + '}$'];
          if (flip) s.push('$x + ' + k + ' = ' + -m + '$');
          else s.push('$' + k + ' - x = ' + -m + '$', '$-x = ' + (-m - k) + '$');
          return { prompt: '$10^{' + ex + '} = ' + dec + '$', steps: s, answer: '$x=' + (flip ? -m - k : m + k) + '$' };
        case 'reciprocal-base':
          var p = x.p;
          return {
            prompt: '$' + num(ipow(b, p)) + ' = \\left(' + dfrac(1, b) + '\\right)^{x+' + k + '}$',
            steps: [
              '$' + pow(b, p) + ' = \\left(' + pow(b, -1) + '\\right)^{x+' + k + '}$',
              '$' + pow(b, p) + ' = ' + pow(b, '-x-' + k) + '$',
              '$' + p + ' = -x - ' + k + '$',
              '$' + (p + k) + ' = -x$'
            ],
            answer: '$x=' + -(p + k) + '$'
          };
        default: // common-base
          var r = x.r, a = x.a, c = x.c, j = x.j;
          var aj = a * j;
          var xs = frac(c - aj, a);
          return {
            prompt: '$' + pow(ipow(r, a), lin('x', j)) + ' = ' + num(ipow(r, c)) + '$',
            steps: [
              '$\\left(' + pow(r, a) + '\\right)^{' + lin('x', j) + '} = ' + pow(r, c) + '$',
              '$' + pow(r, lin(a + 'x', aj)) + ' = ' + pow(r, c) + '$',
              '$' + lin(a + 'x', aj) + ' = ' + c + '$',
              '$' + a + 'x = ' + (c - aj) + '$'
            ],
            answer: '$x=' + fracTex(xs) + '$'
          };
      }
    }
  });
})(typeof window !== 'undefined' ? window : this);
