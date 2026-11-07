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

  root.Mathwise.sci = { standard: standard, mantissa: mantissa };
})(typeof window !== 'undefined' ? window : this);
