/*
 * Mathwise generator library: shared core.
 *
 * A generator is a plain object registered with Mathwise.generators.register():
 *
 *   {
 *     name: 'powers.product-quotient',     // stable id, stored in documents
 *     topic: 'Powers',                      // groups generators in pickers
 *     title: 'Product and quotient of powers',
 *     prompt: 'Simplify',                   // default question prompt for a block
 *     columns: 3, workSpace: 1.5,           // suggested layout for a block of parts
 *     whole: false,                         // true: one generated item IS the question (no parts)
 *     params: [ ...parameter descriptions, see below... ],
 *     validate: function (values) { return [friendly error strings]; },   // optional
 *     variables: [ ...the vars pick() returns, see VAR_KINDS... ],
 *     pick: function (values, rng, ctx) { return vars },       // every random choice
 *     render: function (vars) { return { prompt, answer, steps, slots } },   // no randomness
 *     checkVars: function (vars) { return [friendly error strings]; }      // optional
 *   }
 * register() makes generate(values, rng, ctx) = render(pick(values, rng, ctx)).
 *
 * Parameters show real values (never "easy/hard"):
 *   { key, label, type: 'number', min, max, default }
 *   { key, label, type: 'choice', values: [{ value, label }], default }
 *   { key, label, type: 'set',    values: [{ value, label }], default: [...] }   // pick any
 *   { key, label, type: 'toggle', default: true }
 *
 * Determinism: the seed is always passed in (no clock, no Math.random). A block
 * stores { name, params, seed, count } and part i is generated from (seed, i),
 * so the same block always rebuilds the same questions.
 *
 * Math is LaTeX inside $…$ (the worksheet markup); steps are one line each,
 * every rule application its own line (7^{-8}÷7^2 = 7^{-8-2} = 7^{-10}).
 *
 * The full contract (what pages may rely on) is docs/generator-api.md.
 * Classic script: works from file://, in the editor page, and in node via vm.
 */
