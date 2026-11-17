/*
 * Story library: fact families (Math 9 scientific notation). Each story is one
 * relation, product = factor × factor (distance = speed × time), kept as separate
 * pieces so the same story can ask for any of the three: give two, ask the third.
 * Asking for the product is a multiplication; asking for either factor is a division.
 * generators/stories.js turns each story into a template "<topic>.<id>" with a
 * "What is asked" setting.
 *
 * A family story has:
 *   family      { product: 'distance', factors: ['speed', 'time'] }
 *   values      names or facts, as in stories-rates.js ({ name: true } or { fact: 'planets' })
 *   intro       optional sentence before the givens
 *   quantities  one piece per quantity:
 *                 name   the word in "time = distance ÷ speed"
 *                 unit   written after the answer
 *                 given  the sentence that gives it (%key% is its value, in scientific notation)
 *                 ask    the question that asks for it
 *               and how its number is chosen, one of
 *                 value: (v, D, F) -> { digits, exponent }   real data (never varies)
 *                 vary: { digits: [1, 2], exponent: [lo, hi] }  significant digits and power of ten
 *                 (neither)   worked out from the other two (rounded to 3 digits); exactly one
 *   then        more parts after the calculation: { prompt, think } thinking parts
 *
 * Rule, as for all stories: a part may use the givens, never an earlier part's result.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var S = D.stories = D.stories || [];
  var REASONABLE = ' Any answer backed up by a reasonable argument is good enough.';

  S.push({
    topic: 'sci', id: 'sunlight', label: 'Sunlight: find the distance, the speed or the time (NASA data)',
    family: { product: 'distance', factors: ['speed', 'time'] },
    values: { planet: { fact: 'planets', label: 'Planet' } },
    quantities: {
      distance: { name: 'distance', unit: 'km', value: function (v, D, F) { return F.fact('planets', v.planet).distance; },
        given: 'The mean distance from the Sun to %planet% is about %distance% km.',
        ask: 'About how far is %planet% from the Sun?' },
      speed: { name: 'speed', unit: 'km per second', value: function (v, D) { return D.lightSpeed; },
        given: 'Light travels about %speed% km every second.',
        ask: 'About how fast does light travel, in km per second?' },
      time: { name: 'time', unit: 'seconds',
        given: 'Sunlight takes about %time% seconds to reach %planet%.',
        ask: 'About how many seconds does sunlight take to reach %planet%?' }
    },
    then: [
      { prompt: 'Why do we say "about" for these numbers?',
        think: 'The distance is an average (orbits are ellipses), the speed of light is rounded, and the answers are rounded too.' + REASONABLE }
    ]
  });

  S.push({
    topic: 'sci', id: 'spacecraft', label: 'A spacecraft trip: find the distance, the speed or the time',
    family: { product: 'distance', factors: ['speed', 'time'] },
    quantities: {
      distance: { name: 'distance', unit: 'km',
        given: 'On its trip, the spacecraft travels about %distance% km.',
        ask: 'How far does the spacecraft travel?' },
      speed: { name: 'speed', unit: 'km per hour', vary: { digits: [1, 2], exponent: [4, 4] },
        given: 'A spacecraft travels at about %speed% km per hour.',
        ask: 'How fast does the spacecraft travel, in km per hour?' },
      time: { name: 'time', unit: 'hours', vary: { digits: [1, 2], exponent: [2, 3] },
        given: 'The trip takes about %time% hours.',
        ask: 'How many hours does the trip take?' }
    },
    then: [
      { prompt: 'Would a real spacecraft travel at the same speed for the whole trip? Explain.',
        think: 'No: it speeds up at launch, can be pulled faster or slowed by gravity (the Sun, planets), and may fire engines to change speed.' + REASONABLE }
    ]
  });

  S.push({
    topic: 'sci', id: 'bacteria-line', label: 'Bacteria in a line: find the length, the number or the size of one',
    family: { product: 'line', factors: ['count', 'each'] },
    intro: 'A scientist imagines bacteria lined up end to end.',
    quantities: {
      line: { name: 'length of the line', unit: 'm',
        given: 'The line is about %line% m long.',
        ask: 'How long is the line?' },
      count: { name: 'number of bacteria', unit: 'bacteria', vary: { digits: [1, 2], exponent: [3, 6] },
        given: 'There are %count% bacteria in the line.',
        ask: 'How many bacteria are in the line?' },
      each: { name: 'length of one', unit: 'm', vary: { digits: [1, 2], exponent: [-6, -6] },
        given: 'One bacterium is about %each% m long.',
        ask: 'About how long is one bacterium?' }
    },
    then: [
      { prompt: 'Could you see one of these bacteria without a microscope? Explain.',
        think: 'No: one bacterium is a few millionths of a metre, far smaller than the smallest thing we can see (about a tenth of a millimetre, $10^{-4}$ m).' + REASONABLE }
    ]
  });

  S.push({
    topic: 'sci', id: 'sand-bucket', label: 'A bucket of sand: find the total mass, the number of grains or the mass of one',
    family: { product: 'total', factors: ['count', 'each'] },
    intro: 'A bucket is full of sand.',
    quantities: {
      total: { name: 'total mass', unit: 'g',
        given: 'All the sand in the bucket has a mass of about %total% g.',
        ask: 'What is the mass of the sand in the bucket?' },
      count: { name: 'number of grains', unit: 'grains', vary: { digits: [1, 2], exponent: [6, 8] },
        given: 'It holds about %count% grains of sand.',
        ask: 'About how many grains of sand are in the bucket?' },
      each: { name: 'mass of one grain', unit: 'g', vary: { digits: [1, 2], exponent: [-5, -4] },
        given: 'One grain of sand has a mass of about %each% g.',
        ask: 'What is the mass of one grain of sand?' }
    },
    then: [
      { prompt: 'Why is the number of grains in the bucket only an estimate?',
        think: 'Nobody counts them: grains have different sizes and masses, and the bucket may not be packed the same way each time.' + REASONABLE }
    ]
  });
})(typeof window !== 'undefined' ? window : this);
