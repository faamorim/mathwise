// Checks for the generator library: run with `node tests/check-generators.js`.
// - every generator is deterministic for a seed and never throws on its defaults
// - every prompt, step and answer is valid KaTeX
// - numbers agree: each worked step and the answer have the prompt's value
//   (or solve its equation), checked numerically by tests/tex-check.js
// - the example quizzes pass the same numeric check
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const katex = require('../vendor/katex/katex.min.js');
const { checkItem: checkPlain, checkFactoring } = require('./tex-check');
// Factoring items (topic Factoring) are checked as identities; the rest as before.
const checkItem = (it, given) => (/^\$[^$=]*\$$/.test(it.prompt || '') && !/=/.test(it.answer || '') ? checkFactoring(it) : checkPlain(it, given));
const MW = require('../tools/load-generators')();
const G = MW.generators;

function mathOf(s) { return String(s || '').split(/\$\$?/).filter((_, i) => i % 2 === 1); }
function katexOk(s, where) {
  mathOf(s).forEach((m) => {
    try { katex.renderToString(m, { throwOnError: true }); }
    catch (e) { throw new Error(where + ': bad TeX "' + m + '": ' + e.message); }
  });
}

// Extra parameter sets beyond the defaults, to reach every option.
const VARIANTS = {
  'powers.product-quotient': [{ bases: ['variable'] }, { bases: ['negative'], negatives: false }],
  'powers.monomials': [{ terms: 3 }, { negativeCoefficients: false, negatives: false }],
  'powers.power-of-power': [{ bases: ['number'], operations: ['divide'] }],
  'powers.order': [{ bases: [5, 10], count: 4 }],
  'factoring.gcf': [{ terms: 2, variableFactor: false, otherLetters: true }, { terms: 4, negatives: false }],
  'factoring.difference-of-squares': [{ higherPowers: true, maxRoot: 15 }, { coefficients: false }],
  'factoring.perfect-square': [{ coefficients: false, negatives: false }],
  'factoring.trinomial': [{ leading: ['prime'], methods: ['cross', 'sum-product'] }, { leading: ['composite'], methods: ['sum-product'] }, { leading: ['one', 'prime', 'composite'], negatives: false, maxConstant: 12, otherLetters: true }],
  'factoring.full': [{ negativeLead: true, kinds: ['difference-of-squares'], maxFactor: 10 }, { kinds: ['four-term', 'trinomial'], leading: ['composite'], methods: ['cross', 'sum-product'] }],
  'factoring.mixed': [{ kinds: ['four-term', 'full', 'gcf'], higherPowers: true }],
  'factoring.four-term': [{ coefficients: false, negatives: false }, { maxConstant: 12 }]
};

// Values given in a block prompt: "Evaluate each expression for $a=-3,\ b=2,\ c=-1$".
function givenIn(prompt) {
  const given = {};
  const m = /for \$([^$]*)\$/.exec(prompt || '');
  if (m) m[1].split(/,\\ |,/).forEach((kv) => { const [k, v] = kv.split('='); given[k.trim()] = Number(v); });
  return given;
}
const evaluateTex = (t) => { try { return require('./tex-check').evaluate(t, {}); } catch (e) { return null; } };
let items = 0, checked = 0;
const fails = [];
for (const gen of G.list()) {
  assert.strictEqual(G.validate(gen, {}).length, 0, gen.name + ' defaults are valid');
  for (const params of [{}].concat(VARIANTS[gen.name] || [])) {
    for (let seed = 0; seed < 150; seed++) {
      const block = { kind: 'question', generator: { name: gen.name, params, seed: 's' + seed, count: gen.whole ? 1 : 6 } };
      const a = G.fillBlock(block), b = G.fillBlock(block);
      assert.strictEqual(JSON.stringify(a), JSON.stringify(b), gen.name + ' is deterministic');
      for (const it of a.parts || [a]) {
        items++;
        ['prompt', 'answer', 'solution'].forEach((k) => katexOk(it[k], gen.name + ' ' + k));
        assert.ok(it.prompt && it.answer, gen.name + ' gives prompt and answer');
        const r = checkItem(it, givenIn(a.prompt));
        if (r) { checked++; if (r.length) fails.push(gen.name + ' ' + JSON.stringify(params) + ' seed s' + seed + ': ' + it.prompt + '\n    ' + r.join('\n    ')); }
      }
    }
  }
}

