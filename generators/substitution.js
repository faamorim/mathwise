/*
 * Substitution: evaluate expressions for given values ("Evaluate each expression for
 * a=-2, b=3, c=-4"). One whole question: the values, then parts a), b), …
 *
 * The expressions are plain text a teacher can type, like "(2a/(b+c))^-3", so an
 * unlinked question can take any expression. Worked steps come from the expression
 * itself: substitute (negatives in brackets), then one layer at a time, every
 * operation whose inputs are already numbers, with the rules shown as their own
 * steps (x^-n = 1/x^n, and small powers written out as products).
 * Needs core.js first.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var M = root.Mathwise.math;
  var frac = M.frac, num = M.num;

  // ---------- reading an expression ----------
  // Numbers, single letters, + - * / ^, brackets; 2a and 3(a+b) multiply.
  // -a^2 is -(a^2). After "/" the divisor is one factor: write a/(2b) for a over 2b.

  function tokenize(src) {
    var s = String(src).replace(/\s+/g, '').replace(/[{]/g, '(').replace(/[}]/g, ')').replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
    var out = [], i = 0, m;
    while (i < s.length) {
      var rest = s.slice(i);
      if ((m = /^\d+/.exec(rest))) { out.push({ t: 'num', v: parseInt(m[0], 10) }); i += m[0].length; continue; }
      if (/^[a-z]/.test(rest)) { out.push({ t: 'var', v: s[i] }); i++; continue; }
      if ('+-*/^()'.indexOf(s[i]) >= 0) { out.push({ t: s[i] }); i++; continue; }
      throw new Error('cannot read "' + rest + '"');
    }
    return out;
  }

  function parse(src) {
    var tk = tokenize(src), p = 0;
    function peek() { return tk[p] && tk[p].t; }
    function eat(t) { if (peek() !== t) throw new Error('a "' + t + '" is missing'); p++; }
    function atom() {
      var k = peek();
      if (k === 'num') return { t: 'n', v: frac(tk[p++].v) };
      if (k === 'var') return { t: 'x', name: tk[p++].v };
      if (k === '(') { p++; var e = sum(); eat(')'); return e; }
      throw new Error(k ? 'did not expect "' + k + '"' : 'it ends too soon');
    }
    function power() {
      var b = atom();
      if (peek() === '^') { p++; return { t: 'pow', a: b, b: unary() }; }
      return b;
    }
    function unary() {
      if (peek() === '-') {
        p++;
        var a = unary();
        return a.t === 'n' ? { t: 'n', v: frac(-a.v.n, a.v.d) } : { t: 'neg', a: a };
      }
      if (peek() === '+') { p++; return unary(); }
      return power();
    }
    function startsFactor() { var k = peek(); return k === 'num' || k === 'var' || k === '('; }
    function product() {
      var cur = { t: 'prod', f: [{ e: unary(), op: 'first' }] };
      for (;;) {
        if (peek() === '*') { p++; cur.f.push({ e: unary(), op: 'times' }); }
        else if (peek() === '/') { p++; cur = { t: 'prod', f: [{ e: { t: 'div', a: one(cur), b: unary() }, op: 'first' }] }; }
        else if (startsFactor()) cur.f.push({ e: power(), op: 'imp' });
        else return one(cur);
      }
    }
    function one(pr) { return pr.f.length === 1 ? pr.f[0].e : pr; }
    function sum() {
      var terms = [{ s: 1, e: product() }];
      for (;;) {
        if (peek() === '+') { p++; terms.push({ s: 1, e: product() }); }
        else if (peek() === '-') { p++; terms.push({ s: -1, e: product() }); }
        else return terms.length === 1 ? terms[0].e : { t: 'sum', terms: terms };
      }
    }
    var tree = sum();
    if (p !== tk.length) throw new Error('did not expect "' + tk[p].t + '"');
    return tree;
  }

  function lettersIn(e, out) {
    out = out || [];
    if (e.t === 'x') { if (out.indexOf(e.name) < 0) out.push(e.name); }
    else kids(e).forEach(function (k) { lettersIn(k, out); });
    return out;
  }
  function kids(e) {
    if (e.t === 'neg') return [e.a];
    if (e.t === 'div' || e.t === 'pow') return [e.a, e.b];
    if (e.t === 'sum') return e.terms.map(function (t) { return t.e; });
    if (e.t === 'prod') return e.f.map(function (f) { return f.e; });
    return [];
  }

  // ---------- writing it as LaTeX ----------
  // Returns { s, lvl (1 sum, 2 product, 3 power, 4 atom), neg (starts with -), big (has a fraction) }.

  function br(x) { return x.big ? '\\left(' + x.s + '\\right)' : '(' + x.s + ')'; }
  function tex(e) {
    if (e.t === 'n') {
      var v = e.v;
      if (v.d === 1) return { s: num(v.n), lvl: 4, neg: v.n < 0, lit: !e.sub };
      return { s: M.fracTex(v, true), lvl: 4, neg: v.n < 0, big: true, isFrac: true, lit: !e.sub };
    }
    if (e.t === 'x') return { s: e.name, lvl: 4 };
    if (e.t === 'neg') {
      var a = tex(e.a);
      return { s: '-' + (a.neg || a.lvl < 2 ? br(a) : a.s), lvl: 2, neg: true, big: a.big };
    }
    if (e.t === 'sum') {
      var s = '', big = false, first;
      e.terms.forEach(function (t, i) {
        var x = tex(t.e);
        big = big || x.big;
        if (i === 0) { first = x; s = t.s < 0 ? '-' + (x.neg || x.lvl < 2 ? br(x) : x.s) : x.s; return; }
        s += (t.s < 0 ? '-' : '+') + (x.neg || x.lvl < 2 ? br(x) : x.s);
      });
      return { s: s, lvl: 1, neg: e.terms[0].s < 0 || first.neg, big: big };
    }
    if (e.t === 'prod') {
      var out = '', bg = false;
      e.f.forEach(function (f, i) {
        var x = tex(f.e);
        bg = bg || x.big;
        if (i === 0) { out = (x.lvl < 2 || (x.neg && !x.lit && x.lvl === 4)) ? br(x) : x.s; return; }
        if (f.op === 'times') { out += '\\times' + (x.neg || x.lvl < 2 ? br(x) : x.s); return; }
        // Written side by side: brackets when it would read as one number (2(3), 2(-3), 2\left(\frac12\right)).
        var wrap = x.neg || x.lvl < 3 || x.isFrac || /^[\d\\]/.test(x.s) || (f.e.t === 'div');
        out += wrap ? br(x) : x.s;
      });
      return { s: out, lvl: 2, neg: false, big: bg };
    }
    if (e.t === 'div') return { s: '\\dfrac{' + tex(e.a).s + '}{' + tex(e.b).s + '}', lvl: 4, big: true, isFrac: true };
    if (e.t === 'pow') {
      var b = tex(e.a), x2 = tex(e.b);
      var base = b.lvl < 4 || b.neg || b.isFrac ? br(b) : b.s;
      return { s: base + '^' + (x2.s.length === 1 ? x2.s : '{' + x2.s + '}'), lvl: 3, big: b.big };
    }
    throw new Error('Bad expression');
  }
  function show(e) { return tex(e).s; }

  // ---------- working it out ----------

  function leaf(v) { return { t: 'n', v: v, sub: true }; }
  function isN(e) { return e.t === 'n'; }
  function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }

  function substitute(e, values) {
    if (e.t === 'x') {
      if (values[e.name] === undefined) throw new Error('has the letter ' + e.name + ', which has no value');
      return leaf(frac(values[e.name]));
    }
    if (e.t === 'n') return e;
    var c = JSON.parse(JSON.stringify(e));
    if (c.t === 'neg') c.a = substitute(e.a, values);
    else if (c.t === 'div' || c.t === 'pow') { c.a = substitute(e.a, values); c.b = substitute(e.b, values); }
    else if (c.t === 'sum') c.terms = e.terms.map(function (t) { return { s: t.s, e: substitute(t.e, values) }; });
    else if (c.t === 'prod') c.f = e.f.map(function (f) { return { op: f.op, e: substitute(f.e, values) }; });
    return c;
  }

  // One layer: every operation whose inputs are all numbers is done (or rewritten by its rule).
  function reduce(e) {
    if (isN(e)) return e;
    var ks = kids(e);
    if (!ks.every(isN)) {
      var c = { t: e.t };
      if (e.t === 'neg') c.a = reduce(e.a);
      else if (e.t === 'div' || e.t === 'pow') { c.a = reduce(e.a); c.b = reduce(e.b); }
      else if (e.t === 'sum') c.terms = e.terms.map(function (t) { return { s: t.s, e: reduce(t.e) }; });
      else if (e.t === 'prod') {
        // A power written out inside a product joins it: 3(-2)^2(3) -> 3(-2)(-2)(3).
        c.f = [];
        e.f.forEach(function (f) {
          var r = reduce(f.e);
          if (r.t === 'prod' && r.spread) r.f.forEach(function (g, i) { c.f.push({ op: i === 0 && f.op !== 'first' ? f.op : (i === 0 ? 'first' : 'imp'), e: g.e }); });
          else c.f.push({ op: f.op, e: r });
        });
      }
      return c;
    }
    if (e.t === 'neg') return leaf(frac(-e.a.v.n, e.a.v.d));
    if (e.t === 'sum') return leaf(e.terms.reduce(function (acc, t) { return M.fadd(acc, frac(t.s * t.e.v.n, t.e.v.d)); }, frac(0)));
    if (e.t === 'prod') return leaf(e.f.reduce(function (acc, f) { return mul(acc, f.e.v); }, frac(1)));
    if (e.t === 'div') {
      if (e.b.v.n === 0) throw new Error('divides by zero');
      return leaf(frac(e.a.v.n * e.b.v.d, e.a.v.d * e.b.v.n));
    }
    // A power.
    var b = e.a.v, x = e.b.v;
    if (x.d !== 1) throw new Error('has an exponent that is not a whole number');
    var n = x.n;
    if (n < 0) {
      if (b.n === 0) throw new Error('raises 0 to a negative power');
      var flip = b.d === 1 ? null : leaf(frac(b.d, b.n));
      if (flip) return n === -1 ? flip : { t: 'pow', a: flip, b: leaf(frac(-n)) };
      return { t: 'div', a: leaf(frac(1)), b: n === -1 ? e.a : { t: 'pow', a: e.a, b: leaf(frac(-n)) } };
    }
    if (n === 0) return leaf(frac(1));
    if (n === 1) return e.a;
    // Small powers of whole numbers written out: (-2)^3 = (-2)(-2)(-2).
    if (b.d === 1 && n <= 3 && Math.abs(b.n) >= 2) {
      var f = [];
      for (var i = 0; i < n; i++) f.push({ e: leaf(b), op: i === 0 ? 'first' : (b.n < 0 ? 'imp' : 'times') });
      return { t: 'prod', f: f, spread: true };
    }
    return leaf(frac(Math.pow(b.n, n), Math.pow(b.d, n)));
  }

  function biggest(e) {
    if (isN(e)) return Math.max(Math.abs(e.v.n), e.v.d);
    return Math.max.apply(null, kids(e).map(biggest));
  }

  /**
   * Work out an expression for the values: { prompt (LaTeX), steps ["$= …$"], answer
   * (LaTeX), value {n, d}, biggest (largest number in any step) }. Throws an Error
   * whose message finishes the sentence "The expression … " when it cannot.
   */
  function work(src, values) {
    var tree = parse(src);
    var e = substitute(tree, values);
    var steps = [], big = biggest(e);
    for (var guard = 0; !isN(e); guard++) {
      if (guard > 40) throw new Error('takes too many steps');
      steps.push(show(e));
      e = reduce(e);
      big = Math.max(big, biggest(e));
      if (big > 1e9) throw new Error('gets too big');
    }
    var answer = M.fracTex(e.v);
    // The last step is the answer written as \dfrac: leave it to the answer.
    while (steps.length && steps[steps.length - 1].replace(/\\dfrac/g, '\\frac') === answer) steps.pop();
    return { prompt: show(tree), steps: steps.map(function (s) { return '$= ' + s + '$'; }), answer: answer, value: e.v, biggest: big };
  }

  // ---------- the generator ----------

  var LETTERS = ['a', 'b', 'c'];
  var FORMS = [
    { value: 'negative-power', label: 'A letter to a power, like −a⁻¹ or −b²' },
    { value: 'sum-power', label: 'A sum to a power, like (a+b+c)⁻¹' },
    { value: 'letter-power', label: 'A letter as the exponent, like aᵇ' },
    { value: 'fraction-power', label: 'A fraction to a power, like (2a/(b+c))⁻³' },
    { value: 'terms', label: 'Products and sums, like 3a²b or a²−2c' }
  ];
  function formText(form, rng) {
    var L = rng.shuffle(LETTERS), a = L[0], b = L[1], c = L[2];
    var k = rng.int(2, 4), j = rng.int(1, 3);
    switch (form) {
      case 'negative-power': return rng.pick(['-' + a + '^-1', '-' + a + '^2', '(-' + a + ')^2', a + '^-2', '-' + a + '^-2', a + '^-3']);
      case 'sum-power': return rng.pick(['(a+b+c)^-1', '(' + a + '+' + b + ')^-2', '(' + a + '-' + b + ')^-1', '(a+b+c)^2', '(' + a + '+' + b + '-' + c + ')^-2']);
      case 'letter-power': return rng.pick([a + '^' + b, '-' + a + '^' + b, '(' + a + b + ')^' + c, k + '^' + a]);
      case 'fraction-power': return '(' + (k === 1 ? '' : k) + a + '/(' + b + '+' + (j === 1 ? '' : j) + c + '))^-' + rng.int(1, 3);
      default: return rng.pick([k + a + '^2' + b, a + b + '^2', a + '^2-' + k + c, k + a + '-' + b + '^2', a + b + '-' + b + c]);
    }
  }
  // A good question: small numbers all the way, a short answer, not 0.
  function fits(r, form) {
    if (r.biggest > 1000 || Math.abs(r.value.n) > 200 || r.value.d > 200 || r.value.n === 0) return false;
    if (form === 'fraction-power' && r.steps.length < 3) return false;
    return true;
  }

  G.register({
    name: 'algebra.substitution',
    topic: 'Substitution',
    title: 'Evaluate expressions for given values',
    prompt: 'Evaluate each expression for the given values',
    whole: true,
    columns: 1,
    workSpace: 1.5,
    params: [
      { key: 'forms', label: 'Expressions', type: 'set', default: ['negative-power', 'sum-power', 'letter-power', 'fraction-power'], values: FORMS },
      { key: 'count', label: 'How many expressions', type: 'number', min: 1, max: 8, default: 4 },
      { key: 'size', label: 'Largest value of a letter (size)', type: 'number', min: 2, max: 9, default: 4 },
      { key: 'negatives', label: 'Negative values', type: 'toggle', default: true }
    ],
    variables: [
      { key: 'a', label: 'a', kind: 'int', min: -99, max: 99 },
      { key: 'b', label: 'b', kind: 'int', min: -99, max: 99 },
      { key: 'c', label: 'c', kind: 'int', min: -99, max: 99 },
      { key: 'expressions', label: 'Expressions (like (2a/(b+c))^-3 or -a^-1)', kind: 'list', of: { kind: 'text', maxLength: 60 }, minLength: 1, maxLength: 10 }
    ],
    checkVars: function (v) {
      var errs = [];
      v.expressions.forEach(function (src, i) {
        try {
          var bad = lettersIn(parse(src)).filter(function (l) { return LETTERS.indexOf(l) < 0; });
          if (bad.length) throw new Error('uses ' + bad.join(', ') + ': only a, b and c have values');
          work(src, v);
        } catch (e) { errs.push('Expression ' + (i + 1) + ' (' + src + ') ' + e.message + '.'); }
      });
      return errs;
    },
    pick: function (p, rng) {
      var forms = FORMS.map(function (f) { return f.value; }).filter(function (f) { return p.forms.indexOf(f) >= 0; });
      for (var t = 0; ; t++) {
        // Different values, not 0 or ±1, some negative (when allowed) and some positive.
        var vals = [];
        while (vals.length < 3) {
          var x = rng.int(2, p.size) * (p.negatives && rng.chance(0.5) ? -1 : 1);
          if (vals.indexOf(x) < 0 && vals.indexOf(-x) < 0) vals.push(x);
        }
        if (p.negatives && vals.every(function (x) { return x < 0; })) vals[1] = -vals[1];
        if (p.negatives && vals.every(function (x) { return x > 0; })) vals[0] = -vals[0];
        var v = { a: vals[0], b: vals[1], c: vals[2] };
        var exprs = [], ok = true;
        for (var i = 0; i < p.count && ok; i++) {
          var form = forms[Math.floor(i * forms.length / p.count)], found = null;
          for (var k = 0; k < 60 && !found; k++) {
            var src = formText(form, rng);
            if (exprs.indexOf(src) >= 0) continue;
            try { if (fits(work(src, v), form)) found = src; } catch (e) { /* try another */ }
          }
          if (found) exprs.push(found); else ok = false;
        }
        if (ok || t > 30) { v.expressions = ok ? exprs : exprs.concat(['-a^2']).slice(0, Math.max(1, exprs.length)); return v; }
      }
    },
    render: function (v) {
      var given = LETTERS.map(function (l) { return l + '=' + num(v[l]); }).join(',\\ ');
      var parts = v.expressions.map(function (src) {
        var r = work(src, v);
        return { prompt: '$' + r.prompt + ' =$', answer: '$' + r.answer + '$', steps: r.steps };
      });
      return { prompt: 'Evaluate each expression for $' + given + '$', answer: '', steps: [], parts: parts, slots: { values: '$' + given + '$' } };
    }
  });

  root.Mathwise.substitution = { parse: parse, work: work, show: show };
})(typeof window !== 'undefined' ? window : this);
