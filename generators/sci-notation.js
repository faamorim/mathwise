/*
 * Scientific notation (Math 9). Numbers are built from digit strings, never
 * floats, so 0.0000563 stays exactly 0.0000563. Needs generators/core.js first.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var M = root.Mathwise.math;
  var pow = M.pow;

  // Significant digits: first and last nonzero, like "37", "4961", "8".
  function digits(rng, n) {
    var s = String(rng.int(1, 9));
    for (var i = 1; i < n; i++) s += String(i === n - 1 ? rng.int(1, 9) : rng.int(0, 9));
    return s;
  }
  // The number (digits s) x 10^e written out in full: standard("37", 6) = "3700000".
  function standard(s, e) {
    if (e < 0) return '0.' + '0'.repeat(-e - 1) + s;
    var intLen = e + 1;
    if (s.length <= intLen) return s + '0'.repeat(intLen - s.length);
    return s.slice(0, intLen) + '.' + s.slice(intLen);
  }
  function mantissa(s) { return s.length > 1 ? s[0] + '.' + s.slice(1) : s; }
  function sci(s, e) { return mantissa(s) + '\\times' + pow(10, e); }
  function moves(e) {
    var n = Math.abs(e);
    return 'The decimal point moves ' + n + ' place' + (n === 1 ? '' : 's') + ' ' + (e > 0 ? 'left' : 'right') +
      ', so the exponent is $' + e + '$';
  }

  G.register({
    name: 'sci.to-scientific',
    topic: 'Scientific notation',
    title: 'Write numbers in scientific notation',
    prompt: 'Write in scientific notation',
    columns: 2,
    workSpace: 1,
    params: [
      { key: 'sizes', label: 'Numbers', type: 'set', default: ['large', 'small'],
        values: [{ value: 'large', label: 'Large, like 3700000' }, { value: 'small', label: 'Small, like 0.0000001' }] },
      { key: 'digits', label: 'Most significant digits', type: 'number', min: 1, max: 5, default: 2 },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 2, max: 12, default: 8 }
    ],
    variables: [
      { key: 'digits', label: 'Significant digits', kind: 'digits' },
      { key: 'exponent', label: 'Power of ten', kind: 'int', min: -20, max: 20, nonzero: true }
    ],
    pick: function (v, rng, ctx) {
      var size = ctx.spread('sizes', rng);
      var s = digits(rng, rng.int(1, v.digits));
      var e = size === 'large' ? rng.int(2, v.maxExponent) : -rng.int(2, v.maxExponent);
      return { digits: s, exponent: e };
    },
    render: function (x) {
      var s = x.digits, e = x.exponent;
      return { prompt: '$' + standard(s, e) + ' =$', steps: [moves(e)], answer: '$' + sci(s, e) + '$', slots: { places: Math.abs(e) } };
    }
  });

  G.register({
    name: 'sci.normalize',
    topic: 'Scientific notation',
    title: 'Fix numbers that are not quite in scientific notation',
    prompt: 'Write in scientific notation',
    columns: 2,
    workSpace: 1,
    params: [
      { key: 'shifts', label: 'Coefficient', type: 'set', default: ['too-big', 'too-small'],
        values: [{ value: 'too-big', label: 'Too big, like 247 × 10⁸' }, { value: 'too-small', label: 'Too small, like 0.087 × 10³' }] },
      { key: 'digits', label: 'Significant digits', type: 'number', min: 2, max: 4, default: 3 },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 2, max: 15, default: 12 }
    ],
    variables: [
      { key: 'digits', label: 'Significant digits', kind: 'digits' },
      { key: 'shift', label: 'Places the coefficient is off (+ too big, − too small)', kind: 'int', min: -6, max: 6, nonzero: true },
      { key: 'exponent', label: 'Power of ten as written', kind: 'int', min: -30, max: 30 }
    ],
    pick: function (v, rng, ctx) {
      var kind = ctx.spread('shifts', rng);
      var s = digits(rng, rng.int(2, v.digits));
      var sh = kind === 'too-big' ? rng.int(1, 2) : -rng.int(1, 3);
      var k = rng.intWhere(-v.maxExponent, v.maxExponent, function (k) { return k !== 0 && k + sh !== 0; });
      return { digits: s, shift: sh, exponent: k };
    },
    render: function (x) {
      var s = x.digits, sh = x.shift, k = x.exponent;
      return {
        prompt: '$' + standard(s, sh) + '\\times' + pow(10, k) + ' =$',
        steps: [
          '$= ' + mantissa(s) + '\\times' + pow(10, sh) + '\\times' + pow(10, k) + '$',
          '$= ' + mantissa(s) + '\\times' + pow(10, M.opExp(sh, '+', k)) + '$'
        ],
        answer: '$' + sci(s, sh + k) + '$',
        slots: { result: sh + k }
      };
    }
  });

  G.register({
    name: 'sci.find-exponent',
    topic: 'Scientific notation',
    title: 'Find the power of ten',
    prompt: 'Find each value for $n$',
    columns: 1,
    workSpace: 1.5,
    params: [
      { key: 'sizes', label: 'Numbers', type: 'set', default: ['large', 'small'],
        values: [{ value: 'large', label: 'Large or bigger than 10' }, { value: 'small', label: 'Small (less than 1)' }] },
      { key: 'digits', label: 'Significant digits', type: 'number', min: 1, max: 5, default: 4 },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 1, max: 12, default: 9 }
    ],
    variables: [
      { key: 'digits', label: 'Significant digits', kind: 'digits' },
      { key: 'exponent', label: 'n', kind: 'int', min: -20, max: 20, nonzero: true }
    ],
    pick: function (v, rng, ctx) {
      var size = ctx.spread('sizes', rng);
      var s = digits(rng, rng.int(Math.min(2, v.digits), v.digits));
      var e = size === 'large' ? rng.int(1, v.maxExponent) : -rng.int(1, v.maxExponent);
      return { digits: s, exponent: e };
    },
    render: function (x) {
      var s = x.digits, e = x.exponent;
      return { prompt: '$' + standard(s, e) + ' = ' + mantissa(s) + '\\times10^n$', steps: [moves(e)], answer: '$n=' + e + '$' };
    }
  });

  // ---------- multiply and divide ----------
  // A decimal is { c, k }: the whole number c times 10^-k, so 2.5 = { c: 25, k: 1 }.
  function dec(s) { return { c: parseInt(s, 10), k: s.length - 1 }; }
  function decMul(a, b) { return { c: a.c * b.c, k: a.k + b.k }; }
  function decDiv(a, b) {
    for (var m = 0; m <= 8; m++) {
      var top = a.c * Math.pow(10, m);
      if (top % b.c === 0) return { c: top / b.c, k: a.k - b.k + m };
    }
    return null;   // does not end within 8 decimal places
  }
  function decText(x) {
    var c = String(x.c), k = x.k;
    if (k <= 0) return c + '0'.repeat(-k);
    while (c.length <= k) c = '0' + c;
    var s = c.slice(0, c.length - k) + '.' + c.slice(c.length - k);
    return s.replace(/\.?0+$/, '');
  }
  // The decimal as significant digits and a power of ten: 20 -> { digits: '2', shift: 1 }.
  function decSci(x) {
    var c = String(x.c), shift = c.length - 1 - x.k;
    return { digits: c.replace(/0+$/, ''), shift: shift };
  }
  function sciMD(x) {
    var a = dec(x.digits1), b = dec(x.digits2);
    var r = x.op === 'multiply' ? decMul(a, b) : decDiv(a, b);
    if (!r) return null;
    var n = decSci(r), e = x.op === 'multiply' ? x.exponent1 + x.exponent2 : x.exponent1 - x.exponent2;
    return { value: r, sci: n, exponent: e };
  }
  var MD_OPS = [{ value: 'multiply', label: 'Multiply' }, { value: 'divide', label: 'Divide' }];

  G.register({
    name: 'sci.multiply-divide',
    topic: 'Scientific notation',
    title: 'Multiply and divide in scientific notation',
    prompt: 'Calculate. Write each answer in scientific notation.',
    columns: 2,
    workSpace: 2,
    params: [
      { key: 'ops', label: 'Operations', type: 'set', default: ['multiply', 'divide'], values: MD_OPS },
      { key: 'digits', label: 'Significant digits in each number', type: 'number', min: 1, max: 3, default: 2 },
      { key: 'maxExponent', label: 'Largest exponent (size)', type: 'number', min: 1, max: 15, default: 9 },
      { key: 'negatives', label: 'Negative exponents', type: 'toggle', default: true },
      { key: 'fix', label: 'Answers that need the decimal point moved (like 20 × 10⁹)', type: 'choice', default: 'some',
        values: [{ value: 'some', label: 'Some' }, { value: 'none', label: 'None' }, { value: 'all', label: 'All' }] }
    ],
    variables: [
      { key: 'op', label: 'Operation', kind: 'choice', values: MD_OPS },
      { key: 'digits1', label: 'First number: significant digits', kind: 'digits' },
      { key: 'exponent1', label: 'First number: power of ten', kind: 'int', min: -30, max: 30 },
      { key: 'digits2', label: 'Second number: significant digits', kind: 'digits' },
      { key: 'exponent2', label: 'Second number: power of ten', kind: 'int', min: -30, max: 30 }
    ],
    checkVars: function (x) {
      return sciMD(x) ? [] : ['These coefficients do not divide evenly: choose numbers whose quotient ends, like 8.4 ÷ 2.'];
    },
    pick: function (v, rng, ctx) {
      var op = ctx.spread('ops', rng), x;
      function exp() { var e = rng.int(v.negatives ? -v.maxExponent : 1, v.maxExponent); return e === 0 ? 1 : e; }
      for (var t = 0; t < 100; t++) {
        var p = digits(rng, rng.int(1, v.digits)), q = digits(rng, rng.int(1, v.digits));
        if (op === 'multiply') x = { op: op, digits1: p, exponent1: exp(), digits2: q, exponent2: exp() };
        else {
          // Built answer first: dividend = quotient × divisor, written in scientific notation.
          var e2 = exp(), eq = exp(), d = decSci(decMul(dec(p), dec(q)));
          x = { op: op, digits1: d.digits, exponent1: eq + e2 + d.shift, digits2: q, exponent2: e2 };
          if (x.exponent1 === 0 || d.digits.length > v.digits + 1 || Math.abs(x.exponent1) > v.maxExponent + 1 || (!v.negatives && x.exponent1 < 1)) continue;
        }
        if (p === '1' || q === '1') continue;
        var r = sciMD(x), moved = r && r.sci.shift !== 0;
        if (!r || r.exponent + r.sci.shift === 0) continue;
        // Some: every other part needs the decimal point moved.
        var want = v.fix === 'all' || (v.fix === 'some' && (typeof ctx.index === 'number' ? ctx.index % 2 === 1 : moved));
        if (want === moved) return x;
      }
      return x;
    },
    render: function (x) {
      var r = sciMD(x), m1 = mantissa(x.digits1), m2 = mantissa(x.digits2);
      var t1 = pow(10, x.exponent1), t2 = pow(10, x.exponent2);
      var mul = x.op === 'multiply';
      var P = decText(r.value), E = r.exponent, sh = r.sci.shift;
      var steps = [
        mul ? '$= (' + m1 + '\\times' + m2 + ')\\times(' + t1 + '\\times' + t2 + ')$'
          : '$= \\dfrac{' + m1 + '}{' + m2 + '}\\times\\dfrac{' + t1 + '}{' + t2 + '}$',
        '$= ' + P + '\\times' + pow(10, M.opExp(x.exponent1, mul ? '+' : '-', x.exponent2)) + '$',
        '$= ' + P + '\\times' + pow(10, E) + '$'
      ];
      var answer = sci(r.sci.digits, E + sh);
      if (sh === 0) steps.pop();   // already the answer
      if (sh !== 0) {
        steps.push('$= ' + mantissa(r.sci.digits) + '\\times' + pow(10, sh) + '\\times' + pow(10, E) + '$');
        steps.push('$= ' + mantissa(r.sci.digits) + '\\times' + pow(10, M.opExp(sh, '+', E)) + '$');
      }
      return {
        prompt: mul ? '$(' + sci(x.digits1, x.exponent1) + ')(' + sci(x.digits2, x.exponent2) + ') =$'
          : '$\\dfrac{' + sci(x.digits1, x.exponent1) + '}{' + sci(x.digits2, x.exponent2) + '} =$',
        steps: steps,
        answer: '$' + answer + '$',
        slots: { result: E + sh }
      };
    }
  });

  root.Mathwise.sci = { standard: standard, mantissa: mantissa };
})(typeof window !== 'undefined' ? window : this);