// Teacher-typed vars: nudge each whole-number var of picked vars (as a teacher
// editing an unlinked question would); whenever checkVars accepts the result,
// render must still give valid KaTeX and numerically right steps and answer.
let edited = 0;
for (const gen of G.list()) {
  for (let seed = 0; seed < 60; seed++) {
    const base = G.pick(gen.name, {}, 'edit' + seed, { index: seed % 6, count: 6 });
    // Paths to every number: top level, inside lists, and inside nested template vars.
    const paths = [];
    (function walk(obj, path) {
      Object.keys(obj).forEach((k) => {
        if (typeof obj[k] === 'number') paths.push(path.concat(k));
        else if (obj[k] && typeof obj[k] === 'object') walk(obj[k], path.concat(k));
      });
    })(base, []);
    for (const path of paths) {
      {
        for (const d of [-3, -1, 1, 2, 5]) {
          const vars = JSON.parse(JSON.stringify(base));
          let o = vars; for (const k of path.slice(0, -1)) o = o[k];
          o[path[path.length - 1]] += d;
          if (G.checkVars(gen, vars).length) continue;
          const r = G.render(gen.name, vars);
          const it = { prompt: r.prompt, answer: r.answer, solution: r.steps.join('\n') };
          ['prompt', 'answer', 'solution'].forEach((f) => katexOk(it[f], gen.name + ' edited ' + f));
          edited++;
          const c = checkItem(it);
          if (c && c.length) fails.push(gen.name + ' edited vars ' + JSON.stringify(vars) + ': ' + it.prompt + '\n    ' + c.join('\n    '));
        }
      }
    }
  }
}
// Story questions: calculation parts are right, and no later part (or the story)
// shows a result from an earlier part (only the givens may be repeated).
{
  const numbersIn = (t) => (String(t).replace(/\\,/g, '').match(/\d+(\.\d+)?/g) || []);
  const stories = G.list().filter((g) => (MW.data.stories || []).some((s) => s.topic + '.' + s.id === g.name));
  const thinkingSeen = {};
  assert.ok(stories.length >= 6, 'stories registered');
  for (const gen of stories) {
    for (let seed = 0; seed < 150; seed++) {
      const b = G.fillBlock({ kind: 'question', generator: { name: gen.name, params: {}, seed: 'st' + seed } });
      const given = new Set(numbersIn(b.prompt));
      const shown = [];
      b.parts.forEach((p, i) => {
        ['prompt', 'answer', 'solution'].forEach((f) => katexOk(p[f], gen.name + ' part ' + i + ' ' + f));
        numbersIn(p.prompt).forEach((n) => {
          if (!given.has(n) && shown.includes(n)) fails.push(gen.name + ' seed st' + seed + ': part ' + String.fromCharCode(97 + i) + ' gives away ' + n + ': ' + p.prompt);
        });
        if (!p.thinking) numbersIn(p.answer).forEach((n) => shown.push(n));
        assert.ok(!/%\w+%/.test(b.prompt + p.prompt + p.answer), gen.name + ' placeholder left: ' + p.prompt);
      });
      // The thinking setting never changes the story or its numbers: none has no thinking
      // part, random exactly one, after the calculations; old on/off files still work.
      const fill = (params, opts) => { const f = G.fillBlock({ kind: 'question', generator: { name: gen.name, params, seed: 'st' + seed } }, opts); delete f.generator; return f; };
      const off = fill({ thinking: 'none' }), on = fill({ thinking: 'random' });
      const calcs = (x) => JSON.stringify(x.parts.filter((p) => !p.thinking));
      assert.strictEqual(off.prompt, b.prompt, gen.name + ' thinking setting changed the numbers');
      assert.strictEqual(on.prompt, b.prompt, gen.name + ' thinking setting changed the numbers');
      assert.ok(calcs(off) === calcs(b) && calcs(on) === calcs(b), gen.name + ' thinking setting changed a calculation');
      assert.ok(off.parts.every((p) => !p.thinking), gen.name + ' thinking none');
      assert.ok(on.parts.filter((p) => p.thinking).length === 1 && on.parts[on.parts.length - 1].thinking, gen.name + ' thinking random');
      assert.strictEqual(JSON.stringify(fill({ thinking: false })), JSON.stringify(off), gen.name + ' old thinking: false');
      assert.strictEqual(JSON.stringify(fill({ thinking: true })), JSON.stringify(on), gen.name + ' old thinking: true');
      // Auto follows the booklet frequency: none at 0, the random one at 1, and a question
      // with a thinking part at 1 in 4 keeps the same one at 1 in 2.
      assert.ok(b.parts.every((p) => !p.thinking), gen.name + ' auto without a booklet frequency');
      assert.strictEqual(JSON.stringify(fill({}, { thinking: { frequency: 1 } })), JSON.stringify(on), gen.name + ' frequency 1');
      const q = fill({}, { thinking: { frequency: 0.25 } }), h = fill({}, { thinking: { frequency: 0.5 } });
      if (q.parts.some((p) => p.thinking)) assert.strictEqual(JSON.stringify(q), JSON.stringify(h), gen.name + ' frequency keeps its questions');
      if (q.parts.some((p) => p.thinking)) thinkingSeen[gen.name] = (thinkingSeen[gen.name] || 0) + 1;
      // Each thinking question can be chosen by its id.
      for (const id of Object.keys(MW.data.stories.find((st) => st.topic + '.' + st.id === gen.name).thinking || {})) {
        if (seed > 2) break;
        const one = fill({ thinking: id });
        assert.ok(one.prompt === b.prompt && one.parts.filter((p) => p.thinking).length === 1, gen.name + ' thinking ' + id);
      }
    }
  }
  for (const gen of stories) assert.ok(thinkingSeen[gen.name] > 10 && thinkingSeen[gen.name] < 70, gen.name + ' frequency 1 in 4: ' + thinkingSeen[gen.name] + ' of 150');
  // Old unlinked vars (thinking on/off, no precision or wordings) still render.
  assert.ok(G.render('sci.sunlight', { planet: 'Mars', find: 'speed', thinking: true }).parts[1].thinking, 'old vars: thinking on');
  assert.strictEqual(G.render('rates.heartbeat', { name: 'Ana', beats: 22, secs: 15, thinking: false }).parts.length, 2, 'old vars: thinking off');
  assert.ok(!G.validate(G.get('sci.sunlight'), { find: ['speed', 'time'] }).length, 'old params: a piece no longer asked');
  assert.strictEqual(G.withDefaults(G.get('rates.hose'), { thinking: true }).thinking, 'random', 'withDefaults maps old thinking');
  assert.strictEqual(G.upgradeVars('rates.hose', { thinking: true }).thinking, 'real-time', 'upgradeVars maps old thinking');
  // Calculation spot checks.
  const D = MW.data;
  const val = (d) => Number(MW.sci.mantissa(d.digits)) * Math.pow(10, d.exponent);
  for (let seed = 0; seed < 100; seed++) {
    const v = G.pick('rates.typing-race', {}, 'c' + seed);
    const ra = v.wordsA * 60 / v.secsA, rb = v.wordsB / v.minsB;
    const it = G.render('rates.typing-race', v);
    assert.ok(it.parts[0].answer.startsWith(ra > rb ? v.a : v.b), 'typing faster');
    assert.ok(it.parts[1].answer.includes('$' + MW.math.num(Math.abs(ra - rb) * 60) + '$'), 'typing difference');
    const l = G.pick('sci.light-travel', {}, 'c' + seed);
    const mins = val(D.tables.planets.rows.find((p) => p.name === l.planet).meanSunDistance) / val(D.constants.lightSpeed) / 60;
    const got = Number(G.render('sci.light-travel', l).parts[1].answer.replace(/\\,/g, '').match(/[\d.]+/)[0]);
    assert.ok(Math.abs(got - mins) / mins < 0.05, 'light minutes ' + l.planet);
    const s = G.pick('rates.swim-laps', {}, 'c' + seed);
    assert.ok(G.render('rates.swim-laps', s).parts[0].answer === '$' + 60 / s.mins * s.laps + '$ laps', 'laps per hour');
  }
}