(function (root) {
  'use strict';
  var MW = root.Mathwise = root.Mathwise || {};
  var registry = {};
  var order = [];

  // ---------- seeded random numbers ----------

  function hashString(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // Final avalanche (murmur3 fmix32) so "seed:0" and "seed:1" start far apart.
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    var next = mulberry32(hashString(String(seed)));
    var rng = {
      next: next,
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      sign: function () { return next() < 0.5 ? -1 : 1; },
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      // Integer in [lo, hi] that passes ok(); throws if none found (generator bug or impossible params).
      intWhere: function (lo, hi, ok) {
        var c = [];
        for (var v = lo; v <= hi; v++) if (ok(v)) c.push(v);
        if (!c.length) throw new Error('No value in [' + lo + ', ' + hi + '] fits.');
        return rng.pick(c);
      }
    };
    return rng;
  }

  function partSeed(seed, index, attempt) {
    return String(seed) + ':' + index + (attempt ? '#' + attempt : '');
  }

  // ---------- registry ----------

  function register(gen) {
    if (gen && !gen.generate && typeof gen.pick === 'function' && typeof gen.render === 'function') {
      // A template generator: generate is always render(pick(...)), so an unlinked
      // question re-renders exactly like the generated one.
      gen.generate = function (v, rng, ctx) { return gen.render(gen.pick(v, rng, ctx)); };
    }
    if (!gen || !gen.name || typeof gen.generate !== 'function') throw new Error('Bad generator');
    if (!registry[gen.name]) order.push(gen.name);
    registry[gen.name] = gen;
    return gen;
  }

  function get(name) {
    var g = registry[name];
    if (!g) throw new Error('Unknown generator: ' + name);
    return g;
  }

  function list() { return order.map(function (n) { return registry[n]; }); }

  function defaults(gen) {
    var v = {};
    (gen.params || []).forEach(function (p) {
      v[p.key] = Array.isArray(p.default) ? p.default.slice() : p.default;
    });
    return v;
  }

  function withDefaults(gen, values) {
    var v = defaults(gen);
    Object.keys(values || {}).forEach(function (k) { v[k] = values[k]; });
    return v;
  }

  // Friendly errors for out-of-range values, then the generator's own checks.
  function validate(gen, values) {
    var v = withDefaults(gen, values);
    var errs = [];
    (gen.params || []).forEach(function (p) {
      var x = v[p.key];
      var allowed = (p.values || []).map(function (o) { return o.value; });
      if (p.type === 'number') {
        if (typeof x !== 'number' || !isFinite(x) || Math.floor(x) !== x) errs.push(p.label + ' must be a whole number.');
        else if (x < p.min || x > p.max) errs.push(p.label + ' must be from ' + p.min + ' to ' + p.max + '.');
      } else if (p.type === 'choice') {
        if (allowed.indexOf(x) < 0) errs.push(p.label + ': choose one of ' + allowed.join(', ') + '.');
      } else if (p.type === 'set') {
        if (!Array.isArray(x) || !x.length) errs.push(p.label + ': choose at least one.');
        else x.forEach(function (y) { if (allowed.indexOf(y) < 0) errs.push(p.label + ': "' + y + '" is not an option.'); });
      } else if (p.type === 'toggle') {
        if (typeof x !== 'boolean') errs.push(p.label + ' must be on or off.');
      }
    });
    if (!errs.length && gen.validate) errs = errs.concat(gen.validate(v) || []);
    return errs;
  }

  // Spread a set-type parameter across the parts of a block, in the order the
  // generator lists the options (so a block of 9 reads like a hand-made one:
  // simple forms first). Single items pick at random.
  function spread(gen, key, chosen, rng, ctx) {
    var p = (gen.params || []).filter(function (q) { return q.key === key; })[0];
    var ordered = p ? p.values.map(function (o) { return o.value; }).filter(function (x) { return chosen.indexOf(x) >= 0; }) : chosen.slice();
    if (ctx && ctx.count > 1 && typeof ctx.index === 'number') {
      return ordered[Math.floor(ctx.index * ordered.length / ctx.count)];
    }
    return rng.pick(ordered);
  }

  /**
   * Run one generator once.
   * opts.output: 'steps' (default) | 'answer' | 'none'
   * opts.index / opts.count: position in a block (used to spread forms).
   * Returns { prompt, answer, steps: [..], workSpace }.
   */
  function generate(name, values, seed, opts) {
    var gen = get(name);
    opts = opts || {};
    var v = withDefaults(gen, values);
    var errs = validate(gen, v);
    if (errs.length) throw new Error(gen.title + ': ' + errs.join(' '));
    var ctx = { index: opts.index, count: opts.count, spread: function (key, rng) { return spread(gen, key, v[key], rng, ctx); } };
    var r = gen.generate(v, makeRng(seed), ctx);
    var out = { prompt: r.prompt, workSpace: r.workSpace || gen.workSpace || 1 };
    var output = opts.output || 'steps';
    if (output !== 'none') out.answer = r.answer;
    if (output === 'steps') {
      out.steps = r.steps || [];
      if (r.methods) out.methods = r.methods;
    }
    if (r.followUps && output !== 'none') out.followUps = r.followUps;
    return out;
  }

  // ---------- question templates ----------
  //
  // A template generator splits generate() in two:
  //   pick(values, rng, ctx) -> vars     every random choice, as plain JSON values
  //   render(vars)           -> { prompt, answer, steps, slots? }   no randomness
  // and describes its vars in `variables` (see VAR_KINDS) so a page can show
  // them as fields. An unlinked question keeps { name, vars, overrides } and
  // re-renders when the teacher edits a value; text typed over by hand
  // (overrides) wins, and may use %name% placeholders for vars and slots.

  var VAR_KINDS = {
    int: function (x, d) {
      if (typeof x !== 'number' || !isFinite(x) || Math.floor(x) !== x) return 'must be a whole number';
      if (d.min != null && x < d.min) return 'must be at least ' + d.min;
      if (d.max != null && x > d.max) return 'must be at most ' + d.max;
      if (d.nonzero && x === 0) return 'cannot be 0';
    },
    letter: function (x) { if (typeof x !== 'string' || !/^[a-zA-Z]$/.test(x)) return 'must be one letter'; },
    'int-or-letter': function (x, d) {
      if (typeof x === 'string') return VAR_KINDS.letter(x, d);
      return VAR_KINDS.int(x, d);
    },
    digits: function (x) {
      if (typeof x !== 'string' || !/^[1-9](\d*[1-9])?$/.test(x)) return 'must be digits that start and end with a nonzero digit, like 37 or 4061';
    },
    choice: function (x, d) {
      if (!d.values.some(function (o) { return o.value === x; })) return 'choose one of ' + d.values.map(function (o) { return o.label; }).join(', ');
    },
    toggle: function (x) { if (typeof x !== 'boolean') return 'must be on or off'; },
    // The vars of another template: { key, kind: 'vars', by: 'form', templates: { formValue: 'generator.name' } }.
    // Checked (deeply) in checkVars; a page shows that template's variables.
    vars: function (x) { if (!x || typeof x !== 'object' || Array.isArray(x)) return 'must be a set of values'; },
    list: function (x, d) {
      if (!Array.isArray(x)) return 'must be a list';
      if (d.minLength != null && x.length < d.minLength) return 'needs at least ' + d.minLength + ' items';
      if (d.maxLength != null && x.length > d.maxLength) return 'takes at most ' + d.maxLength + ' items';
      var item = d.of || { kind: 'int' };
      for (var i = 0; i < x.length; i++) {
        var e = VAR_KINDS[item.kind] && VAR_KINDS[item.kind](x[i], item);
        if (e) return 'item ' + (i + 1) + ' ' + e;
      }
    }
  };

  function isTemplate(gen) { return typeof gen.pick === 'function' && typeof gen.render === 'function'; }

  // Is variable d used for these vars? (`when: { form: ['basic', 'ten'] }`)
  function varApplies(d, vars) {
    if (!d.when) return true;
    return Object.keys(d.when).every(function (k) { return d.when[k].indexOf(vars[k]) >= 0; });
  }

  // Friendly messages for vars a teacher typed (empty when render can use them).
  function checkVars(gen, vars) {
    if (typeof gen === 'string') gen = get(gen);
    if (!isTemplate(gen)) return [gen.title + ' is not a template.'];
    vars = vars || {};
    var errs = [];
    (gen.variables || []).forEach(function (d) {
      if (!varApplies(d, vars)) return;
      var e = vars[d.key] === undefined ? 'is missing' : VAR_KINDS[d.kind] && VAR_KINDS[d.kind](vars[d.key], d);
      if (e) errs.push(d.label + ' ' + e + '.');
      else if (d.kind === 'vars') {
        var inner = d.templates && d.templates[vars[d.by]];
        if (!inner) errs.push(d.label + ': no template for ' + vars[d.by] + '.');
        else errs = errs.concat(checkVars(inner, vars[d.key]));
      }
    });
    if (!errs.length && gen.checkVars) errs = errs.concat(gen.checkVars(vars) || []);
    return errs;
  }

  // The random part of generate: the vars a seed picks (same rng use as generate).
  function pick(name, values, seed, opts) {
    var gen = get(name);
    if (!isTemplate(gen)) throw new Error(gen.title + ' is not a template.');
    opts = opts || {};
    var v = withDefaults(gen, values);
    var errs = validate(gen, v);
    if (errs.length) throw new Error(gen.title + ': ' + errs.join(' '));
    var ctx = { index: opts.index, count: opts.count, spread: function (key, rng) { return spread(gen, key, v[key], rng, ctx); } };
    return gen.pick(v, makeRng(seed), ctx);
  }

  // %name% -> the slot or var of that name (scalars only); %% is a literal %.
  // Unknown names are left as they are.
  function fillText(text, vars, slots) {
    return String(text).replace(/%%|%([A-Za-z_][A-Za-z0-9_]*)%/g, function (m, k) {
      if (m === '%%') return '%';
      if (slots && slots[k] != null) return String(slots[k]);
      var x = vars[k];
      return x != null && typeof x !== 'object' ? String(x) : m;
    });
  }

  /**
   * Render a template from its vars (no seed). opts.output as in generate;
   * opts.overrides: { prompt?, answer?, steps?: [..] } typed by hand, used
   * instead of the rendered text (with %name% placeholders filled).
   * Throws with friendly messages when the vars do not fit (see checkVars);
   * with opts.noThrow it returns { errors: [messages] } instead.
   */
  function render(name, vars, opts) {
    var gen = get(name);
    opts = opts || {};
    var errs = checkVars(gen, vars);
    if (errs.length && opts.noThrow) return { errors: errs };
    if (errs.length) throw new Error(gen.title + ': ' + errs.join(' '));
    var r = gen.render(JSON.parse(JSON.stringify(vars)));
    var ov = opts.overrides || {};
    var slots = r.slots || {};
    function f(t) { return fillText(t, vars, slots); }
    var out = { prompt: ov.prompt != null ? f(ov.prompt) : r.prompt, workSpace: r.workSpace || gen.workSpace || 1 };
    var output = opts.output || 'steps';
    if (output !== 'none') out.answer = ov.answer != null ? f(ov.answer) : r.answer;
    if (output === 'steps') {
      out.steps = ov.steps != null ? ov.steps.map(f) : (r.steps || []);
      if (r.methods && ov.steps == null) out.methods = r.methods;
    }
    if (r.followUps && output !== 'none' && ov.prompt == null) out.followUps = r.followUps;
    return out;
  }

  // Names a page may offer as %name% placeholders for these vars.
  function placeholders(name, vars) {
    var gen = get(name);
    var r = gen.render(JSON.parse(JSON.stringify(vars)));
    var names = Object.keys(vars).filter(function (k) { return vars[k] != null && typeof vars[k] !== 'object'; });
    Object.keys(r.slots || {}).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
    return names;
  }

  /**
   * THE seed rule (the only copy of it): a block's own generator.seed wins;
   * without one, the block uses the document seed plus its 1-based position,
   * "<doc seed>/<block number>" ("mathwise" when the document has no seed).
   * Changing this changes the numbers of every saved quiz: it is part of the API.
   */
  function blockSeed(generator, docSeed, blockNumber) {
    if (generator && generator.seed != null && generator.seed !== '') return String(generator.seed);
    return String(docSeed != null && docSeed !== '' ? docSeed : 'mathwise') + '/' + blockNumber;
  }

  /**
   * Fill a worksheet question block from its `generator` field:
   *   { kind: 'question', generator: { name, params, seed?, count } }
   * opts.docSeed / opts.blockNumber: used when the block has no seed of its own.
   * opts.output: 'answer' leaves out the worked solutions.
   * Parts get prompt, answer and solution (steps joined one per line).
   * Repeated prompts inside a block are re-rolled deterministically.
   * Returns a new block (its `generator` field exactly as given); the input is not changed.
   */
  function fillBlock(block, opts) {
    opts = opts || {};
    if (!block.generator && block.template) return fillTemplateBlock(block, opts);
    var g = JSON.parse(JSON.stringify(block.generator));
    g.seed = blockSeed(block.generator, opts.docSeed, opts.blockNumber);
    var gen = get(g.name);
    var out = JSON.parse(JSON.stringify(block));
    var steps = opts.output !== 'answer';
    function toItem(r) {
      var it = { prompt: r.prompt, answer: r.answer };
      if (steps && r.steps && r.steps.length) it.solution = r.steps.join('\n');
      return it;
    }
    if (out.prompt == null) out.prompt = gen.prompt || 'Answer';
    if (out.columns == null && gen.columns) out.columns = gen.columns;
    if (out.space == null) out.space = gen.workSpace || 1;
    if (gen.whole) {
      var w = generate(g.name, g.params, partSeed(g.seed, 0), { output: 'steps' });
      out.prompt = w.prompt;   // a whole-question generator writes the full prompt
      out.answer = w.answer;
      if (steps && w.steps.length) out.solution = w.steps.join('\n');
      delete out.parts;
      return out;
    }
    var count = g.count || 4;
    var seen = {};
    out.parts = [];
    for (var i = 0; i < count; i++) {
      var r, attempt = 0;
      do {
        r = generate(g.name, g.params, partSeed(g.seed, i, attempt), { index: i, count: count });
        attempt++;
      } while (seen[r.prompt] && attempt < 50);
      seen[r.prompt] = true;
      out.parts.push(keepExtras(toItem(r), block.parts && block.parts[i]));
    }
    return out;
  }

  // Part fields the library does not own (marks, space, label, …) survive a re-render.
  var OWNED = { prompt: 1, answer: 1, solution: 1, template: 1 };
  function keepExtras(item, old) {
    if (!old) return item;
    Object.keys(old).forEach(function (k) { if (!OWNED[k] && item[k] === undefined) item[k] = old[k]; });
    return item;
  }

  // Pick, re-rolling a part whose prompt repeats an earlier part (same rule as fillBlock).
  function blockVars(g, seed) {
    var gen = get(g.name);
    if (gen.whole) return [pick(g.name, g.params, partSeed(seed, 0))];
    var count = g.count || 4, seen = {}, out = [];
    for (var i = 0; i < count; i++) {
      var vars, attempt = 0, p;
      do {
        vars = pick(g.name, g.params, partSeed(seed, i, attempt), { index: i, count: count });
        p = gen.render(JSON.parse(JSON.stringify(vars))).prompt;
        attempt++;
      } while (seen[p] && attempt < 50);
      seen[p] = true;
      out.push(vars);
    }
    return out;
  }

  /**
   * Unlink a generator block: the same questions, now from vars instead of a seed.
   *   { kind: 'question', template: { name, params },
   *     parts: [ { prompt, answer, solution, template: { vars, overrides? } }, ... ] }
   * A whole-question template keeps vars (and overrides) on block.template itself.
   * params are the settings at unlink time, so a page can pick() one more part
   * like these. The filled text stays on the block, so a page that does not know
   * templates still shows it as a hand-made question. opts as in fillBlock.
   */
  function unlink(block, opts) {
    opts = opts || {};
    var gen = get(block.generator.name);
    if (!isTemplate(gen)) throw new Error(gen.title + ' is not a template.');
    var seed = blockSeed(block.generator, opts.docSeed, opts.blockNumber);
    var filled = fillBlock(block, opts);
    var vars = blockVars(block.generator, seed);
    delete filled.generator;
    filled.template = { name: gen.name, params: withDefaults(gen, block.generator.params) };
    if (gen.whole) filled.template.vars = vars[0];
    else filled.parts.forEach(function (p, i) { p.template = { vars: vars[i] }; });
    return filled;
  }

  // Fill a template block: re-render every part that has template vars (a part
  // without them is hand-made and kept as it is); other part fields are kept.
  function fillTemplateBlock(block, opts) {
    var t = block.template;
    var gen = get(t.name);
    var steps = opts.output !== 'answer';
    var out = JSON.parse(JSON.stringify(block));
    if (out.prompt == null) out.prompt = gen.prompt || 'Answer';
    if (out.columns == null && gen.columns) out.columns = gen.columns;
    if (out.space == null) out.space = gen.workSpace || 1;
    function apply(target, tv) {
      var r = render(t.name, tv.vars, { overrides: tv.overrides });
      target.prompt = r.prompt;
      target.answer = r.answer;
      if (steps && r.steps.length) target.solution = r.steps.join('\n'); else delete target.solution;
    }
    if (gen.whole) {
      apply(out, t);
      delete out.parts;
      return out;
    }
    (out.parts || []).forEach(function (p) { if (p.template) apply(p, p.template); });
    return out;
  }

  // Fill every generator block of a document (other blocks are kept as they are).
  // A block without its own seed uses the document seed (see blockSeed).
  function fillDocument(doc, opts) {
    var out = JSON.parse(JSON.stringify(doc));
    out.blocks = out.blocks.map(function (b, i) {
      if (!b.generator && !b.template) return b;
      var o = { docSeed: doc.seed, blockNumber: i + 1 };
      if (opts && opts.output) o.output = opts.output;
      return fillBlock(b, o);
    });
    return out;
  }

  // ---------- math helpers shared by generators ----------

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }

  // Exact fraction {n, d} with d > 0, reduced.
  function frac(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) throw new Error('Division by zero');
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
  }
  function fadd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }

  // Thin-space groups of three for numbers of 5+ digits (10\,000), like the samples.
  function num(n) {
    var s = String(Math.abs(n));
    if (s.length >= 5 && s.indexOf('.') < 0) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
    return (n < 0 ? '-' : '') + s;
  }

  // \frac{n}{d} (or \dfrac with big=true); whole numbers stay whole.
  function fracTex(f, big) {
    if (f.d === 1) return num(f.n);
    return (f.n < 0 ? '-' : '') + '\\' + (big ? 'd' : '') + 'frac{' + num(Math.abs(f.n)) + '}{' + num(f.d) + '}';
  }

  // 25\frac{1}{5} for improper fractions, like the samples.
  function mixedTex(f) {
    if (f.d === 1 || Math.abs(f.n) < f.d) return fracTex(f);
    var w = Math.trunc(f.n / f.d), r = Math.abs(f.n % f.d);
    return num(w) + '\\frac{' + r + '}{' + f.d + '}';
  }

  // b^{e}: wraps negative bases in brackets; single-character exponents lose braces.
  function pow(base, e) {
    var b = typeof base === 'number' && base < 0 ? '(' + base + ')' : String(base);
    var es = String(e);
    return b + '^' + (es.length === 1 ? es : '{' + es + '}');
  }

  // The exponent sum as written in a step: "4+(-11)", "-8-(-15)", "-5-3".
  function opExp(a, op, b) {
    return a + op + (b < 0 ? '(' + b + ')' : b);
  }

  // Coefficient times variable power: 5n^7, -x^3, 4, -2t, x^{-9}.
  function mono(c, v, e) {
    if (e === 0) return num(c);
    var vp = e === 1 ? v : pow(v, e);
    if (c === 1) return vp;
    if (c === -1) return '-' + vp;
    return num(c) + vp;
  }

  // Public API: everything here (and the descriptor fields) is described in
  // docs/generator-api.md. Pages and tools use nothing else.
  MW.generators = {
    apiVersion: 1,
    register: register,
    get: get,
    list: list,
    defaults: defaults,
    validate: validate,
    generate: generate,
    fillBlock: fillBlock,
    fillDocument: fillDocument,
    blockSeed: blockSeed,
    // Question templates (docs/generator-api.md, section 6)
    varKinds: Object.keys(VAR_KINDS),
    varTemplate: function (d, vars) { return d.kind === 'vars' && d.templates ? d.templates[vars[d.by]] : null; },
    isTemplate: isTemplate,
    varApplies: varApplies,
    checkVars: checkVars,
    pick: pick,
    render: render,
    placeholders: placeholders,
    unlink: unlink,
    makeRng: makeRng,
    partSeed: partSeed
  };
  MW.math = { gcd: gcd, frac: frac, fadd: fadd, num: num, fracTex: fracTex, mixedTex: mixedTex, pow: pow, opExp: opExp, mono: mono };
})(typeof window !== 'undefined' ? window : this);
