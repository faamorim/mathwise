/*
 * Story questions from the library in generators/data/stories-*.js: one story,
 * then parts a), b), c) ... Calculation parts have worked steps; thinking parts
 * have possible answers (no single right answer). Each story becomes its own
 * question template "<topic>.<id>", whose variables are the story's varying
 * values; facts (real data) are never variables, only which fact is used.
 * The engine knows no story: add or edit stories in the data files.
 * Needs core.js, sci-notation.js and the data files first.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var D = root.Mathwise.data;
  var Sci = root.Mathwise.sci;
  var num = root.Mathwise.math.num;
  var TOPICS = { rates: 'Rates', sci: 'Scientific notation' };

  // ---------- helpers given to stories ----------
  function value(d) { return Number(Sci.mantissa(d.digits)) * Math.pow(10, d.exponent); }
  function sci(d) { return Sci.mantissa(d.digits) + '\\times10^{' + d.exponent + '}'; }
  function standard(d) { return num(Number(Sci.standard(d.digits, d.exponent))); }
  function round3(x) {
    var e = Math.floor(Math.log10(Math.abs(x)));
    var m = Math.round(x / Math.pow(10, e) * 100) / 100;
    if (m >= 10) { m /= 10; e++; }
    return { m: m, e: e, tex: m.toFixed(2) + '\\times10^{' + e + '}' };
  }
  function fact(table, key) { return D[table].items.filter(function (r) { return r.name === key; })[0]; }
  function sensible(x) {
    if (x >= 10) return num(Math.round(x));
    return String(Math.round(x * 10) / 10);
  }
  // a ÷ b in scientific notation, one rule per line; fmt(rounded, sciTex) gives the answer.
  function divide(a, b, fmt, keepSci) {
    var q = Number(Sci.mantissa(a.digits)) / Number(Sci.mantissa(b.digits)), e = a.exponent - b.exponent;
    var x = value(a) / value(b), r = round3(x);
    var steps = [
      '$\\dfrac{' + sci(a) + '}{' + sci(b) + '}$',
      '$= \\dfrac{' + Sci.mantissa(a.digits) + '}{' + Sci.mantissa(b.digits) + '}\\times10^{' + a.exponent + '-' + b.exponent + '}$',
      '$\\approx ' + (Math.round(q * 1000) / 1000) + '\\times10^{' + e + '}$'
    ];
    if (r.e !== e) steps.push('$\\approx ' + r.tex + '$');
    if (!keepSci) steps.push('$\\approx ' + sensible(x) + '$');
    var out = fmt(sensible(x), r.tex);
    out.steps = steps;
    return out;
  }
  var F = { num: num, sci: sci, standard: standard, value: value, round3: round3, fact: fact, divide: divide };

  function fill(text, slots) {
    return String(text).replace(/%([A-Za-z]+)%/g, function (m, k) { return slots[k] != null ? String(slots[k]) : m; });
  }

  // ---------- one template per story ----------
  function register(story) {
    var keys = Object.keys(story.values);
    var variables = keys.map(function (k) {
      var s = story.values[k];
      if (s.name) return { key: k, label: s.label || 'Name', kind: 'choice', values: D.names.map(function (n) { return { value: n, label: n }; }) };
      if (s.fact) return { key: k, label: (s.label || k) + ' (real data)', kind: 'choice', values: D[s.fact].items.map(function (r) { return { value: r.name, label: r.name }; }) };
      return { key: k, label: s.label || k, kind: 'int', min: 1, max: 100000 };
    });
    variables.push({ key: 'thinking', label: 'Include the thinking questions', kind: 'toggle' });

    G.register({
      name: story.topic + '.' + story.id,
      topic: TOPICS[story.topic] || story.topic,
      title: story.label,
      prompt: 'Answer each part',
      whole: true,
      workSpace: 2,
      params: [{ key: 'thinking', label: 'Thinking questions (no single right answer)', type: 'toggle', default: true }],
      variables: variables,
      checkVars: function (v) { return story.ok && !story.ok(v) ? [story.okMessage || 'These values do not fit this story.'] : []; },
      pick: function (p, rng) {
        var v;
        for (var t = 0; t < 300; t++) {
          v = {};
          keys.forEach(function (k) {
            var s = story.values[k];
            if (s.name) v[k] = rng.pick(D.names);
            else if (s.fact) v[k] = rng.pick(D[s.fact].items).name;
            else if (s.choose) v[k] = rng.pick(s.choose);
            else {
              var step = s.step || 1;
              v[k] = step * rng.int(Math.ceil(s.vary[0] / step), Math.floor(s.vary[1] / step));
            }
          });
          if (!story.ok || story.ok(v)) break;
        }
        v.thinking = p.thinking;   // a setting, not random: switching it never changes the numbers
        return v;
      },
      render: function (v) {
        var slots = {};
        // Numbers and givens are math: written as $…$ in the text.
        keys.forEach(function (k) { slots[k] = typeof v[k] === 'number' ? '$' + num(v[k]) + '$' : v[k]; });
        if (story.given) { var g = story.given(v, D, F); Object.keys(g).forEach(function (k) { slots[k] = '$' + g[k] + '$'; }); }
        var parts = [];
        story.parts.forEach(function (p) {
          if (p.think) {
            if (!v.thinking) return;
            parts.push({ prompt: fill(p.prompt, slots), answer: '*Possible answers:* ' + fill(p.think, slots), steps: [], thinking: true });
            return;
          }
          var r = p.solve(v, F, D);
          parts.push({ prompt: fill(p.prompt, slots), answer: r.answer, steps: r.steps || [] });
        });
        return { prompt: fill(story.stem, slots), answer: '', steps: [], parts: parts, slots: slots };
      }
    });
  }

  // ---------- fact families: product = factor × factor ----------
  // A family story keeps each quantity as its own piece (a sentence that gives it, a
  // question that asks for it), so the same story asks for the product (multiply) or
  // either factor (divide): two pieces are given, the third is asked. Format at the
  // top of data/stories-families.js.

  // A number in scientific notation is { digits, exponent } (1.496 x 10^8 = '1496', 8).
  function sigOf(str) {   // "0.0499" or "66.12" -> { digits, shift } (str = digits x 10^shift as sci)
    var t = str.replace('-', ''), i = t.indexOf('.'), intPart = i < 0 ? t : t.slice(0, i);
    var all = t.replace('.', ''), lead = all.match(/^0*/)[0].length;
    var digits = all.slice(lead).replace(/0+$/, '') || '0';
    var shift = intPart !== '0' && intPart !== '' ? intPart.replace(/^0+/, '').length - 1 : -lead;
    return { digits: digits, shift: shift };
  }
  function round3sig(d) {
    if (d.digits.length <= 3) return d;
    var r = Math.round(parseInt(d.digits.slice(0, 4), 10) / 10);
    if (r === 1000) return { digits: '1', exponent: d.exponent + 1 };
    return { digits: String(r).replace(/0+$/, ''), exponent: d.exponent };
  }
  function decText(c, k) {   // c x 10^-k written out
    var str = String(c);
    if (k <= 0) return str + '0'.repeat(-k);
    while (str.length <= k) str = '0' + str;
    return (str.slice(0, str.length - k) + '.' + str.slice(str.length - k)).replace(/\.?0+$/, '');
  }
  function sameNum(a, b) { return a.digits === b.digits && a.exponent === b.exponent; }
  // a x b or a / b in scientific notation, one rule per line.
  // Returns { steps, result: { digits, exponent }, approx }.
  function calc(a, b, op) {
    var m1 = Sci.mantissa(a.digits), m2 = Sci.mantissa(b.digits), k1 = a.digits.length - 1, k2 = b.digits.length - 1;
    var c1 = parseInt(a.digits, 10), c2 = parseInt(b.digits, 10), mul = op === 'multiply';
    var Q, approx = false, approxQ = false;
    if (mul) Q = decText(c1 * c2, k1 + k2);
    else {
      for (var m = 0; m <= 4 && Q === undefined; m++) if ((c1 * Math.pow(10, m)) % c2 === 0) Q = decText(c1 * Math.pow(10, m) / c2, k1 - k2 + m);
      if (Q === undefined || sigOf(Q).digits.length > 4) { Q = String(Number((c1 / c2 * Math.pow(10, k2 - k1)).toPrecision(3))); approx = approxQ = true; }
    }
    var E = mul ? a.exponent + b.exponent : a.exponent - b.exponent, q = sigOf(Q);
    var res = { digits: q.digits, exponent: E + q.shift };
    var r3 = round3sig(res);
    if (!sameNum(r3, res)) approx = true;
    var eq = approxQ ? '\\approx ' : '= ';
    var p10 = function (e) { return '10^{' + e + '}'; };
    var steps = [
      mul ? '$= (' + m1 + '\\times' + m2 + ')\\times(' + p10(a.exponent) + '\\times' + p10(b.exponent) + ')$'
        : '$= \\dfrac{' + m1 + '}{' + m2 + '}\\times\\dfrac{' + p10(a.exponent) + '}{' + p10(b.exponent) + '}$',
      '$' + eq + Q + '\\times10^{' + root.Mathwise.math.opExp(a.exponent, mul ? '+' : '-', b.exponent) + '}$',
      '$' + eq + Q + '\\times' + p10(E) + '$'
    ];
    if (q.shift !== 0) {
      steps.push('$' + eq + Sci.mantissa(q.digits) + '\\times' + p10(q.shift) + '\\times' + p10(E) + '$');
      steps.push('$' + eq + Sci.mantissa(q.digits) + '\\times10^{' + root.Mathwise.math.opExp(q.shift, '+', E) + '}$');
    }
    if (!sameNum(r3, res)) steps.push('$\\approx ' + sci(r3) + '$');
    return { steps: steps, result: r3, approx: approx };
  }
  F.calc = calc;

  function registerFamily(story) {
    var Q = story.quantities, fam = story.family, qkeys = [fam.product].concat(fam.factors);
    var vkeys = Object.keys(story.values || {});
    var derived = qkeys.filter(function (k) { return !Q[k].value && !Q[k].vary; });
    if (derived.length !== 1) throw new Error(story.id + ': exactly one quantity must be worked out from the others');
    var variables = vkeys.map(function (k) {
      var s = story.values[k];
      if (s.name) return { key: k, label: s.label || 'Name', kind: 'choice', values: D.names.map(function (n) { return { value: n, label: n }; }) };
      return { key: k, label: (s.label || k) + ' (real data)', kind: 'choice', values: D[s.fact].items.map(function (r) { return { value: r.name, label: r.name }; }) };
    });
    qkeys.forEach(function (k) {
      if (!Q[k].vary) return;
      variables.push({ key: k + 'Digits', label: cap(Q[k].name) + ': significant digits', kind: 'digits' });
      variables.push({ key: k + 'Exponent', label: cap(Q[k].name) + ': power of ten', kind: 'int', min: -30, max: 30 });
    });
    var FIND = qkeys.map(function (k) { return { value: k, label: 'Find the ' + Q[k].name + (k === fam.product ? ' (multiply)' : ' (divide)') }; });
    variables.push({ key: 'find', label: 'What is asked', kind: 'choice', values: FIND });
    variables.push({ key: 'thinking', label: 'Include the thinking questions', kind: 'toggle' });

    // The three numbers: the two known ones, and the third worked out (rounded to 3 digits).
    function numbers(v) {
      var n = {};
      qkeys.forEach(function (k) {
        if (Q[k].value) n[k] = Q[k].value(v, D, F);
        else if (Q[k].vary) n[k] = { digits: v[k + 'Digits'], exponent: v[k + 'Exponent'] };
      });
      var d = derived[0];
      if (d === fam.product) n[d] = calc(n[fam.factors[0]], n[fam.factors[1]], 'multiply').result;
      else n[d] = calc(n[fam.product], n[fam.factors[d === fam.factors[0] ? 1 : 0]], 'divide').result;
      return n;
    }

    G.register({
      name: story.topic + '.' + story.id,
      topic: TOPICS[story.topic] || story.topic,
      title: story.label,
      prompt: 'Answer each part',
      whole: true,
      workSpace: 2.5,
      params: [
        { key: 'find', label: 'What is asked', type: 'set', default: qkeys.slice(), values: FIND },
        { key: 'thinking', label: 'Thinking questions (no single right answer)', type: 'toggle', default: true }
      ],
      variables: variables,
      checkVars: function (v) { return story.ok && !story.ok(v) ? [story.okMessage || 'These values do not fit this story.'] : []; },
      pick: function (p, rng) {
        var v;
        for (var t = 0; t < 300; t++) {
          v = {};
          vkeys.forEach(function (k) {
            var s = story.values[k];
            v[k] = s.name ? rng.pick(D.names) : rng.pick(D[s.fact].items).name;
          });
          qkeys.forEach(function (k) {
            var y = Q[k].vary;
            if (!y) return;
            var n = rng.int(y.digits[0], y.digits[1]), s = String(rng.int(1, 9));
            for (var i = 1; i < n; i++) s += String(i === n - 1 ? rng.int(1, 9) : rng.int(0, 9));
            v[k + 'Digits'] = s;
            v[k + 'Exponent'] = rng.int(y.exponent[0], y.exponent[1]);
          });
          var nn = numbers(v);   // no 10^0 in a story
          if (qkeys.some(function (k) { return nn[k].exponent === 0; })) continue;
          if (!story.ok || story.ok(v)) break;
        }
        v.find = rng.pick(qkeys.filter(function (k) { return p.find.indexOf(k) >= 0; }));
        v.thinking = p.thinking;   // settings, not random: changing them never changes the numbers
        return v;
      },
      render: function (v) {
        var n = numbers(v), slots = {};
        vkeys.forEach(function (k) { slots[k] = v[k]; });
        qkeys.forEach(function (k) { slots[k] = '$' + sci(n[k]) + '$'; });
        // Givens in story order: the factors first (they set the scene), then the product.
        var given = fam.factors.concat([fam.product]).filter(function (k) { return k !== v.find; });
        var stem = (story.intro ? story.intro + ' ' : '') + given.map(function (k) { return Q[k].given; }).join(' ');
        // Worked steps: the relation in words, the numbers in, then scientific notation rules.
        var f1 = fam.factors[0], f2 = fam.factors[1], r, rule;
        if (v.find === fam.product) { r = calc(n[f1], n[f2], 'multiply'); rule = Q[fam.product].name + ' = ' + Q[f1].name + ' × ' + Q[f2].name; }
        else {
          var other = v.find === f1 ? f2 : f1;
          r = calc(n[fam.product], n[other], 'divide'); rule = Q[v.find].name + ' = ' + Q[fam.product].name + ' ÷ ' + Q[other].name;
        }
        var first = v.find === fam.product ? '$= (' + sci(n[f1]) + ')(' + sci(n[f2]) + ')$'
          : '$= \\dfrac{' + sci(n[fam.product]) + '}{' + sci(n[v.find === f1 ? f2 : f1]) + '}$';
        var parts = [{
          prompt: fill(Q[v.find].ask, slots) + ' Write your answer in scientific notation.',
          answer: (r.approx ? 'About ' : '') + '$' + sci(r.result) + '$ ' + Q[v.find].unit,
          steps: [cap(rule), first].concat(r.steps)
        }];
        (story.then || []).forEach(function (p) {
          if (p.think) { if (v.thinking) parts.push({ prompt: fill(p.prompt, slots), answer: '*Possible answers:* ' + fill(p.think, slots), steps: [], thinking: true }); }
        });
        return { prompt: fill(stem, slots), answer: '', steps: [], parts: parts, slots: slots };
      }
    });
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  (D.stories || []).forEach(function (s) { if (s.family) registerFamily(s); else register(s); });
})(typeof window !== 'undefined' ? window : this);