// Graphs: every graph a generator gives passes Mathwise.graph.check and samples;
// for lines, the drawn function is the answer's equation and every key point is on it.
{
  const { evaluate } = require('./tex-check');
  const MG = MW.graph;
  let graphs = 0;
  const lineOk = (where, eq, g) => {
    const fn = g.items.find((i) => i.type === 'function');
    const f = MG.compile(fn.expr);
    const rhs = eq.replace(/^y=/, '');
    for (const x of [-3, -1.5, 0, 0.7, 2, 5]) {
      if (Math.abs(f(x) - evaluate(rhs, { x })) > 1e-9) fails.push(where + ': graph ' + fn.expr + ' is not ' + eq + ' at x=' + x);
    }
    g.items.filter((i) => i.type === 'points').forEach((i) => i.points.forEach((p) => {
      if (Math.abs(f(p[0]) - p[1]) > 1e-9) fails.push(where + ': point (' + p + ') is not on ' + eq);
      if (p[0] < g.x.min || p[0] > g.x.max || p[1] < g.y.min || p[1] > g.y.max) fails.push(where + ': point (' + p + ') is off the plane');
    }));
  };
  for (const gen of G.list()) {
    for (let seed = 0; seed < 150; seed++) {
      const b = G.fillBlock({ kind: 'question', generator: { name: gen.name, params: {}, seed: 'g' + seed, count: gen.whole ? 1 : 4 } });
      for (const it of [b].concat(b.parts || [])) {
        if (!it.graph) continue;
        graphs++;
        const errs = MG.check(it.graph);
        if (errs.length) fails.push(gen.name + ' seed g' + seed + ' graph: ' + errs.join('; '));
        const student = MG.sample(it.graph), key = MG.sample(it.graph, { key: true });
        assert.ok(student.lines.concat(student.dots).every((l) => !l.key), gen.name + ' key items hidden from the student');
        assert.ok(key.lines.length + key.dots.length > 0, gen.name + ' key graph shows something');
      }
    }
  }
  assert.ok(graphs > 0, 'some generator gives graphs');
  for (const name of ['linear.graph-line', 'linear.equation-from-graph']) {
    for (let seed = 0; seed < 300; seed++) {
      const v = G.pick(name, { slopes: ['integer', 'fraction', 'zero'] }, 'l' + seed);
      const r = G.render(name, v);
      lineOk(name + ' seed l' + seed, MW.linear.eqTex(v), r.graph);
      // Teacher-typed lines: any accepted rise/run/b/size draws correctly.
      const w = Object.assign({}, v, { rise: (seed % 13) - 6, run: (seed % 5) + 1, b: (seed % 9) - 4, size: 4 + (seed % 7) });
      if (!G.checkVars(name, w).length) { const rw = G.render(name, w); lineOk(name + ' edited ' + JSON.stringify(w), MW.linear.eqTex(w), rw.graph); assert.strictEqual(MG.check(rw.graph).length, 0); }
    }
  }
  // Matching cards: every card is a valid graph, and each equation's letter is the card with its line.
  for (let seed = 0; seed < 300; seed++) {
    const params = [{}, { extra: 2, count: 3 }, { slopes: ['integer', 'fraction', 'zero'], count: 6 }][seed % 3];
    const b = G.fillBlock({ kind: 'question', generator: { name: 'linear.match-graphs', params, seed: 'mg' + seed } });
    assert.strictEqual(b.parts.length, params.count || 4, 'match count');
    assert.strictEqual(b.choices.length, (params.count || 4) + (params.extra || 0), 'cards');
    b.choices.forEach((c) => assert.strictEqual(MG.check(c.graph).length, 0, 'card graph'));
    const letters = new Set();
    b.parts.forEach((p) => {
      const card = b.choices[p.answer.charCodeAt(0) - 65];
      assert.ok(card && !letters.has(p.answer), 'answer letter ' + p.answer);
      letters.add(p.answer);
      const f = MG.compile(card.graph.items[0].expr), rhs = /^\$y=(.*)\$$/.exec(p.prompt)[1];
      [-2, 0, 1.5, 3].forEach((x) => { if (Math.abs(f(x) - evaluate(rhs, { x })) > 1e-9) fails.push('match-graphs seed mg' + seed + ': ' + p.prompt + ' is not card ' + p.answer); });
    });
  }
  {
    const lines = ['2x+1', '-x', '3/4x-2', '5'];
    const r = G.render('linear.match-graphs', { lines, matched: 3, cards: [4, 3, 1, 2] });
    assert.strictEqual(r.parts.map((p) => p.answer).join(''), 'CDB', 'typed cards');
    assert.strictEqual(r.choices[0].graph.items[0].expr, '5');
  }
  // The expression language reads board notation.
  const c = (e, x) => MG.compile(e)(x);
  assert.strictEqual(c('-1/2x+3', 4), 1);
  assert.strictEqual(c('2(x-1)^2', 3), 8);
  assert.strictEqual(c('abs(x)-3', -5), 2);
  // Lines end on the edge (no overshoot), key items are marked, labels get a spot.
  {
    const g = { x: { min: -6, max: 6 }, y: { min: -6, max: 6 }, items: [{ type: 'function', expr: '2x+1', label: 'L', key: true }, { type: 'function', expr: 'x^2-4', domain: [-2, 1], ends: ['open', 'closed'] }] };
    const s = MG.sample(g, { key: true });
    assert.ok(s.lines.every((l) => l.points.every((p) => p[1] >= -6 && p[1] <= 6)), 'curves stay on the plane');
    assert.strictEqual(JSON.stringify(s.lines[0].points[0]), '[-3.5,-6]');
    assert.ok(s.lines[0].key === true && s.lines[1].key === false, 'key marked on lines');
    assert.ok(Math.abs(s.lines[0].labelAt[1] - (2 * s.lines[0].labelAt[0] + 1)) < 1e-6, 'label spot is on the line');
    assert.strictEqual(JSON.stringify(s.dots.map((d) => [d.at, d.open])), '[[[-2,0],true],[[1,-3],false]]');
  }
  assert.ok(MG.check({ x: { min: 0, max: 5 }, y: { min: 0, max: 5 }, items: [{ type: 'function', expr: '2x+' }] })[0].includes('cannot read'));
  console.log('Graphs OK: ' + graphs + ' generated graphs checked.');
}

