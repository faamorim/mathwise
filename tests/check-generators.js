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
        const r = checkItem(it);
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
      // Thinking questions off: same story and numbers, only calculation parts.
      const off = G.fillBlock({ kind: 'question', generator: { name: gen.name, params: { thinking: false }, seed: 'st' + seed } });
      assert.strictEqual(off.prompt, b.prompt, gen.name + ' thinking switch changed the numbers');
      assert.ok(off.parts.every((p) => !p.thinking) && off.parts.length === b.parts.filter((p) => !p.thinking).length, gen.name + ' thinking off');
    }
  }
  // Calculation spot checks.
  const D = MW.data;
  const val = (d) => Number(MW.sci.mantissa(d.digits)) * Math.pow(10, d.exponent);
  for (let seed = 0; seed < 100; seed++) {
    const v = G.pick('rates.typing-race', {}, 'c' + seed);
    const ra = v.wordsA * 60 / v.secsA, rb = v.wordsB / v.minsB;
    const it = G.render('rates.typing-race', v);
    assert.ok(it.parts[0].answer.startsWith(ra > rb ? v.a : v.b), 'typing faster');
    assert.ok(it.parts[2].answer.includes('$' + MW.math.num(Math.abs(ra - rb) * 60) + '$'), 'typing difference');
    const l = G.pick('sci.light-travel', {}, 'c' + seed);
    const mins = val(D.planets.items.find((p) => p.name === l.planet).distance) / 3e5 / 60;
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
  // The expression language reads board notation.
  const c = (e, x) => MG.compile(e)(x);
  assert.strictEqual(c('-1/2x+3', 4), 1);
  assert.strictEqual(c('2(x-1)^2', 3), 8);
  assert.strictEqual(c('abs(x)-3', -5), 2);
  assert.ok(MG.check({ x: { min: 0, max: 5 }, y: { min: 0, max: 5 }, items: [{ type: 'function', expr: '2x+' }] })[0].includes('cannot read'));
  console.log('Graphs OK: ' + graphs + ' generated graphs checked.');
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
    const given = {};
    const m = /for \$([^$]*)\$/.exec(b.prompt || '');
    if (m) m[1].split(/,\\ |,/).forEach((kv) => { const [k, v] = kv.split('='); given[k.trim()] = Number(v); });
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
