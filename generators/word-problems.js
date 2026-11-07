/*
 * Written questions built on the data library (generators/data/): real facts
 * with sources, and hand-written scenarios. The numbers regenerate like any
 * template; each question can add a thinking follow-up (reasoning, not
 * computing) with possible answers for the key.
 * Needs core.js, sci-notation.js and the data files first.
 */
(function (root) {
  'use strict';
  var G = root.Mathwise.generators;
  var D = root.Mathwise.data;
  var S = root.Mathwise.sci;
  var num = root.Mathwise.math.num;

  // ---------- thinking follow-ups ----------

  var THINKING_PARAM = { key: 'thinking', label: 'Thinking follow-up', type: 'choice', default: 'one',
    values: [{ value: 'none', label: 'None' }, { value: 'one', label: 'One' }, { value: 'all', label: 'All' }] };
  var FOLLOW_VAR = { key: 'followUps', label: 'Thinking follow-ups (numbers from the list)', kind: 'list', of: { kind: 'int', min: 1, max: 9 }, minLength: 0, maxLength: 4 };

  // Which follow-ups to use (1-based). Always uses the rng once, so turning the
  // follow-ups on or off never changes the numbers of later questions.
  function pickFollowUps(v, list, rng) {
    var first = rng.int(1, list.length);
    if (v.thinking === 'none') return [];
    if (v.thinking === 'all') return list.map(function (_, i) { return i + 1; });
    return [first];
  }
  function fill(text, slots) {
    return text.replace(/%([A-Za-z]+)%/g, function (m, k) { return slots[k] != null ? String(slots[k]) : m; });
  }
  // Add the follow-ups to an item: in the prompt and answer (so every page prints
  // them), and as a separate followUps list.
  function withFollowUps(item, list, chosen, slots) {
    var f = chosen.map(function (i) { return list[i - 1]; }).filter(Boolean).map(function (t) {
      return { prompt: fill(t.prompt, slots), answer: fill(t.answer, slots) };
    });
    if (!f.length) return item;
    item.prompt += f.map(function (t) { return '\n\n*Think:* ' + t.prompt; }).join('');
    item.answer += f.map(function (t) { return '\n\n*Possible answers:* ' + t.answer; }).join('');
    item.followUps = f;
    item.workSpace = (item.workSpace || 2) + f.length;
    return item;
  }
  function checkFollowUps(x, list) {
    for (var i = 0; i < x.followUps.length; i++) {
      if (x.followUps[i] > list.length) return ['There are only ' + list.length + ' thinking follow-ups for this question.'];
    }
    return [];
  }

  // ---------- numbers ----------

  function value(d) { return Number(S.mantissa(d.digits)) * Math.pow(10, d.exponent); }
  function sciTex(d) { return S.mantissa(d.digits) + '\\times10^{' + d.exponent + '}'; }
  // x as m x 10^e with a 3-significant-digit m, as LaTeX ("3.02\times10^{1}").
  function round3(x) {
    var e = Math.floor(Math.log10(Math.abs(x)));
    var m = Math.round(x / Math.pow(10, e) * 100) / 100;
    if (m >= 10) { m /= 10; e++; }
    return { m: m, e: e, tex: m.toFixed(2) + '\\times10^{' + e + '}' };
  }
  function plain(x, places) {
    var s = x.toFixed(places);
    if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    return num(Number(s.split('.')[0])) + (s.indexOf('.') >= 0 ? '.' + s.split('.')[1] : '');
  }

  var PLANETS = D.planets.items;
  var PLANET_CHOICES = PLANETS.map(function (p) { return { value: p.name, label: p.name }; });
  function planet(name) { return PLANETS.filter(function (p) { return p.name === name; })[0]; }

  // ---------------------------------------------------------------------
  var DIST_THINK = [
    { prompt: 'The distance given is the *mean* (average) distance. Why does the distance from %planet% to the Sun change?',
      answer: 'Orbits are not perfect circles (they are ellipses), so the planet is sometimes closer to the Sun and sometimes farther.' },
    { prompt: 'Why do scientists write distances in space in scientific notation?',
      answer: 'The numbers are huge, with many zeros: scientific notation is shorter, easier to compare and harder to miscount.' }
  ];

  G.register({
    name: 'sci.planet-distance',
    topic: 'Scientific notation',
    title: 'Planet distances in scientific notation (real data)',
    prompt: 'Solve',
    columns: 1,
    workSpace: 1.5,
    params: [
      { key: 'directions', label: 'Direction', type: 'set', default: ['to-scientific', 'to-standard'],
        values: [{ value: 'to-scientific', label: 'Standard form → scientific notation' }, { value: 'to-standard', label: 'Scientific notation → standard form' }] },
      THINKING_PARAM
    ],
    variables: [
      { key: 'planet', label: 'Planet', kind: 'choice', values: PLANET_CHOICES },
      { key: 'direction', label: 'Direction', kind: 'choice', values: [{ value: 'to-scientific', label: 'To scientific notation' }, { value: 'to-standard', label: 'To standard form' }] },
      FOLLOW_VAR
    ],
    checkVars: function (x) { return checkFollowUps(x, DIST_THINK); },
    pick: function (v, rng, ctx) {
      var direction = ctx.spread('directions', rng);
      var p = rng.pick(PLANETS);
      return { planet: p.name, direction: direction, followUps: pickFollowUps(v, DIST_THINK, rng) };
    },
    render: function (x) {
      var d = planet(x.planet).distance;
      var std = num(Number(S.standard(d.digits, d.exponent)));
      var sci = sciTex(d);
      var item = x.direction === 'to-scientific' ? {
        prompt: 'The mean distance from the Sun to ' + x.planet + ' is about $' + std + '$ km. Write this distance in scientific notation.',
        steps: ['The decimal point moves ' + d.exponent + ' places left, so the exponent is $' + d.exponent + '$'],
        answer: '$' + sci + '$ km'
      } : {
        prompt: 'The mean distance from the Sun to ' + x.planet + ' is about $' + sci + '$ km. Write this distance in standard form.',
        steps: ['Move the decimal point ' + d.exponent + ' places right'],
        answer: '$' + std + '$ km'
      };
      return withFollowUps(item, DIST_THINK, x.followUps, { planet: x.planet });
    }
  });

  // ---------------------------------------------------------------------
  var RATIO_THINK = [
    { prompt: 'In a model where %near% is 1 m from the Sun, how far away would %far% be? Would the model fit in your school?',
      answer: 'About %ratio% m from the "Sun": compare with the size of the school or field.' },
    { prompt: 'Is it reasonable to round your answer? Explain.',
      answer: 'Yes: the distances are averages and already rounded, so a rounded comparison is as precise as the data.' }
  ];

  G.register({
    name: 'sci.planet-ratio',
    topic: 'Scientific notation',
    title: 'How many times farther? Divide planet distances (real data)',
    prompt: 'Solve',
    columns: 1,
    workSpace: 3,
    params: [THINKING_PARAM],
    variables: [
      { key: 'far', label: 'Farther planet', kind: 'choice', values: PLANET_CHOICES },
      { key: 'near', label: 'Nearer planet', kind: 'choice', values: PLANET_CHOICES },
      FOLLOW_VAR
    ],
    checkVars: function (x) {
      if (value(planet(x.far).distance) <= value(planet(x.near).distance)) return ['The farther planet must be farther from the Sun than the nearer one.'];
      return checkFollowUps(x, RATIO_THINK);
    },
    pick: function (v, rng) {
      var i = rng.int(0, PLANETS.length - 2);
      var j = rng.int(i + 1, PLANETS.length - 1);
      return { far: PLANETS[j].name, near: PLANETS[i].name, followUps: pickFollowUps(v, RATIO_THINK, rng) };
    },
    render: function (x) {
      var a = planet(x.far).distance, b = planet(x.near).distance;
      var ma = Number(S.mantissa(a.digits)), mb = Number(S.mantissa(b.digits));
      var q = ma / mb, e = a.exponent - b.exponent;
      var r = round3(q * Math.pow(10, e));
      var whole = value(a) / value(b);
      var about = whole >= 10 ? plain(Math.round(whole), 0) : plain(Math.round(whole * 10) / 10, 1);
      var steps = [
        '$\\dfrac{' + sciTex(a) + '}{' + sciTex(b) + '}$',
        '$= \\dfrac{' + S.mantissa(a.digits) + '}{' + S.mantissa(b.digits) + '}\\times10^{' + a.exponent + '-' + b.exponent + '}$',
        '$\\approx ' + (Math.round(q * 1000) / 1000) + '\\times10^{' + e + '}$'
      ];
      if (r.e !== e) steps.push('$\\approx ' + r.tex + '$');
      steps.push('$\\approx ' + about + '$');
      var item = {
        prompt: 'The mean distance from the Sun to ' + x.far + ' is about $' + sciTex(a) + '$ km, and to ' + x.near + ' about $' + sciTex(b) + '$ km. ' +
          'About how many times farther from the Sun is ' + x.far + ' than ' + x.near + '?',
        steps: steps,
        answer: 'About $' + about + '$ times as far'
      };
      return withFollowUps(item, RATIO_THINK, x.followUps, { far: x.far, near: x.near, ratio: about });
    }
  });

  // ---------------------------------------------------------------------
  var LIGHT_THINK = [
    { prompt: 'When you look at the Sun from %planet%, are you seeing it as it is right now? Explain.',
      answer: 'No: the light left the Sun about %minutes% minutes earlier, so we see the Sun as it was then.' },
    { prompt: 'Radio messages also travel at the speed of light. Why would talking live with a rover on %planet% be hard?',
      answer: 'Each message takes minutes to arrive, so every answer comes back with a long delay.' }
  ];

  G.register({
    name: 'sci.light-time',
    topic: 'Scientific notation',
    title: 'How long does sunlight take to reach a planet? (real data)',
    prompt: 'Solve',
    columns: 1,
    workSpace: 3,
    params: [THINKING_PARAM],
    variables: [
      { key: 'planet', label: 'Planet', kind: 'choice', values: PLANET_CHOICES },
      FOLLOW_VAR
    ],
    checkVars: function (x) { return checkFollowUps(x, LIGHT_THINK); },
    pick: function (v, rng) {
      return { planet: rng.pick(PLANETS).name, followUps: pickFollowUps(v, LIGHT_THINK, rng) };
    },
    render: function (x) {
      var d = planet(x.planet).distance, c = D.lightSpeed;
      var md = Number(S.mantissa(d.digits)), mc = Number(S.mantissa(c.digits));
      var q = md / mc, e = d.exponent - c.exponent;
      var seconds = value(d) / value(c);
      var r = round3(seconds);
      var minutes = seconds / 60;
      var minTex = minutes >= 100 ? plain(Math.round(minutes), 0) : plain(Math.round(minutes * 10) / 10, 1);
      var steps = [
        'time $=\\dfrac{\\text{distance}}{\\text{speed}}$',
        '$= \\dfrac{' + sciTex(d) + '}{' + sciTex(c) + '}$',
        '$= \\dfrac{' + S.mantissa(d.digits) + '}{' + S.mantissa(c.digits) + '}\\times10^{' + d.exponent + '-' + c.exponent + '}$',
        '$\\approx ' + (Math.round(q * 1000) / 1000) + '\\times10^{' + e + '}$ s'
      ];
      if (r.e !== e) steps.push('$\\approx ' + r.tex + '$ s');
      steps.push('$\\approx ' + r.tex + '\\div 60 \\approx ' + minTex + '$ minutes');
      var item = {
        prompt: 'Light travels about $' + sciTex(c) + '$ km per second. The mean distance from the Sun to ' + x.planet +
          ' is about $' + sciTex(d) + '$ km. How long does sunlight take to reach ' + x.planet + '? Give your answer in seconds and in minutes.',
        steps: steps,
        answer: 'About $' + r.tex + '$ s, or about $' + minTex + '$ minutes'
      };
      return withFollowUps(item, LIGHT_THINK, x.followUps, { planet: x.planet, minutes: minTex });
    }
  });

  // ---------------------------------------------------------------------
  // Rates (Math 8): a scenario from the library, numbers that make one hour work out.
  var SCEN = D.rateScenarios;
  function scenario(id) { return SCEN.filter(function (s) { return s.id === id; })[0]; }
  var MINUTES = [2, 3, 4, 5, 6, 10, 12, 15, 20];

  G.register({
    name: 'rates.per-hour',
    topic: 'Rates',
    title: 'Rate problems: how much in one hour? (scenario library)',
    prompt: 'Solve',
    columns: 1,
    workSpace: 2,
    params: [
      { key: 'scenarios', label: 'Scenarios', type: 'set', default: SCEN.map(function (s) { return s.id; }),
        values: SCEN.map(function (s) { return { value: s.id, label: s.label }; }) },
      THINKING_PARAM
    ],
    variables: [
      { key: 'scenario', label: 'Scenario', kind: 'choice', values: SCEN.map(function (s) { return { value: s.id, label: s.label }; }) },
      { key: 'name', label: 'Name', kind: 'choice', values: D.names.map(function (n) { return { value: n, label: n }; }) },
      { key: 'n', label: 'Amount', kind: 'int', min: 1, max: 1000 },
      { key: 't', label: 'Minutes', kind: 'int', min: 1, max: 60 },
      FOLLOW_VAR
    ],
    checkVars: function (x) {
      if (60 % x.t !== 0) return ['Choose minutes that divide 60 evenly (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 or 60).'];
      return checkFollowUps(x, scenario(x.scenario).thinking);
    },
    pick: function (v, rng, ctx) {
      var s = scenario(ctx.spread('scenarios', rng));
      var name = rng.pick(D.names);
      var t = rng.pick(MINUTES);
      var n = rng.int(s.n[0], s.n[1]);
      return { scenario: s.id, name: name, n: n, t: t, followUps: pickFollowUps(v, s.thinking, rng) };
    },
    render: function (x) {
      var s = scenario(x.scenario), k = 60 / x.t, total = k * x.n;
      var slots = { name: x.name, n: x.n, t: x.t, total: num(total) };
      var steps = [
        'One hour is $60$ minutes: $60\\div' + x.t + '=' + k + '$ groups of $' + x.t + '$ minutes',
        '$' + k + '\\times' + x.n + '=' + num(total) + '$ ' + s.unit
      ];
      var item = { prompt: fill(s.text, slots), steps: steps, answer: '$' + num(total) + '$ ' + s.unit };
      return withFollowUps(item, s.thinking, x.followUps, slots);
    }
  });
})(typeof window !== 'undefined' ? window : this);