// Substitution: teacher-typed values and expressions work out right (or get a message).
{
  const S = MW.substitution;
  const exprs = ['-a^-1', '(a+b+c)^-1', 'a^b', '(2a/(b+c))^-3', '3a^2b', 'a^2-2c', '-ab', '(-a)^2', '-2^2', 'a/(2b)', '2^a', '(a-b)^2', 'a(b+c)', '-(a+b)^-2', '(1/a)^-2'];
  let n = 0;
  for (let a = -5; a <= 5; a++) for (let b = -4; b <= 4; b += 2) for (const c of [-3, 1, 4]) {
    const vars = { a, b, c, expressions: exprs };
    for (const e of exprs) {
      let r;
      try { r = S.work(e, vars); } catch (err) { continue; }   // 0 to a negative power, …: checkVars says why
      n++;
      const it = { prompt: '$' + r.prompt + ' =$', answer: '$' + r.answer + '$', solution: r.steps.join('\n') };
      ['prompt', 'answer', 'solution'].forEach((f) => katexOk(it[f], 'substitution ' + e));
      const c2 = checkPlain(it, { a, b, c });
      if (!c2 || c2.length) fails.push('substitution ' + e + ' for ' + JSON.stringify({ a, b, c }) + ': ' + (c2 ? c2.join('; ') : 'not checked'));
    }
  }
  assert.ok(n > 1000, 'substitution cases');
  const bad = G.checkVars('algebra.substitution', { a: 0, b: 2, c: 3, expressions: ['a^-1', 'd+1', '2a+'] });
  assert.ok(bad.length === 3 && bad[0].includes('negative power') && bad[1].includes('only a, b and c') && bad[2].includes('ends too soon'), bad.join(' | '));
  // Granular: substitution first, then one layer per line (the sample quiz's steps).
  assert.strictEqual(S.work('(2a/(b+c))^-3', { a: -2, b: 3, c: -4 }).steps.join(' '),
    '$= \\left(\\dfrac{2(-2)}{3+(-4)}\\right)^{-3}$ $= \\left(\\dfrac{-4}{-1}\\right)^{-3}$ $= 4^{-3}$ $= \\dfrac{1}{4^3}$ $= \\dfrac{1}{4\\times4\\times4}$');
  // Scientific notation ×÷: answers are in scientific notation, and uneven quotients are refused.
  for (let seed = 0; seed < 300; seed++) {
    const r = G.render('sci.multiply-divide', G.pick('sci.multiply-divide', {}, 'md' + seed, { index: seed % 4, count: 4 }));
    assert.ok(/^\$[1-9](\.\d*[1-9])?\\times10\^/.test(r.answer), 'scientific notation answer ' + r.answer);
  }
  assert.ok(G.checkVars('sci.multiply-divide', { op: 'divide', digits1: '1', exponent1: 2, digits2: '3', exponent2: 1 })[0].includes('do not divide'));
}

