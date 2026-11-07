/*
 * Story library: our solar system (Math 9 scientific notation), on real data from
 * data/planets.js. The planet varies; its facts never change. See stories-rates.js
 * for the format.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var S = D.stories = D.stories || [];
  var REASONABLE = ' Any answer backed up by a reasonable argument is good enough.';

  S.push({
    topic: 'sci', id: 'planet-distance', label: 'How far is a planet from the Sun? (NASA data)',
    source: 'planets',
    values: { planet: { fact: 'planets', label: 'Planet' } },
    ok: function (v) { return v.planet !== 'Earth'; },
    okMessage: 'Choose a planet other than Earth (part b compares it with Earth).',
    stem: 'The mean (average) distance from the Sun to %planet% is about %standard% km. The mean distance from the Sun to Earth is about %earth% km.',
    given: function (v, D, F) {
      var d = F.fact('planets', v.planet).distance, e = F.fact('planets', 'Earth').distance;
      return { standard: F.standard(d), earth: F.sci(e) };
    },
    parts: [
      { prompt: 'Write the distance from the Sun to %planet% in scientific notation.',
        solve: function (v, F) {
          var d = F.fact('planets', v.planet).distance;
          return { steps: ['The decimal point moves ' + d.exponent + ' places left, so the exponent is $' + d.exponent + '$'], answer: '$' + F.sci(d) + '$ km' };
        } },
      { prompt: 'How many times as far from the Sun as Earth is %planet%? Round sensibly.',
        solve: function (v, F) {
          var d = F.fact('planets', v.planet).distance, e = F.fact('planets', 'Earth').distance;
          return F.divide(d, e, function (x) { return { answer: 'About $' + x + '$ times as far' }; });
        } },
      { prompt: 'The distances are averages. Why does the distance from %planet% to the Sun change?',
        think: 'Orbits are not perfect circles (they are ellipses), so a planet is sometimes closer to the Sun and sometimes farther.' + REASONABLE },
      { prompt: 'Why do scientists use scientific notation for distances like these?',
        think: 'The numbers are huge, with many zeros: scientific notation is shorter, easier to compare, and harder to miscount.' + REASONABLE }
    ]
  });

  S.push({
    topic: 'sci', id: 'light-travel', label: 'How long does sunlight take to reach a planet? (NASA data)',
    source: 'planets',
    values: { planet: { fact: 'planets', label: 'Planet' } },
    stem: 'Light travels about %c% km per second. The mean distance from the Sun to %planet% is about %d% km.',
    given: function (v, D, F) { return { c: F.sci(D.lightSpeed), d: F.sci(F.fact('planets', v.planet).distance) }; },
    parts: [
      { prompt: 'How many seconds does sunlight take to reach %planet%? Use scientific notation.',
        solve: function (v, F, D) {
          return F.divide(F.fact('planets', v.planet).distance, D.lightSpeed, function (x, sci) { return { answer: 'About $' + sci + '$ seconds' }; }, true);
        } },
      { prompt: 'About how many minutes is that?',
        solve: function (v, F, D) {
          var s = F.value(F.fact('planets', v.planet).distance) / F.value(D.lightSpeed);
          var m = s / 60, mt = m >= 100 ? String(Math.round(m)) : String(Math.round(m * 10) / 10);
          return { steps: ['$' + F.round3(s).tex + '\\div60\\approx ' + F.num(Number(mt)) + '$'], answer: 'About $' + F.num(Number(mt)) + '$ minutes' };
        } },
      { prompt: 'When you look at the Sun from %planet%, are you seeing the Sun as it is right now? Explain.',
        think: 'No: the light we see left the Sun a while ago (the travel time), so we see the Sun as it was then.' + REASONABLE },
      { prompt: 'Radio signals also travel at the speed of light. Why would a live conversation with a rover on %planet% be difficult?',
        think: 'Each message takes the travel time to arrive and the same again for the reply, so there are long pauses.' + REASONABLE }
    ]
  });
})(typeof window !== 'undefined' ? window : this);
