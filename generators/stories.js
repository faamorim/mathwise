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
      if (s.name) return { key: k, label: 'Name (' + k + ')', kind: 'choice', values: D.names.map(function (n) { return { value: n, label: n }; }) };
      if (s.fact) return { key: k, label: 'Which ' + k + ' (real data)', kind: 'choice', values: D[s.fact].items.map(function (r) { return { value: r.name, label: r.name }; }) };
      return { key: k, label: k, kind: 'int', min: 1, max: 100000 };
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

  (D.stories || []).forEach(register);
})(typeof window !== 'undefined' ? window : this);