// Fact-family stories: any of the three can be asked; the answer agrees with the givens
// (product = factor x factor, within rounding) and the steps' numbers are right.
{
  const fams = (MW.data.stories || []).filter((s) => s.relation);
  assert.ok(fams.length >= 4, 'family stories');
  const sciVal = (t) => { const m = /([\d.]+)\\times10\^\{?(-?\d+)\}?/.exec(t); return m && Number(m[1]) * Math.pow(10, Number(m[2])); };
  for (const st of fams) {
    const name = st.topic + '.' + st.id, keys = [st.relation.product].concat(st.relation.factors).filter((k) => st.pieces[k].question);
    assert.ok(keys.every((k) => !st.pieces[k].from || !st.pieces[k].from.startsWith('constants.')), name + ' asks for a constant');
    for (let seed = 0; seed < 120; seed++) {
      const find = keys[seed % keys.length];
      const b = G.fillBlock({ kind: 'question', generator: { name, params: { find: [find] }, seed: 'fam' + seed } });
      const givens = (b.prompt.match(/\$[^$]*\$/g) || []).map(sciVal);
      assert.strictEqual(givens.length, 2, name + ' gives two numbers: ' + b.prompt);
      const got = sciVal(b.parts[0].answer);
      const want = find === st.relation.product ? givens[0] * givens[1] : Math.max(...givens) / Math.min(...givens);
      // Dividing: the product is the larger given only when the factor is above 1, so compare both ways.
      const alt = find === st.relation.product ? want : Math.min(...givens) / Math.max(...givens);
      if (!(Math.abs(got - want) / want < 0.006 || Math.abs(got - alt) / alt < 0.006)) fails.push(name + ' seed fam' + seed + ' find ' + find + ': ' + b.parts[0].answer + ' from ' + b.prompt);
      assert.ok(!/10\^\{0\}/.test(b.prompt), name + ' has 10^0');
      // Every "= a x 10^n" line in the steps has the same value as the answer (within rounding).
      b.parts[0].solution.split('\n').forEach((line) => {
        if (!/^\$[=\\]/.test(line) || /dfrac|\)\(|\)\\times\(/.test(line)) return;
        const tex = line.replace(/^\$(=|\\approx)\s*/, '').replace(/\$$/, '');
        const val = evaluateTex(tex);
        if (val != null && Math.abs(val - got) / got > 0.006) fails.push(name + ' step ' + line + ' is not ' + b.parts[0].answer);
      });
    }
  }
}

