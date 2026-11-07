/*
 * Factoring polynomials (Math 10): greatest common factor, difference of squares,
 * perfect square trinomials, trinomials (cross method or sum and product), and
 * four-term polynomials (grouping). Needs generators/core.js first.
 *
 * Every question is built answer first: pick the factors, then expand them.
 * A method setting only changes the worked steps, never the numbers.
 * Ported from the Factoring practice app (faamorim/Factoring), rewritten as
 * question templates with LaTeX output.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var M = root.Mathwise.math;
  var gcd = M.gcd, num = M.num, mono = M.mono;

  function gcdAll(list) { return list.reduce(function (g, x) { return gcd(g, x); }, 0); }
  function isSquare(n) { var r = Math.round(Math.sqrt(n)); return n > 0 && r * r === n; }

  // c·v^e as the first term of a polynomial or a following one (with its sign).
  function termTex(c, v, e, first) {
    if (first) return mono(c, v, e);
    return (c < 0 ? '-' : '+') + mono(Math.abs(c), v, e);
  }
  // [{ c, e }] -> "6x^2+7x-3" (zero terms skipped).
  function polyTex(terms, v) {
    var out = '';
    terms.forEach(function (t) { if (t.c !== 0) out += termTex(t.c, v, t.e, out === ''); });
    return out || '0';
  }
  // (px^m + r) as text without brackets: "2x+3", "x-5", "3x^2-1".
  function binTex(p, v, m, r) { return polyTex([{ c: p, e: m }, { c: r, e: 0 }], v); }
  // a^2, with brackets unless a is a single letter: x^2, (3x)^2, (x^3)^2.
  function sq(a) { return (/^[a-z]$/.test(a) ? a : '(' + a + ')') + '^2'; }
  // A number written after an operator: wraps negatives, (−2).
  function sn(n) { return n < 0 ? '(' + num(n) + ')' : num(n); }

  var LETTER_PARAM = { key: 'otherLetters', label: 'Letters other than x', type: 'toggle', default: false };
  var LETTERS = ['a', 'b', 'k', 'm', 'n', 'p', 't', 'w', 'y', 'z'];
  function pickLetter(v, rng) { return v.otherLetters ? rng.pick(LETTERS) : 'x'; }
  var LETTER_VAR = { key: 'letter', label: 'Variable', kind: 'letter' };

  // ---------------------------------------------------------------------
  // Greatest common factor: g x^k (c1 x^e1 + c2 x^e2 + ...)
  G.register({
    name: 'factoring.gcf',
    topic: 'Factoring',
    title: 'Factor out the greatest common factor',
    prompt: 'Factor',
    columns: 2,
    workSpace: 1.5,
    params: [
      { key: 'terms', label: 'Terms', type: 'number', min: 2, max: 4, default: 3 },
      { key: 'maxFactor', label: 'Largest number in the common factor', type: 'number', min: 2, max: 12, default: 6 },
      { key: 'variableFactor', label: 'Common factor includes the variable', type: 'toggle', default: true },
      { key: 'negatives', label: 'Negative coefficients', type: 'toggle', default: true },
      LETTER_PARAM
    ],
    variables: [
      LETTER_VAR,
      { key: 'g', label: 'Common number', kind: 'int', min: 1 },
      { key: 'k', label: 'Common power of the variable', kind: 'int', min: 0, max: 6 },
      { key: 'coefficients', label: 'Coefficients left inside', kind: 'list', of: { kind: 'int', nonzero: true }, minLength: 2, maxLength: 5 },
      { key: 'exponents', label: 'Powers left inside', kind: 'list', of: { kind: 'int', min: 0, max: 6 }, minLength: 2, maxLength: 5 }
    ],
    checkVars: function (x) {
      if (x.exponents.length !== x.coefficients.length) return ['Give one power for each coefficient.'];
      var seen = {};
      for (var i = 0; i < x.exponents.length; i++) {
        if (seen[x.exponents[i]]) return ['Each power inside can appear only once (otherwise they are like terms).'];
        seen[x.exponents[i]] = true;
      }
      if (Math.min.apply(null, x.exponents) > 0) {
        return ['One term inside must have no ' + x.letter + ', or the common factor is not the greatest.'];
      }
      if (gcdAll(x.coefficients) !== 1) return ['The coefficients inside still share a factor, so the common factor is not the greatest.'];
      if (x.g === 1 && x.k === 0) return ['There is no common factor to take out (number 1 and power 0).'];
      return [];
    },
    pick: function (v, rng) {
      var letter = pickLetter(v, rng);
      var g = rng.int(2, v.maxFactor);
      var k = v.variableFactor ? rng.int(1, 3) : 0;
      var exps = rng.shuffle([0, 1, 2, 3]).slice(0, v.terms).sort(function (a, b) { return b - a; });
      if (exps.indexOf(0) < 0) exps[exps.length - 1] = 0;
      var coefs;
      for (var t = 0; t < 100; t++) {
        coefs = exps.map(function (e, i) {
          var c = rng.int(1, 9);
          return v.negatives && i > 0 && rng.chance(0.4) ? -c : c;
        });
        if (gcdAll(coefs) === 1) break;
      }
      if (gcdAll(coefs) !== 1) coefs[0] = 1;
      return { letter: letter, g: g, k: k, coefficients: coefs, exponents: exps };
    },
    render: function (x) {
      var v = x.letter, g = x.g, k = x.k;
      var outer = polyTex([{ c: g, e: k }], v);
      var full = x.coefficients.map(function (c, i) { return { c: g * c, e: x.exponents[i] + k }; });
      var inside = polyTex(x.coefficients.map(function (c, i) { return { c: c, e: x.exponents[i] }; }), v);
      var steps = [];
      steps.push('Greatest common factor of the numbers $' + full.map(function (t) { return num(Math.abs(t.c)); }).join(',\\ ') + '$: $' + g + '$');
      if (k > 0) steps.push('Lowest power of $' + v + '$: $' + mono(1, v, k) + '$');
      steps.push('Greatest common factor: $' + outer + '$');
      var split = '';
      x.coefficients.forEach(function (c, i) {
        split += (i === 0 ? (c < 0 ? '-' : '') : (c < 0 ? '-' : '+')) + outer + '\\cdot ' + mono(Math.abs(c), v, x.exponents[i]);
      });
      steps.push('$= ' + split + '$');
      steps.push('$= ' + outer + '(' + inside + ')$');
      return { prompt: '$' + polyTex(full, v) + '$', steps: steps, answer: '$' + outer + '(' + inside + ')$', slots: { gcf: outer, inside: inside } };
    }
  });

  // ---------------------------------------------------------------------
  // Difference of squares: (p x^m)^2 - q^2 = (p x^m - q)(p x^m + q)
  G.register({
    name: 'factoring.difference-of-squares',
    topic: 'Factoring',
    title: 'Factor a difference of squares',
    prompt: 'Factor',
    columns: 3,
    workSpace: 1,
    params: [
      { key: 'coefficients', label: 'Square number in front of the variable, like 9x²', type: 'toggle', default: true },
      { key: 'maxRoot', label: 'Largest square root of the number', type: 'number', min: 2, max: 15, default: 10 },
      { key: 'higherPowers', label: 'Higher powers, like x⁶', type: 'toggle', default: false },
      LETTER_PARAM
    ],
    variables: [
      LETTER_VAR,
      { key: 'p', label: 'Square root of the first coefficient', kind: 'int', min: 1, max: 30 },
      { key: 'm', label: 'Power of the variable inside the square', kind: 'int', min: 1, max: 5 },
      { key: 'q', label: 'Square root of the number', kind: 'int', min: 1, max: 100 }
    ],
    checkVars: function (x) {
      if (gcd(x.p, x.q) !== 1) return ['$' + x.p + '$ and $' + x.q + '$ share a factor: take out the common factor first (use Full factoring).'];
      if (x.m % 2 === 0) return ['With the power ' + x.m + ', the first factor factors again: use Full factoring.'];
      return [];
    },
    pick: function (v, rng) {
      var letter = pickLetter(v, rng);
      var m = v.higherPowers && rng.chance(0.5) ? 3 : 1;
      var p, q;
      for (var t = 0; t < 100; t++) {
        p = v.coefficients && rng.chance(0.6) ? rng.int(2, Math.min(7, v.maxRoot)) : 1;
        q = rng.int(1, v.maxRoot);
        if (gcd(p, q) === 1 && !(p === 1 && q === 1)) break;
      }
      return { letter: letter, p: p, m: m, q: q };
    },
    render: function (x) {
      var v = x.letter, a = polyTex([{ c: x.p, e: x.m }], v);
      return {
        prompt: '$' + polyTex([{ c: x.p * x.p, e: 2 * x.m }, { c: -x.q * x.q, e: 0 }], v) + '$',
        steps: [
          'Both terms are perfect squares, and they are subtracted',
          '$= ' + sq(a) + '-' + x.q + '^2$',
          '$= (' + a + '+' + x.q + ')(' + a + '-' + x.q + ')$'
        ],
        answer: '$(' + a + '+' + x.q + ')(' + a + '-' + x.q + ')$',
        slots: { first: a }
      };
    }
  });

  // ---------------------------------------------------------------------
  // Perfect square trinomial: (p x + q)^2 = p²x² + 2pq x + q²
  G.register({
    name: 'factoring.perfect-square',
    topic: 'Factoring',
    title: 'Factor a perfect square trinomial',
    prompt: 'Factor',
    columns: 2,
    workSpace: 1.5,
    params: [
      { key: 'coefficients', label: 'Square number in front of x², like 9x²', type: 'toggle', default: true },
      { key: 'maxRoot', label: 'Largest square root of the last number', type: 'number', min: 2, max: 12, default: 9 },
      { key: 'negatives', label: 'Negative middle term', type: 'toggle', default: true },
      LETTER_PARAM
    ],
    variables: [
      LETTER_VAR,
      { key: 'p', label: 'Square root of the first coefficient', kind: 'int', min: 1, max: 30 },
      { key: 'q', label: 'Square root of the last number (with the middle sign)', kind: 'int', min: -100, max: 100, nonzero: true }
    ],
    checkVars: function (x) {
      return gcd(x.p, x.q) !== 1 ? ['$' + x.p + '$ and $' + x.q + '$ share a factor: take out the common factor first.'] : [];
    },
    pick: function (v, rng) {
      var letter = pickLetter(v, rng);
      var p, q;
      for (var t = 0; t < 100; t++) {
        p = v.coefficients && rng.chance(0.5) ? rng.int(2, 5) : 1;
        q = rng.int(1, v.maxRoot);
        if (gcd(p, q) === 1) break;
      }
      if (v.negatives && rng.chance(0.5)) q = -q;
      return { letter: letter, p: p, q: q };
    },
    render: function (x) {
      var v = x.letter, p = x.p, q = x.q, aq = Math.abs(q);
      var a = polyTex([{ c: p, e: 1 }], v);
      var root = '(' + binTex(p, v, 1, q) + ')^2';
      return {
        prompt: '$' + polyTex([{ c: p * p, e: 2 }, { c: 2 * p * q, e: 1 }, { c: q * q, e: 0 }], v) + '$',
        steps: [
          'First and last terms are squares: $' + polyTex([{ c: p * p, e: 2 }], v) + (p === 1 ? '' : '=' + sq(a)) + '$ and $' + num(q * q) + '=' + aq + '^2$',
          'Middle term: $2(' + a + ')(' + aq + ')=' + polyTex([{ c: 2 * p * aq, e: 1 }], v) + '$, with the sign ' + (q < 0 ? '$-$' : '$+$'),
          '$= ' + root + '$'
        ],
        answer: '$' + root + '$'
      };
    }
  });

  // ---------------------------------------------------------------------
  // Trinomials: (p x + r)(q x + s) = pq x² + (ps + qr) x + rs.
  // Methods only change the steps: cross method (tasuki-gake) or sum and product
  // (a = 1: two numbers; a ≠ 1: ac, split the middle term, group).
  var METHODS = [
    { value: 'cross', label: 'Cross method' },
    { value: 'sum-product', label: 'Sum and product (split the middle term)' }
  ];

  function trinomialSteps(x, method) {
    var v = x.letter, p = x.p, r = x.r, q = x.q, s = x.s;
    var a = p * q, b = p * s + q * r, c = r * s;
    var ans = '(' + binTex(p, v, 1, r) + ')(' + binTex(q, v, 1, s) + ')';
    if (method === 'cross') {
      var px = mono(p, v, 1), qx = mono(q, v, 1);
      return [
        'Factors of $' + num(a) + '$ (left) and $' + num(c) + '$ (right); cross products add to $' + mono(b, v, 1) + '$',
        '$\\begin{array}{rrcl}' +
          px + ' & ' + num(r) + ' & \\to & ' + qx + '\\times' + sn(r) + '=' + mono(q * r, v, 1) + '\\\\' +
          qx + ' & ' + num(s) + ' & \\to & ' + px + '\\times' + sn(s) + '=' + mono(p * s, v, 1) + '\\\\ \\hline' +
          ' & & & ' + polyTex([{ c: q * r, e: 1 }], v) + termTex(p * s, v, 1, false) + '=' + mono(b, v, 1) +
        '\\end{array}$',
        'Read across the rows',
        '$= ' + ans + '$'
      ];
    }
    if (a === 1) {
      return [
        'Two numbers that multiply to $' + num(c) + '$ and add to $' + num(b) + '$: $' + num(r) + '$ and $' + num(s) + '$',
        '$= ' + ans + '$'
      ];
    }
    var m1 = p * s, m2 = q * r;
    return [
      '$ac=' + num(a) + '\\times' + sn(c) + '=' + num(a * c) + '$',
      'Two numbers that multiply to $' + num(a * c) + '$ and add to $' + num(b) + '$: $' + num(m1) + '$ and $' + num(m2) + '$',
      'Split the middle term and group',
      '$= ' + polyTex([{ c: a, e: 2 }, { c: m1, e: 1 }], v) + termTex(m2, v, 1, false) + termTex(c, v, 0, false) + '$',
      '$= ' + mono(p, v, 1) + '(' + binTex(q, v, 1, s) + ')' + termTex(r, v, 0, false) + '(' + binTex(q, v, 1, s) + ')$',
      '$= ' + ans + '$'
    ];
  }

  G.register({
    name: 'factoring.trinomial',
    topic: 'Factoring',
    title: 'Factor trinomials',
    prompt: 'Factor',
    columns: 2,
    workSpace: 2,
    params: [
      { key: 'leading', label: 'Leading coefficient a', type: 'set', default: ['one'],
        values: [
          { value: 'one', label: 'a = 1, like x² + 5x + 6' },
          { value: 'prime', label: 'a is prime, like 3x² + 7x + 2' },
          { value: 'composite', label: 'a has several factors, like 6x² + 7x − 3' }
        ] },
      { key: 'maxConstant', label: 'Largest number in the factors', type: 'number', min: 2, max: 12, default: 7 },
      { key: 'negatives', label: 'Negative numbers', type: 'toggle', default: true },
      { key: 'methods', label: 'Worked steps by', type: 'set', default: ['cross'], values: METHODS },
      LETTER_PARAM
    ],
    variables: [
      LETTER_VAR,
      { key: 'p', label: 'First factor: coefficient of the variable', kind: 'int', min: 1, max: 20 },
      { key: 'r', label: 'First factor: number', kind: 'int', min: -50, max: 50, nonzero: true },
      { key: 'q', label: 'Second factor: coefficient of the variable', kind: 'int', min: 1, max: 20 },
      { key: 's', label: 'Second factor: number', kind: 'int', min: -50, max: 50, nonzero: true },
      { key: 'methods', label: 'Worked steps by', kind: 'list', of: { kind: 'choice', values: METHODS }, minLength: 1, maxLength: 2 }
    ],
    checkVars: function (x) {
      if (gcd(x.p, x.r) !== 1 || gcd(x.q, x.s) !== 1) return ['A factor has a common factor inside it: take it out first (use Full factoring).'];
      if (x.p * x.s + x.q * x.r === 0) return ['The middle term would be 0: that is a difference of squares.'];
      return [];
    },
    pick: function (v, rng, ctx) {
      var lead = ctx.spread('leading', rng);
      var letter = pickLetter(v, rng);
      var p = 1, q = 1, r, s;
      if (lead === 'prime') { q = rng.pick([2, 3, 5, 7]); }
      else if (lead === 'composite') {
        var pair = rng.pick([[2, 2], [2, 3], [1, 4], [1, 6], [2, 4], [3, 3], [2, 5], [3, 4], [2, 6], [1, 8], [1, 9]]);
        p = pair[0]; q = pair[1];
      }
      function n() { var k = rng.int(1, v.maxConstant); return v.negatives && rng.chance(0.5) ? -k : k; }
      for (var t = 0; t < 200; t++) {
        r = n(); s = n();
        if (gcd(p, r) === 1 && gcd(q, s) === 1 && p * s + q * r !== 0 && !(p === q && r === s && lead !== 'one')) break;
      }
      // Leading factor first in the answer when a is prime: (3x + 1)(x + 2) reads better.
      if (lead === 'prime' && rng.chance(0.5)) { var tp = p; p = q; q = tp; var tr = r; r = s; s = tr; }
      return { letter: letter, p: p, r: r, q: q, s: s, methods: v.methods.slice() };
    },
    render: function (x) {
      var v = x.letter, a = x.p * x.q, b = x.p * x.s + x.q * x.r, c = x.r * x.s;
      var methods = METHODS.filter(function (m) { return x.methods.indexOf(m.value) >= 0; }).map(function (m) {
        return { method: m.value, label: m.label, steps: trinomialSteps(x, m.value) };
      });
      var steps = [];
      methods.forEach(function (m) {
        if (methods.length > 1) steps.push(m.label + ':');
        steps = steps.concat(m.steps);
      });
      return {
        prompt: '$' + polyTex([{ c: a, e: 2 }, { c: b, e: 1 }, { c: c, e: 0 }], v) + '$',
        steps: steps,
        methods: methods,
        answer: '$(' + binTex(x.p, v, 1, x.r) + ')(' + binTex(x.q, v, 1, x.s) + ')$',
        slots: { a: a, b: b, c: c }
      };
    }
  });

  // ---------------------------------------------------------------------
  // Four-term polynomials (grouping): (x + a)(b x^n + c) = b x^{n+1} + ab x^n + c x + ac
  G.register({
    name: 'factoring.four-term',
    topic: 'Factoring',
    title: 'Factor four-term polynomials by grouping',
    prompt: 'Factor',
    columns: 2,
    workSpace: 2,
    params: [
      { key: 'maxConstant', label: 'Largest number in the factors', type: 'number', min: 2, max: 12, default: 8 },
      { key: 'coefficients', label: 'Number in front of the higher power, like 3x²', type: 'toggle', default: true },
      { key: 'negatives', label: 'Negative numbers', type: 'toggle', default: true },
      LETTER_PARAM
    ],
    variables: [
      LETTER_VAR,
      { key: 'a', label: 'Number in the first factor (x + a)', kind: 'int', min: -50, max: 50, nonzero: true },
      { key: 'b', label: 'Coefficient in the second factor', kind: 'int', min: 1, max: 20 },
      { key: 'n', label: 'Power in the second factor', kind: 'int', min: 2, max: 4 },
      { key: 'c', label: 'Number in the second factor', kind: 'int', min: -50, max: 50, nonzero: true }
    ],
    checkVars: function (x) {
      if (gcd(x.b, x.c) !== 1) return ['$' + x.b + '$ and $' + x.c + '$ share a factor: take it out first.'];
      if (x.n % 2 === 0 && x.c < 0 && isSquare(x.b) && isSquare(-x.c)) return ['The second factor is a difference of squares and factors again: use Full factoring.'];
      return [];
    },
    pick: function (v, rng) {
      var letter = pickLetter(v, rng);
      var a, b, c;
      for (var t = 0; t < 200; t++) {
        a = rng.int(1, v.maxConstant); if (v.negatives && rng.chance(0.5)) a = -a;
        b = v.coefficients ? rng.int(1, 6) : 1;
        c = rng.int(1, v.maxConstant); if (v.negatives && rng.chance(0.5)) c = -c;
        if (gcd(b, c) === 1 && !(c < 0 && isSquare(b) && isSquare(-c))) break;
      }
      return { letter: letter, a: a, b: b, n: 2, c: c };
    },
    render: function (x) {
      var v = x.letter, a = x.a, b = x.b, n = x.n, c = x.c;
      var f1 = binTex(1, v, 1, a), f2 = binTex(b, v, n, c);
      var t = [{ c: b, e: n + 1 }, { c: a * b, e: n }, { c: c, e: 1 }, { c: a * c, e: 0 }];
      return {
        prompt: '$' + polyTex(t, v) + '$',
        steps: [
          '$= (' + polyTex(t.slice(0, 2), v) + ')' + (c < 0 ? '-(' + polyTex([{ c: -c, e: 1 }, { c: -a * c, e: 0 }], v) + ')' : '+(' + polyTex(t.slice(2), v) + ')') + '$',
          '$= ' + mono(b, v, n) + '(' + f1 + ')' + termTex(c, v, 0, false) + '(' + f1 + ')$',
          '$= (' + f1 + ')(' + f2 + ')$'
        ],
        answer: '$(' + f1 + ')(' + f2 + ')$'
      };
    }
  });

  root.Mathwise.factoring = { polyTex: polyTex, binTex: binTex, trinomialSteps: trinomialSteps };
})(typeof window !== 'undefined' ? window : this);
