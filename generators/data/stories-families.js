/*
 * Story library: relation stories (Math 9 scientific notation). Each story is one
 * relation, product = factor × factor (distance = speed × time), kept as separate
 * pieces so the same story can ask for any of them: give two, ask the third.
 * Asking for the product is a multiplication; asking for either factor is a division.
 * generators/stories.js turns each story into a template "<topic>.<id>" with a
 * "What is asked" setting.
 *
 * A relation story has:
 *   relation   { product: 'distance', factors: ['speed', 'time'] }
 *   values     names or table rows, as in stories-rates.js ({ table: 'people' },
 *              { table: 'planets', needs: ['meanSunDistance'] })
 *   intro      optional sentence before the givens
 *   pieces     one per quantity:
 *                name      the word in "time = distance ÷ speed"
 *                unit      written after the answer
 *                given     the sentence that gives it (%key% is its value, in scientific
 *                          notation), or a list of wordings (the seed picks one)
 *                question  the question that asks for it, or a list of wordings; a piece
 *                          without one is never asked (constants)
 *              and where its number comes from, one of
 *                from: 'planet.meanSunDistance'   that column of the row chosen for value "planet"
 *                from: 'constants.lightSpeed'     a shared constant (data/constants.js)
 *                vary: { digits: [1, 2], exponent: [lo, hi] }   significant digits and power of ten
 *                (neither)   worked out from the other two (rounded to 3 digits); exactly one
 *   precision  default significant digits for the answer (3 when left out)
 *   thinking   { id: { prompt, answers } }, as in stories-rates.js
 *
 * Rule, as for all stories: a part may use the givens, never an earlier part's result.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var S = D.stories = D.stories || [];

  S.push({
    topic: 'sci', id: 'sunlight', label: 'Sunlight: find the distance or the time (NASA data)',
    relation: { product: 'distance', factors: ['speed', 'time'] },
    values: { planet: { table: 'planets', needs: ['meanSunDistance'], label: 'Planet' } },
    pieces: {
      distance: { name: 'distance', unit: 'km', from: 'planet.meanSunDistance',
        given: ['The mean distance from the Sun to %planet% is about %distance% km.',
          'On average, %planet% is about %distance% km from the Sun.'],
        question: ['About how far is %planet% from the Sun?', 'What is the mean distance from the Sun to %planet%, in km?'] },
      speed: { name: 'speed', unit: 'km per second', from: 'constants.lightSpeed',
        given: ['Light travels about %speed% km every second.', 'The speed of light is about %speed% km per second.'] },
      time: { name: 'time', unit: 'seconds',
        given: 'Sunlight takes about %time% seconds to reach %planet%.',
        question: ['About how many seconds does sunlight take to reach %planet%?', 'How long, in seconds, does light from the Sun take to reach %planet%?'] }
    },
    thinking: {
      about: { prompt: 'Why do we say "about" for these numbers?',
        answers: 'The distance is an average (orbits are ellipses), the speed of light is rounded, and the answers are rounded too.' },
      'seeing-past': { prompt: 'When you look at the Sun from %planet%, are you seeing the Sun as it is right now? Explain.',
        answers: 'No: the light left the Sun a while ago (the travel time), so you see the Sun as it was then.' }
    }
  });

  S.push({
    topic: 'sci', id: 'spacecraft', label: 'A spacecraft trip: find the distance, the speed or the time',
    relation: { product: 'distance', factors: ['speed', 'time'] },
    pieces: {
      distance: { name: 'distance', unit: 'km',
        given: 'On its trip, the spacecraft travels about %distance% km.',
        question: 'How far does the spacecraft travel?' },
      speed: { name: 'speed', unit: 'km per hour', vary: { digits: [1, 2], exponent: [4, 4] },
        given: 'A spacecraft travels at about %speed% km per hour.',
        question: 'How fast does the spacecraft travel, in km per hour?' },
      time: { name: 'time', unit: 'hours', vary: { digits: [1, 2], exponent: [2, 3] },
        given: 'The trip takes about %time% hours.',
        question: 'How many hours does the trip take?' }
    },
    thinking: {
      'same-speed': { prompt: 'Would a real spacecraft travel at the same speed for the whole trip? Explain.',
        answers: 'No: it speeds up at launch, can be pulled faster or slowed by gravity (the Sun, planets), and may fire engines to change speed.' }
    }
  });

  S.push({
    topic: 'sci', id: 'bacteria-line', label: 'Bacteria in a line: find the length, the number or the size of one',
    relation: { product: 'line', factors: ['count', 'each'] },
    intro: 'A scientist imagines bacteria lined up end to end.',
    pieces: {
      line: { name: 'length of the line', unit: 'm',
        given: 'The line is about %line% m long.',
        question: 'How long is the line?' },
      count: { name: 'number of bacteria', unit: 'bacteria', vary: { digits: [1, 2], exponent: [3, 6] },
        given: 'There are %count% bacteria in the line.',
        question: 'How many bacteria are in the line?' },
      each: { name: 'length of one', unit: 'm', vary: { digits: [1, 2], exponent: [-6, -6] },
        given: 'One bacterium is about %each% m long.',
        question: 'About how long is one bacterium?' }
    },
    thinking: {
      'see-one': { prompt: 'Could you see one of these bacteria without a microscope? Explain.',
        answers: 'No: one bacterium is a few millionths of a metre, far smaller than the smallest thing we can see (about a tenth of a millimetre, $10^{-4}$ m).' }
    }
  });

  S.push({
    topic: 'sci', id: 'sand-bucket', label: 'A bucket of sand: find the total mass, the number of grains or the mass of one',
    relation: { product: 'total', factors: ['count', 'each'] },
    intro: 'A bucket is full of sand.',
    pieces: {
      total: { name: 'total mass', unit: 'g',
        given: 'All the sand in the bucket has a mass of about %total% g.',
        question: 'What is the mass of the sand in the bucket?' },
      count: { name: 'number of grains', unit: 'grains', vary: { digits: [1, 2], exponent: [6, 8] },
        given: 'It holds about %count% grains of sand.',
        question: 'About how many grains of sand are in the bucket?' },
      each: { name: 'mass of one grain', unit: 'g', vary: { digits: [1, 2], exponent: [-5, -4] },
        given: 'One grain of sand has a mass of about %each% g.',
        question: 'What is the mass of one grain of sand?' }
    },
    thinking: {
      estimate: { prompt: 'Why is the number of grains in the bucket only an estimate?',
        answers: 'Nobody counts them: grains have different sizes and masses, and the bucket may not be packed the same way each time.' }
    }
  });
})(typeof window !== 'undefined' ? window : this);