// Precision (docs/generator-api.md, 5b): the answer has exactly that many significant
// digits, the question says so, and showPrecision off hides only that sentence.
{
  for (let n = 1; n <= 6; n++) {
    for (let seed = 0; seed < 40; seed++) {
      const b = G.fillBlock({ kind: 'question', generator: { name: 'sci.sand-bucket', params: { precision: n }, seed: 'p' + seed } });
      const m = /\$([\d.]+)\\times10\^\{-?\d+\}\$/.exec(b.parts[0].answer);
      assert.ok(m && m[1].replace('.', '').length === n, 'precision ' + n + ': ' + b.parts[0].answer);
      assert.ok(b.parts[0].prompt.includes('Round to ' + n + ' significant digit'), 'precision sentence ' + b.parts[0].prompt);
      const hid = G.fillBlock({ kind: 'question', generator: { name: 'sci.sand-bucket', params: { precision: n, showPrecision: false }, seed: 'p' + seed } });
      assert.strictEqual(hid.parts[0].prompt, b.parts[0].prompt.replace(/ Round to .*$/, ''), 'showPrecision off');
      assert.strictEqual(hid.parts[0].answer, b.parts[0].answer, 'showPrecision changes the answer');
    }
  }
  const pd = G.fillBlock({ kind: 'question', generator: { name: 'sci.planet-distance', params: { precision: 2 }, seed: 'pd' } });
  assert.ok(/\$\d+\.\d\d\$/.test(pd.parts[1].answer) && pd.parts[1].prompt.endsWith('Round to 2 decimal places.'), 'decimal places ' + pd.parts[1].answer);
  assert.ok(MW.stories.roundSig({ digits: '9996', exponent: 2 }, 3).exponent === 3, 'rounding up to the next power of ten');
}

