/*
 * Story questions from the library in generators/data/stories-*.js: one story,
 * then parts a), b), c) ... Each story becomes its own question template
 * "<topic>.<id>". The engine knows no story: add or edit stories in the data files
 * (the format is at the top of data/stories-rates.js and data/stories-families.js).
 *
 * Two kinds of story:
 *   calculation stories  a stem and calculation parts, each with worked steps;
 *   relation stories     product = factor × factor kept as pieces: two are given, one
 *                        is asked (so the same story multiplies or divides).
 * Either kind may list thinking questions (no single right answer): at most one is
 * added after the calculations, chosen by the `thinking` setting (docs/generator-api.md, 5b).
 *
 * Values come from shared tables (data/people.js, data/planets.js, ...) by name and
 * column, or vary. Real data never varies: only which row is used.
 *
 * Random choices, in this order, so settings never move the numbers: the values
 * (people, rows, varying numbers), what is asked, then one draw each that seeds the
 * wordings and the thinking question on their own streams. Adding a wording or a
 * thinking question changes neither the numbers nor the other choices.
 * Needs core.js, sci-notation.js and the data files first.
 */
(function (root) {
  'use strict';
  var MW = root.Mathwise, G = MW.generators, D = MW.data, Sci = MW.sci, M = MW.math, num = M.num;
  var TOPICS = { rates: 'Rates', sci: 'Scientific notation' };
  var REASONABLE = ' Any answer backed up by a reasonable argument is good enough.';

  // ---------- tables ----------
  function table(name) {
    var t = D.tables && D.tables[name];
    if (!t) throw new Error('No data table "' + name + '"');
    return t;
  }
  // The rows a value may use: those that have every column the story needs.
  function rowsFor(spec) {
    return table(spec.table).rows.filter(function (r) { return (spec.needs || []).every(function (c) { return r[c] != null; }); });
  }
  function cell(tableName, rowName, column) {
    var r = table(tableName).rows.filter(function (x) { return x.name === rowName; })[0];
    if (!r || r[column] == null) throw new Error('No ' + tableName + '.' + column + ' for ' + rowName);
    return r[column];
  }

  // ---------- numbers ----------
  // A number in scientific notation is { digits, exponent } (1.496 x 10^8 = '1496', 8).
  function value(d) { return Number(Sci.mantissa(d.digits)) * Math.pow(10, d.exponent); }
  function sci(d) { return Sci.mantissa(d.digits) + '\\times10^{' + d.exponent + '}'; }
  function standard(d) { return num(Number(Sci.standard(d.digits, d.exponent))); }
  // Written with exactly n significant digits (6 x 10^4 to 3 digits is 6.00 x 10^4).
  function sciPad(d, n) {
    var s = d.digits;
    while (s.length < n) s += '0';
    return Sci.mantissa(s) + '\\times10^{' + d.exponent + '}';
  }
  function sigOf(str) {   // "0.0499" or "66.12" -> { digits, shift } (str = digits x 10^shift as sci)
    var t = str.replace('-', ''), i = t.indexOf('.'), intPart = i < 0 ? t : t.slice(0, i);
    var all = t.replace('.', ''), lead = all.match(/^0*/)[0].length;
    var digits = all.slice(lead).replace(/0+$/, '') || '0';
    var shift = intPart !== '0' && intPart !== '' ? intPart.replace(/^0+/, '').length - 1 : -lead;
    return { digits: digits, shift: shift };
  }
  // Round to n significant digits, on the digit string (no floating point error).
  function roundSig(d, n) {
    n = Math.max(1, n);
    if (d.digits.length <= n) return d;
    var head = parseInt(d.digits.slice(0, n), 10) + (parseInt(d.digits.charAt(n), 10) >= 5 ? 1 : 0);
    var s = String(head), e = d.exponent;
    if (s.length > n) { s = s.slice(0, n); e++; }   // 9.995 -> 10.0 -> 1.00 x 10
    return { digits: s.replace(/0+$/, '') || '0', exponent: e };
  }
  function sameNum(a, b) { return a.digits === b.digits && a.exponent === b.exponent; }
  function decText(c, k) {   // c x 10^-k written out
    var str = String(c);
    if (k <= 0) return str + '0'.repeat(-k);
    while (str.length <= k) str = '0' + str;
    return (str.slice(0, str.length - k) + '.' + str.slice(str.length - k)).replace(/\.?0+$/, '');
  }
  // x rounded to n decimal places, as text (whole numbers get thin-space groups).
  function fixed(x, n) {
    var t = (Math.round(x * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n);
    return n === 0 ? num(Number(t)) : t;
  }
  // a x b or a / b in scientific notation, one rule per line, rounded to n significant
  // digits (default 3). Returns { steps, result: { digits, exponent }, approx }.
  function calc(a, b, op, n) {
    n = Math.max(1, n || 3);
    var m1 = Sci.mantissa(a.digits), m2 = Sci.mantissa(b.digits), k1 = a.digits.length - 1, k2 = b.digits.length - 1;
    var c1 = parseInt(a.digits, 10), c2 = parseInt(b.digits, 10), mul = op === 'multiply';
    var Q, approx = false, approxQ = false;
    if (mul) Q = decText(c1 * c2, k1 + k2);
    else {
      for (var m = 0; m <= 4 && Q === undefined; m++) if ((c1 * Math.pow(10, m)) % c2 === 0) Q = decText(c1 * Math.pow(10, m) / c2, k1 - k2 + m);
      if (Q === undefined || sigOf(Q).digits.length > Math.max(4, n + 1)) { Q = String(Number((c1 / c2 * Math.pow(10, k2 - k1)).toPrecision(n))); approx = approxQ = true; }
    }
    var E = mul ? a.exponent + b.exponent : a.exponent - b.exponent, q = sigOf(Q);
    var res = { digits: q.digits, exponent: E + q.shift };
    var rn = roundSig(res, n);
    if (!sameNum(rn, res)) approx = true;
    var eq = approxQ ? '\\approx ' : '= ';
    var p10 = function (e) { return '10^{' + e + '}'; };
    var steps = [
      mul ? '$= (' + m1 + '\\times' + m2 + ')\\times(' + p10(a.exponent) + '\\times' + p10(b.exponent) + ')$'
        : '$= \\dfrac{' + m1 + '}{' + m2 + '}\\times\\dfrac{' + p10(a.exponent) + '}{' + p10(b.exponent) + '}$',
      '$' + eq + Q + '\\times10^{' + M.opExp(a.exponent, mul ? '+' : '-', b.exponent) + '}$',
      '$' + eq + Q + '\\times' + p10(E) + '$'
    ];
    if (q.shift !== 0) {
      steps.push('$' + eq + Sci.mantissa(q.digits) + '\\times' + p10(q.shift) + '\\times' + p10(E) + '$');
      steps.push('$' + eq + Sci.mantissa(q.digits) + '\\times10^{' + M.opExp(q.shift, '+', E) + '}$');
      steps.push('$' + eq + Sci.mantissa(q.digits) + '\\times' + p10(E + q.shift) + '$');
    }
    if (!sameNum(rn, res)) steps.push('$\\approx ' + sciPad(rn, n) + '$');
    return { steps: steps, result: rn, approx: approx };
  }
  // The sentence that says how to round (shown unless showPrecision is off).
  function roundSentence(kind, n) {
    if (kind === 'sig') { n = Math.max(1, n); return 'Round to ' + n + ' significant digit' + (n === 1 ? '' : 's') + '.'; }
    return n === 0 ? 'Round to the nearest whole number.' : 'Round to ' + n + ' decimal place' + (n === 1 ? '' : 's') + '.';
  }

  // Helpers given to calculation stories (solve and given functions).
  var F = { num: num, sci: sci, sciPad: sciPad, standard: standard, value: value, cell: cell, calc: calc,
    roundSig: roundSig, fixed: fixed, mantissa: Sci.mantissa, constant: function (k) { return D.constants[k]; } };
  // Make the number in scientific notation for x (a JS number), to 6 digits.
  F.fromValue = function (x) { var e = Math.floor(Math.log10(Math.abs(x))); return roundSig({ digits: String(Math.round(x / Math.pow(10, e - 5))).replace(/0+$/, ''), exponent: e }, 6); };

  function fill(text, slots) {
    return String(text).replace(/%([A-Za-z]+)%/g, function (m, k) { return slots[k] != null ? String(slots[k]) : m; });
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function list(x) { return x == null ? [] : Array.isArray(x) ? x : [x]; }
  function short(t) { t = String(t).replace(/\$/g, ''); return t.length > 48 ? t.slice(0, 46) + '…' : t; }

  // ---------- parts shared by both kinds ----------

  // Values: { table: 'people' } | { table: 'planets', needs: [columns] } | { vary: [lo, hi], step } | { choose: [..] }
  function valueVariables(story) {
    return Object.keys(story.values || {}).map(function (k) {
      var s = story.values[k];
      if (s.table) {
        return { key: k, label: (s.label || cap(k)) + (s.table === 'people' ? '' : ' (real data)'), kind: 'choice',
          values: rowsFor(s).map(function (r) { return { value: r.name, label: r.name }; }) };
      }
      return { key: k, label: s.label || k, kind: 'int', min: 1, max: 100000 };
    });
  }
  function pickValues(story, rng, v) {
    Object.keys(story.values || {}).forEach(function (k) {
      var s = story.values[k];
      if (s.table) v[k] = rng.pick(rowsFor(s)).name;
      else if (s.choose) v[k] = rng.pick(s.choose);
      else {
        var step = s.step || 1;
        v[k] = step * rng.int(Math.ceil(s.vary[0] / step), Math.floor(s.vary[1] / step));
      }
    });
  }

  // Thinking questions: story.thinking = { id: { prompt, answers } }, ids stable.
  function thinkingIds(story) { return Object.keys(story.thinking || {}); }
  function thinkingParam(story) {
    var ids = thinkingIds(story);
    if (!ids.length) return null;
    return { key: 'thinking', label: 'Thinking question (no single right answer)', type: 'choice', default: 'auto',
      values: [{ value: 'auto', label: 'Follow the booklet' }, { value: 'none', label: 'None' }, { value: 'random', label: 'Random' }]
        .concat(ids.map(function (id) { return { value: id, label: short(story.thinking[id].prompt) }; })) };
  }
  function thinkingVariable(story) {
    var ids = thinkingIds(story);
    if (!ids.length) return null;
    return { key: 'thinking', label: 'Thinking question', kind: 'choice',
      values: [{ value: 'none', label: 'None' }].concat(ids.map(function (id) { return { value: id, label: short(story.thinking[id].prompt) }; })) };
  }
  // From the thinking stream: auto asks the booklet frequency (the same draw for every
  // frequency, so 1 in 2 keeps every question 1 in 4 had); random always adds one.
  // A thinking question already asked above (same text) is skipped for the next one in
  // the list; when every one was asked, none is added.
  function pickThinking(story, setting, trng, ctx, v) {
    var ids = thinkingIds(story);
    if (!ids.length) return undefined;
    var freq = ctx && ctx.thinking ? ctx.thinking.frequency || 0 : 0;
    var on = trng.chance(setting === 'random' ? 1 : setting === 'auto' ? freq : 0);
    var at = ids.indexOf(trng.pick(ids));
    if (setting !== 'auto' && setting !== 'random') return ids.indexOf(setting) >= 0 ? setting : 'none';
    if (!on) return 'none';
    var asked = (ctx && ctx.earlierPrompts) || {}, slots = valueSlots(story, v);
    for (var k = 0; k < ids.length; k++) {
      var id = ids[(at + k) % ids.length];
      if (!asked[fill(story.thinking[id].prompt, slots)]) return id;
    }
    return 'none';
  }
  // Slots made from the values only (names, rows, numbers as math): what thinking prompts use.
  function valueSlots(story, v) {
    var slots = {};
    Object.keys(story.values || {}).forEach(function (k) { slots[k] = typeof v[k] === 'number' ? '$' + num(v[k]) + '$' : v[k]; });
    return slots;
  }
  function thinkingPart(story, v, slots) {
    var t = v.thinking && story.thinking && story.thinking[v.thinking];
    if (!t) return null;
    return { prompt: fill(t.prompt, slots), answer: '*Possible answers:* ' + fill(t.answers, slots) + REASONABLE, steps: [], thinking: true };
  }

  // Wordings: a piece (or stem) with several sentences gets a choice var "<key>Given" /
  // "<key>Question"; one sentence needs no var.
  function wordingVariables(slotsList) {
    return slotsList.filter(function (w) { return w.texts.length > 1; }).map(function (w) {
      return { key: w.key, label: w.label, kind: 'choice', values: w.texts.map(function (t, i) { return { value: i, label: (i + 1) + ': ' + short(t) }; }) };
    });
  }
  function pickWordings(slotsList, wrng, v) {
    slotsList.forEach(function (w) { var i = wrng.int(0, w.texts.length - 1); if (w.texts.length > 1) v[w.key] = i; });
  }
  function wording(texts, i) { texts = list(texts); return texts[i != null && texts[i] != null ? i : 0]; }

  // Precision: a story that rounds has precision (0 to 6) and showPrecision settings.
  function precisionParams(story) {
    if (story.precision == null) return [];
    return [
      { key: 'precision', label: story.precisionLabel || 'Round to (significant digits)', type: 'number', min: 0, max: 6, default: story.precision },
      { key: 'showPrecision', label: 'Say how to round in the question', type: 'toggle', default: true }
    ];
  }
  function precisionVariables(story) {
    if (story.precision == null) return [];
    return [
      { key: 'precision', label: 'Round to', kind: 'int', min: 0, max: 6 },
      { key: 'showPrecision', label: 'Say how to round', kind: 'toggle' }
    ];
  }

  // Old vars (before the thinking list, wordings and precision): brought up to date.
  function upgradeCommon(story, v, wslots) {
    var ids = thinkingIds(story);
    if (ids.length) {
      if (v.thinking === true) v.thinking = ids[0];
      else if (v.thinking === false || v.thinking == null) v.thinking = 'none';
    }
    if (story.precision != null) {
      if (v.precision == null) v.precision = story.precision;
      if (v.showPrecision == null) v.showPrecision = true;
    }
    wslots.forEach(function (w) { if (w.texts.length > 1 && v[w.key] == null) v[w.key] = 0; });
    return v;
  }
  function checkOk(story) {
    return function (v) { return story.ok && !story.ok(v) ? [story.okMessage || 'These values do not fit this story.'] : []; };
  }

  // ---------- calculation stories ----------
  function registerCalc(story) {
    var wslots = [{ key: 'stemWording', label: 'Wording', texts: list(story.stem) }];
    var params = precisionParams(story), tp = thinkingParam(story);
    if (tp) params.push(tp);
    var variables = valueVariables(story).concat(wordingVariables(wslots), precisionVariables(story));
    if (thinkingVariable(story)) variables.push(thinkingVariable(story));

    G.register({
      name: story.topic + '.' + story.id,
      topic: TOPICS[story.topic] || story.topic,
      title: story.label,
      prompt: 'Answer each part',
      whole: true,
      workSpace: 2,
      params: params,
      variables: variables,
      checkVars: checkOk(story),
      upgradeVars: function (v) { return upgradeCommon(story, v, wslots); },
      pick: function (p, rng, ctx) {
        var v;
        for (var t = 0; t < 300; t++) {
          v = {};
          pickValues(story, rng, v);
          if (!story.ok || story.ok(v)) break;
        }
        var wseed = rng.int(0, 1e9), tseed = rng.int(0, 1e9);
        pickWordings(wslots, G.makeRng('w' + wseed), v);
        if (story.precision != null) { v.precision = p.precision; v.showPrecision = p.showPrecision; }
        var th = pickThinking(story, p.thinking, G.makeRng('t' + tseed), ctx, v);
        if (th !== undefined) v.thinking = th;
        return v;
      },
      render: function (v) {
        // Numbers and givens are math: written as $…$ in the text.
        var slots = valueSlots(story, v);
        if (story.given) { var g = story.given(v, D, F); Object.keys(g).forEach(function (k) { slots[k] = '$' + g[k] + '$'; }); }
        var parts = story.parts.map(function (p) {
          var r = p.solve(v, F, D), prompt = fill(p.prompt, slots);
          if (p.round && v.showPrecision !== false) {
            var kind = p.round.dp != null ? 'dp' : p.round, n = p.round.dp != null ? p.round.dp : v.precision;
            prompt += ' ' + roundSentence(kind, n);
          }
          return { prompt: prompt, answer: r.answer, steps: r.steps || [] };
        });
        var tp = thinkingPart(story, v, slots);
        if (tp) parts.push(tp);
        return { prompt: fill(wording(story.stem, v.stemWording), slots), answer: '', steps: [], parts: parts, slots: slots };
      }
    });
  }

  // ---------- relation stories: product = factor × factor ----------
  // A piece's number: from: 'planet.meanSunDistance' (the row of value "planet", that
  // column) or 'constants.lightSpeed'; vary: { digits: [1, 2], exponent: [lo, hi] }; or
  // neither (worked out from the other two, to 3 significant digits).
  function registerRelation(story) {
    var R = story.relation, P = story.pieces, keys = [R.product].concat(R.factors);
    if (story.precision == null) story.precision = 3;
    var derived = keys.filter(function (k) { return !P[k].from && !P[k].vary; });
    if (derived.length !== 1) throw new Error(story.id + ': exactly one piece must be worked out from the others');
    var askable = keys.filter(function (k) { return P[k].question; });
    var wslots = [];
    keys.forEach(function (k) {
      wslots.push({ key: k + 'Given', label: cap(P[k].name) + ': sentence that gives it', texts: list(P[k].given) });
      if (P[k].question) wslots.push({ key: k + 'Question', label: cap(P[k].name) + ': question that asks it', texts: list(P[k].question) });
    });
    var variables = valueVariables(story);
    keys.forEach(function (k) {
      if (!P[k].vary) return;
      variables.push({ key: k + 'Digits', label: cap(P[k].name) + ': significant digits', kind: 'digits' });
      variables.push({ key: k + 'Exponent', label: cap(P[k].name) + ': power of ten', kind: 'int', min: -30, max: 30 });
    });
    var FIND = askable.map(function (k) { return { value: k, label: 'Find the ' + P[k].name + (k === R.product ? ' (multiply)' : ' (divide)') }; });
    variables.push({ key: 'find', label: 'What is asked', kind: 'choice', values: FIND });
    variables = variables.concat(wordingVariables(wslots), precisionVariables(story));
    if (thinkingVariable(story)) variables.push(thinkingVariable(story));
    var params = [{ key: 'find', label: 'What is asked', type: 'set', default: askable.slice(), values: FIND }].concat(precisionParams(story));
    if (thinkingParam(story)) params.push(thinkingParam(story));

    function from(path, v) {
      var a = path.split('.');
      if (a[0] === 'constants') return D.constants[a[1]];
      return cell(story.values[a[0]].table, v[a[0]], a[1]);
    }
    // The three numbers: the two known ones, and the third worked out (3 significant digits).
    function numbers(v) {
      var n = {};
      keys.forEach(function (k) {
        if (P[k].from) n[k] = from(P[k].from, v);
        else if (P[k].vary) n[k] = { digits: v[k + 'Digits'], exponent: v[k + 'Exponent'] };
      });
      var d = derived[0];
      if (d === R.product) n[d] = calc(n[R.factors[0]], n[R.factors[1]], 'multiply').result;
      else n[d] = calc(n[R.product], n[R.factors[d === R.factors[0] ? 1 : 0]], 'divide').result;
      return n;
    }
    function askableOnly(x) { var a = list(x).filter(function (k) { return askable.indexOf(k) >= 0; }); return a.length ? a : askable.slice(); }

    G.register({
      name: story.topic + '.' + story.id,
      topic: TOPICS[story.topic] || story.topic,
      title: story.label,
      prompt: 'Answer each part',
      whole: true,
      workSpace: 2.5,
      params: params,
      variables: variables,
      checkVars: checkOk(story),
      // Old files may ask for a piece that is no longer asked (a constant).
      upgradeParams: function (v) { v.find = askableOnly(v.find); return v; },
      upgradeVars: function (v) {
        if (askable.indexOf(v.find) < 0) v.find = askable[0];
        return upgradeCommon(story, v, wslots);
      },
      pick: function (p, rng, ctx) {
        var v;
        for (var t = 0; t < 300; t++) {
          v = {};
          pickValues(story, rng, v);
          keys.forEach(function (k) {
            var y = P[k].vary;
            if (!y) return;
            var n = rng.int(y.digits[0], y.digits[1]), s = String(rng.int(1, 9));
            for (var i = 1; i < n; i++) s += String(i === n - 1 ? rng.int(1, 9) : rng.int(0, 9));
            v[k + 'Digits'] = s;
            v[k + 'Exponent'] = rng.int(y.exponent[0], y.exponent[1]);
          });
          var nn = numbers(v);   // no 10^0 in a story
          if (keys.some(function (k) { return nn[k].exponent === 0; })) continue;
          if (!story.ok || story.ok(v)) break;
        }
        v.find = rng.pick(askable.filter(function (k) { return p.find.indexOf(k) >= 0; }));
        var wseed = rng.int(0, 1e9), tseed = rng.int(0, 1e9);
        pickWordings(wslots, G.makeRng('w' + wseed), v);
        v.precision = p.precision;
        v.showPrecision = p.showPrecision;
        var th = pickThinking(story, p.thinking, G.makeRng('t' + tseed), ctx, v);
        if (th !== undefined) v.thinking = th;
        return v;
      },
      render: function (v) {
        var n = numbers(v), slots = {}, prec = Math.max(1, v.precision);
        Object.keys(story.values || {}).forEach(function (k) { slots[k] = v[k]; });
        keys.forEach(function (k) { slots[k] = '$' + sci(n[k]) + '$'; });
        // Givens in story order: the factors first (they set the scene), then the product.
        var given = R.factors.concat([R.product]).filter(function (k) { return k !== v.find; });
        var stem = (story.intro ? story.intro + ' ' : '') + given.map(function (k) { return wording(P[k].given, v[k + 'Given']); }).join(' ');
        // Worked steps: the relation in words, the numbers in, then scientific notation rules.
        var f1 = R.factors[0], f2 = R.factors[1], r, rule;
        if (v.find === R.product) { r = calc(n[f1], n[f2], 'multiply', prec); rule = P[R.product].name + ' = ' + P[f1].name + ' × ' + P[f2].name; }
        else {
          var other = v.find === f1 ? f2 : f1;
          r = calc(n[R.product], n[other], 'divide', prec); rule = P[v.find].name + ' = ' + P[R.product].name + ' ÷ ' + P[other].name;
        }
        var first = v.find === R.product ? '$= (' + sci(n[f1]) + ')(' + sci(n[f2]) + ')$'
          : '$= \\dfrac{' + sci(n[R.product]) + '}{' + sci(n[v.find === f1 ? f2 : f1]) + '}$';
        var parts = [{
          prompt: fill(wording(P[v.find].question, v[v.find + 'Question']), slots) + ' Write your answer in scientific notation.' +
            (v.showPrecision !== false ? ' ' + roundSentence('sig', prec) : ''),
          answer: (r.approx ? 'About ' : '') + '$' + sciPad(r.result, prec) + '$ ' + P[v.find].unit,
          steps: [cap(rule), first].concat(r.steps)
        }];
        var tp = thinkingPart(story, v, slots);
        if (tp) parts.push(tp);
        return { prompt: fill(stem, slots), answer: '', steps: [], parts: parts, slots: slots };
      }
    });
  }

  MW.stories = { calc: calc, roundSig: roundSig, sciPad: sciPad, roundSentence: roundSentence, cell: cell };
  (D.stories || []).forEach(function (s) { if (s.relation) registerRelation(s); else registerCalc(s); });
})(typeof window !== 'undefined' ? window : this);
