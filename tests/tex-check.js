// Numeric checker for the small LaTeX subset used in powers / scientific notation
// questions. It evaluates a prompt, each worked step and the answer, and reports
// any that disagree. Used by check-generators.js on generated and hand-made quizzes.
//
// Reading conventions match the paper quizzes: implicit products bind tighter
// than \times and \div, so 12t^4\div3t^{-3} means (12t^4)/(3t^{-3}).
'use strict';

function tokenize(src) {
  const s = src.replace(/\\left|\\right|\\,|\\ |\\!/g, '').replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    let m;
    if ((m = /^\d+(\.\d+)?/.exec(s.slice(i)))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = /^\\(dfrac|frac|times|div|cdot)/.exec(s.slice(i)))) { out.push({ t: m[1] === 'dfrac' ? 'frac' : m[1] }); i += m[0].length; continue; }
    if (/[a-zA-Z]/.test(c)) { out.push({ t: 'var', v: c }); i++; continue; }
    if ('+-^(){}'.includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error('Cannot read "' + s.slice(i) + '" in ' + src);
  }
  return out;
}

function evaluate(src, vars) {
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p] && tk[p].t;
  const eat = (t) => { if (peek() !== t) throw new Error('Expected ' + t + ' in ' + src); return tk[p++]; };
  function group() {
    if (peek() === '{') { p++; const v = expr(); eat('}'); return v; }
    const k = tk[p++];
    if (k.t === 'num') return parseFloat(String(k.v)[0]);   // x^23 is not valid TeX, ^2 then 3
    if (k.t === 'var') return lookup(k.v);
    throw new Error('Bad group in ' + src);
  }
  function lookup(v) {
    if (!(v in vars)) throw new Error('Unknown variable ' + v);
    return vars[v];
  }
  function primary() {
    const k = peek();
    if (k === 'num') {
      const v = tk[p++].v;
      if (peek() === 'frac') { p++; const a = group(), b = group(); return v + a / b; }   // mixed number 25\frac15
      return v;
    }
    if (k === 'var') return lookup(tk[p++].v);
    if (k === '(') { p++; const v = expr(); eat(')'); return v; }
    if (k === '{') { p++; const v = expr(); eat('}'); return v; }
    if (k === 'frac') { p++; const a = group(), b = group(); return a / b; }
    throw new Error('Unexpected ' + k + ' in ' + src);
  }
  function power() {
    let b = primary();
    while (peek() === '^') { p++; b = Math.pow(b, group()); }
    return b;
  }
  function product() {
    let v = power();
    while (['num', 'var', '(', 'frac'].includes(peek())) v *= power();
    return v;
  }
  function signed() {
    if (peek() === '-') { p++; return -signed(); }
    if (peek() === '+') { p++; return signed(); }
    return product();
  }
  function term() {
    let v = signed();
    for (;;) {
      if (peek() === 'times' || peek() === 'cdot') { p++; v *= signed(); }
      else if (peek() === 'div') { p++; v /= signed(); }
      else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (peek() === '+') { p++; v += term(); }
      else if (peek() === '-') { p++; v -= term(); }
      else return v;
    }
  }
  const v = expr();
  if (p !== tk.length) throw new Error('Unread input in ' + src);
  return v;
}

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const only = (s) => { const m = /^\$([^$]*)\$$/.exec(s.trim()); return m ? m[1] : null; };
const VARS = {};
'abcdkmnprtwyz'.split('').forEach((c, i) => { VARS[c] = 1.13 + 0.17 * i; });

// Check one item { prompt, answer, solution }. Returns a list of problems ([] = fine,
// null = not something this checker understands).
function checkItem(it, given) {
  const V = Object.assign({}, VARS, given || {});
  const prompt = only(it.prompt || '');
  const ans = only(it.answer || '');
  if (prompt == null || ans == null) return null;
  const steps = (it.solution || '').split('\n').filter(Boolean);
  const problems = [];
  try {
    if (/=\s*$/.test(prompt)) {
      // Expression: prompt, every "= …" step and every answer form must agree.
      const want = evaluate(prompt.replace(/=\s*$/, ''), Object.assign({ x: 1.07 }, V));
      const answers = ans.split('\\text{ or }');
      answers.forEach((a) => {
        const got = evaluate(a, Object.assign({ x: 1.07 }, V));
        if (!close(got, want)) problems.push('answer ' + a + ' = ' + got + ', expected ' + want);
      });
      steps.forEach((s) => {
        const m = only(s);
        if (m == null) return;
        m.split('=').slice(1).forEach((part) => {
          const got = evaluate(part, Object.assign({ x: 1.07 }, V));
          if (!close(got, want)) problems.push('step ' + s + ' = ' + got + ', expected ' + want);
        });
      });
      return problems;
    }
    // Equation in x or n: put each answer value in and both sides must agree.
    const am = /^([xn])=(\\pm)?(.*)$/.exec(ans);
    if (!am) return null;
    const base = evaluate(am[3], {});
    const values = am[2] ? [base, -base] : [base];
    values.forEach((val) => {
      const vars = Object.assign({}, V, { [am[1]]: val });
      const sides = prompt.split('=');
      const l = evaluate(sides[0], vars), r = evaluate(sides[1], vars);
      if (!close(l, r)) problems.push(am[1] + '=' + val + ' does not solve ' + prompt + ' (' + l + ' vs ' + r + ')');
      steps.forEach((s) => {
        s.split(/\$/).filter((_, i) => i % 2 === 1).forEach((eq) => {
          const sd = eq.split('=');
          if (sd.length < 2) return;
          const vals = sd.map((x) => evaluate(x, vars));
          if (!vals.every((x) => close(x, vals[0]))) problems.push('step ' + eq + ' is false for ' + am[1] + '=' + val);
        });
      });
    });
    return problems;
  } catch (e) {
    return ['could not read: ' + e.message];
  }
}

// Factoring (prompt is a polynomial, answer its factored form): the answer and
// every "$= …$" step must equal the prompt for several values of the variables.
function checkFactoring(it) {
  const prompt = only(it.prompt || '');
  const ans = only(it.answer || '');
  if (prompt == null || ans == null || /=/.test(prompt) || /=/.test(ans)) return null;
  const problems = [];
  const steps = (it.solution || '').split('\n').map((s) => /^\$=(.*)\$$/.exec(s.trim())).filter(Boolean).map((m) => m[1]);
  try {
    [0.37, -1.21, 2.3, -0.8].forEach((xv, i) => {
      const V = {};
      'abkmnptwxyz'.split('').forEach((c, j) => { V[c] = xv + 0.11 * j * (i % 2 ? -1 : 1); });
      const want = evaluate(prompt, V);
      const got = evaluate(ans, V);
      if (!close(got, want)) problems.push('answer ' + ans + ' = ' + got + ', expected ' + want);
      steps.forEach((s) => {
        const g = evaluate(s, V);
        if (!close(g, want)) problems.push('step = ' + s + ' gives ' + g + ', expected ' + want);
      });
    });
  } catch (e) {
    return ['could not read: ' + e.message];
  }
  return problems;
}

module.exports = { evaluate, checkItem, checkFactoring };