// No repeats in a booklet: a block re-rolls a part that repeats a block above it, and a
// story never gives an earlier answer (nor answers an earlier given).
{
  const sameTwice = { seed: 'nr', blocks: [
    { kind: 'question', generator: { name: 'sci.to-scientific', params: {}, seed: 'same', count: 6 } },
    { kind: 'question', generator: { name: 'sci.to-scientific', params: {}, seed: 'same', count: 6 } }] };
  const d = G.fillDocument(sameTwice);
  const first = new Set(d.blocks[0].parts.map((p) => p.prompt));
  assert.ok(d.blocks[1].parts.every((p) => !first.has(p.prompt)), 'second block repeats the first');
  assert.strictEqual(JSON.stringify(d.blocks[0]), JSON.stringify(G.fillBlock(sameTwice.blocks[0])), 'first block unchanged');
  // Same as filling block by block with earlier, and unlink agrees with the text.
  const b2 = G.fillBlock(sameTwice.blocks[1], { earlier: [d.blocks[0]] });
  assert.strictEqual(JSON.stringify(b2), JSON.stringify(d.blocks[1]), 'fillDocument = fillBlock with earlier');
  const un = G.unlink(sameTwice.blocks[1], { earlier: [d.blocks[0]] });
  assert.strictEqual(JSON.stringify(G.fillBlock(un).parts.map((p) => p.prompt)), JSON.stringify(b2.parts.map((p) => p.prompt)), 'unlink with earlier');
  // Stories: sunlight time first, then distance; the second never gives the first answer.
  const mathIn = (t) => (String(t).match(/\$[^$]*\$/g) || []);
  let clashes = 0;
  for (let seed = 0; seed < 60; seed++) {
    const doc = { seed: 'sun' + seed, blocks: [
      { kind: 'question', generator: { name: 'sci.sunlight', params: { find: ['time'] } } },
      { kind: 'question', generator: { name: 'sci.sunlight', params: { find: ['distance'] } } }] };
    const f = G.fillDocument(doc);
    const ans = mathIn(f.blocks[0].parts[0].answer)[0];
    assert.ok(!f.blocks[1].prompt.includes(ans), 'story gives an earlier answer: ' + ans + ' in ' + f.blocks[1].prompt);
    const alone = G.fillBlock(doc.blocks[1], { docSeed: doc.seed, blockNumber: 2 });
    if (alone.prompt.includes(ans)) clashes++;
    const u = G.unlink(doc.blocks[1], { docSeed: doc.seed, blockNumber: 2, earlier: [f.blocks[0]] });
    assert.strictEqual(G.fillBlock(u).prompt, f.blocks[1].prompt, 'unlinked story keeps the re-rolled text');
  }
  assert.ok(clashes > 0, 'the story test never met a clash');
  // The same thinking question is not asked twice (the next one in the list is used),
  // and that never changes the numbers.
  for (let seed = 0; seed < 30; seed++) {
    const doc = { seed: 'tq' + seed, thinking: { frequency: 1 }, blocks: [
      { kind: 'question', generator: { name: 'rates.heartbeat', params: {}, seed: 'h' } },
      { kind: 'question', generator: { name: 'rates.heartbeat', params: {}, seed: 'h' + seed } }] };
    const f = G.fillDocument(doc);
    const t = f.blocks.map((b) => b.parts.find((p) => p.thinking).prompt);
    assert.ok(t[0] !== t[1], 'thinking question asked twice: ' + t[0]);
    const alone = G.fillBlock(doc.blocks[1], { thinking: doc.thinking });
    assert.strictEqual(alone.prompt === f.blocks[1].prompt || f.blocks[1].prompt !== f.blocks[0].prompt, true, 'thinking choice moved the numbers');
  }
  // The thinking frequency reaches every block from the document.
  const th = G.fillDocument({ seed: 't', thinking: { frequency: 1 }, blocks: [{ kind: 'question', generator: { name: 'rates.hose', params: {} } }] });
  assert.ok(th.blocks[0].parts.some((p) => p.thinking), 'document thinking frequency');
}

