/*
 * Story library: our solar system (Math 9 scientific notation), on real data from
 * the shared tables (data/planets.js, data/constants.js). The planet varies; its
 * facts never change. See stories-rates.js for the format.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var S = D.stories = D.stories || [];

  function dist(F, planet) { return F.cell('planets', planet, 'meanSunDistance'); }

  S.push({
    topic: 'sci', id: 'planet-distance', label: 'How far is a planet from the Sun? (NASA data)',
    values: { planet: { table: 'planets', needs: ['meanSunDistance'], label: 'Planet' } },
    ok: function (v) { return v.planet !== 'Earth'; },
    okMessage: 'Choose a planet other than Earth (part b compares it with Earth).',
    stem: 'The mean (average) distance from the Sun to %planet% is about %standard% km. The mean distance from the Sun to Earth is about %earth% km.',
    given: function (v, D, F) { return { standard: F.standard(dist(F, v.planet)), earth: F.sci(dist(F, 'Earth')) }; },
    precision: 1,
    precisionLabel: 'Round the comparison to (decimal places)',
    parts: [
      { prompt: 'Write the distance from the Sun to %planet% in scientific notation.',
        solve: function (v, F) {
          var d = dist(F, v.planet);
          return { steps: ['The decimal point moves ' + d.exponent + ' places left, so the exponent is $' + d.exponent + '$'], answer: '$' + F.sci(d) + '$ km' };
        } },
      { prompt: 'How many times as far from the Sun as Earth is %planet%?', round: 'dp',
        solve: function (v, F) {
          var d = dist(F, v.planet), e = dist(F, 'Earth');
          var q = Number(F.mantissa(d.digits)) / Number(F.mantissa(e.digits)), k = d.exponent - e.exponent;
          var x = F.value(d) / F.value(e), t = F.fixed(x, v.precision);
          var steps = [
            '$\\dfrac{' + F.sci(d) + '}{' + F.sci(e) + '}$',
            '$= \\dfrac{' + F.mantissa(d.digits) + '}{' + F.mantissa(e.digits) + '}\\times10^{' + d.exponent + '-' + e.exponent + '}$',
          ];
          var x3 = F.num(Math.round(x * 1000) / 1000);
          if (k !== 0) steps.push('$\\approx ' + (Math.round(q * 1000) / 1000) + '\\times10^{' + k + '}$');
          steps.push('$\\approx ' + x3 + '$');
          if (t !== x3) steps.push('$\\approx ' + t + '$');
          return { steps: steps, answer: 'About $' + t + '$ times as far' };
        } }
    ],
    thinking: {
      'why-change': { prompt: 'The distances are averages. Why does the distance from %planet% to the Sun change?',
        answers: 'Orbits are not perfect circles (they are ellipses), so a planet is sometimes closer to the Sun and sometimes farther.' },
      'why-sci': { prompt: 'Why do scientists use scientific notation for distances like these?',
        answers: 'The numbers are huge, with many zeros: scientific notation is shorter, easier to compare, and harder to miscount.' }
    }
  });

  S.push({
    topic: 'sci', id: 'light-travel', label: 'How long does sunlight take to reach a planet? (NASA data)',
    values: { planet: { table: 'planets', needs: ['meanSunDistance'], label: 'Planet' } },
    stem: 'Light travels about %c% km per second. The mean distance from the Sun to %planet% is about %d% km.',
    given: function (v, D, F) { return { c: F.sci(F.constant('lightSpeed')), d: F.sci(dist(F, v.planet)) }; },
    precision: 3,
    precisionLabel: 'Round the seconds to (significant digits)',
    parts: [
      { prompt: 'How many seconds does sunlight take to reach %planet%? Use scientific notation.', round: 'sig',
        solve: function (v, F) {
          var d = dist(F, v.planet), c = F.constant('lightSpeed'), n = Math.max(1, v.precision);
          var r = F.calc(d, c, 'divide', n);
          return { steps: ['$\\dfrac{' + F.sci(d) + '}{' + F.sci(c) + '}$'].concat(r.steps), answer: (r.approx ? 'About ' : '') + '$' + F.sciPad(r.result, n) + '$ seconds' };
        } },
      { prompt: 'About how many minutes is that?', round: { dp: 1 },
        solve: function (v, F) {
          var s = F.value(dist(F, v.planet)) / F.value(F.constant('lightSpeed'));
          var shown = F.roundSig(F.fromValue(s), 3), m = F.fixed(s / 60, 1);
          return { steps: ['$' + F.sciPad(shown, 3) + '\\div60\\approx ' + m + '$'], answer: 'About $' + m + '$ minutes' };
        } }
    ],
    thinking: {
      'seeing-past': { prompt: 'When you look at the Sun from %planet%, are you seeing the Sun as it is right now? Explain.',
        answers: 'No: the light we see left the Sun a while ago (the travel time), so we see the Sun as it was then.' },
      'rover-delay': { prompt: 'Radio signals also travel at the speed of light. Why would a live conversation with a rover on %planet% be difficult?',
        answers: 'Each message takes the travel time to arrive and the same again for the reply, so there are long pauses.' }
    }
  });
})(typeof window !== 'undefined' ? window : this);