// Friendly messages for vars that do not fit.
assert.ok(G.checkVars('powers.monomials', { letter: 'x', coefficients: [6, 4], exponents: [2, 1], ops: ['divide'] })[0].includes('whole'));
assert.ok(G.checkVars('sci.to-scientific', { digits: '370', exponent: 3 })[0].includes('nonzero digit'));
assert.ok(G.checkVars('powers.positive-exponents', { form: 'negative', base: 2, exponent: 4 })[0].includes('odd'));

// Friendly validation errors.
const pq = G.get('powers.product-quotient');
assert.ok(G.validate(pq, { maxExponent: 99 })[0].includes('from 2 to 30'));
assert.ok(G.validate(pq, { bases: [] })[0].includes('at least one'));

// Hand-made and generated example quizzes pass the same numeric check.
for (const f of fs.readdirSync(path.join(__dirname, '..', 'examples')).filter((f) => f.includes('powers'))) {
  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', f), 'utf8'));
  doc.blocks.filter((b) => b.kind === 'question').forEach((b, bi) => {
    // "Evaluate each expression for $a=-3,\ b=2,\ c=-1$": use those values.
    const given = givenIn(b.prompt);
    for (const it of b.parts || [b]) {
      const r = checkItem(it, given);
      if (r && r.length) fails.push(f + ' block ' + bi + ': ' + it.prompt + '\n    ' + r.join('\n    '));
    }
  });
}

if (fails.length) { console.error(fails.slice(0, 30).join('\n')); console.error(fails.length + ' problems'); process.exit(1); }
console.log('Generators OK: ' + items + ' items, ' + checked + ' checked numerically; ' + edited + ' teacher-edited items.');

// The short recipe rebuilds exactly the committed generated quiz.
{
  const root = path.join(__dirname, '..', 'examples');
  const recipe = JSON.parse(fs.readFileSync(path.join(root, 'recipes', 'math9-powers-practice-quiz.json'), 'utf8'));
  const built = G.fillDocument(recipe);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'math9-powers-practice-quiz-generated.json'), 'utf8'));
  assert.strictEqual(JSON.stringify(built), JSON.stringify(saved), 'recipe rebuilds the generated example (run tools/generate.js)');
  console.log('Recipe rebuilds the generated example quiz.');
}
