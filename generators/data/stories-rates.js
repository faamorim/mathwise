/*
 * Story library: rates (Math 8). Content only; generators/stories.js turns each
 * story into a question template named "<topic>.<id>".
 *
 * A story has:
 *   values  every number or name in it, marked as one of
 *             { name: true }                      a first name from Mathwise.data.names
 *           any value may have label: 'Minutes' (shown when a teacher edits the question)
 *             { vary: [lo, hi], step? }           a whole number that changes each time
 *             { choose: [..] }                    one of these numbers each time
 *             { fact: 'planets' }                 which fact (row of a data table); facts never change
 *   ok      (v) -> true when the values make a good question (otherwise picked again);
 *           okMessage explains the rule to a teacher typing their own values
 *   given   (v, D, F) -> extra values for %placeholders%, as LaTeX (written as math)
 *   stem    the story, with %placeholders% for values and givens
 *   parts   a), b), ... each either
 *             { prompt, solve: (v, F) -> { steps: [..], answer } }   calculation (F: helpers)
 *             { prompt, think: 'possible answers' }                   thinking: no single right answer
 *
 * Rule: a part may use the givens, never a result from an earlier part
 * (tests/check-generators.js fails if a later part shows an earlier answer).
 * Write names, never he/she.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  D.names = ['Anna', 'Melissa', 'Bobby', 'Amira', 'Jun', 'Priya', 'Mateo', 'Leah', 'Kofi', 'Sofia', 'Liam', 'Mei', 'Noah', 'Zara', 'Tariq', 'Ana'];
  var S = D.stories = D.stories || [];
  var REASONABLE = ' Any answer backed up by a reasonable argument is good enough.';

  S.push({
    topic: 'rates', id: 'typing-race', label: 'Two people typing (seconds vs minutes)',
    values: {
      a: { name: true, label: 'First person' }, b: { name: true, label: 'Second person' },
      wordsA: { vary: [10, 20], label: 'Words (first person)' }, secsA: { choose: [15, 20, 30], label: 'Seconds (first person)' },
      wordsB: { vary: [60, 150], step: 5, label: 'Words (second person)' }, minsB: { choose: [2, 3, 4, 5], label: 'Minutes (second person)' }
    },
    ok: function (v) { return v.a !== v.b && v.wordsA * 60 % v.secsA === 0 && v.wordsB % v.minsB === 0 && v.wordsA * 60 / v.secsA !== v.wordsB / v.minsB; },
    okMessage: 'Use two different names, seconds that divide 60, words for the second person that divide evenly by the minutes, and different speeds.',
    stem: '%a% types %wordsA% words in %secsA% seconds. %b% types %wordsB% words in %minsB% minutes.',
    parts: [
      { prompt: 'Who types faster?',
        solve: function (v, F) {
          var k = 60 / v.secsA, ra = v.wordsA * k, rb = v.wordsB / v.minsB;
          return {
            steps: [
              'Compare words per minute',
              v.a + ': one minute is $60\\div' + v.secsA + '=' + k + '$ times as long, so $' + v.wordsA + '\\times' + k + '=' + ra + '$ words per minute',
              v.b + ': $' + v.wordsB + '\\div' + v.minsB + '=' + rb + '$ words per minute'
            ],
            answer: (ra > rb ? v.a : v.b) + ' ($' + Math.max(ra, rb) + '$ words per minute, compared with $' + Math.min(ra, rb) + '$)'
          };
        } },
      { prompt: 'What could be some reasons for the difference in typing speed?',
        think: 'Practice and skill, the keyboard, how long or hard the words are, typing a short burst versus a long text, copying versus making up the text.' + REASONABLE },
      { prompt: 'In one hour, what would be the difference between the number of words they type?',
        solve: function (v, F) {
          var ra = v.wordsA * 60 / v.secsA, rb = v.wordsB / v.minsB;
          var ha = ra * 60, hb = rb * 60;
          return {
            steps: [
              v.a + ': $' + ra + '\\times60=' + F.num(ha) + '$ words',
              v.b + ': $' + rb + '\\times60=' + F.num(hb) + '$ words',
              '$' + F.num(Math.max(ha, hb)) + '-' + F.num(Math.min(ha, hb)) + '=' + F.num(Math.abs(ha - hb)) + '$'
            ],
            answer: '$' + F.num(Math.abs(ha - hb)) + '$ words'
          };
        } },
      { prompt: 'Why could the number of words they really type in one hour be different from the calculated number?',
        think: 'They get tired, take breaks, or speed up with practice; the words may be longer or harder than the ones measured; a short test does not show a whole hour.' + REASONABLE }
    ]
  });

  S.push({
    topic: 'rates', id: 'swim-laps', label: 'Swimming laps',
    values: { name: { name: true }, laps: { vary: [2, 6], label: 'Laps' }, mins: { choose: [2, 3, 4, 5, 6], label: 'Minutes' }, times: { vary: [3, 6], label: 'Part c: how many times as many laps' } },
    ok: function (v) { return 60 % v.mins === 0; },
    okMessage: 'The minutes must divide 60 evenly.',
    stem: '%name% takes %mins% minutes to swim %laps% laps in the pool.',
    given: function (v) { return { target: v.laps * v.times }; },
    parts: [
      { prompt: 'At this rate, how many laps can %name% swim in one hour?',
        solve: function (v, F) {
          var k = 60 / v.mins;
          return {
            steps: ['One hour is $60$ minutes: $60\\div' + v.mins + '=' + k + '$ groups of $' + v.mins + '$ minutes', '$' + k + '\\times' + v.laps + '=' + k * v.laps + '$'],
            answer: '$' + k * v.laps + '$ laps'
          };
        } },
      { prompt: 'Give a reason why %name%\'s rate could change during the hour.',
        think: '%name% gets tired, stops to rest, the pool gets crowded, or %name% speeds up after warming up.' + REASONABLE },
      { prompt: 'At the same rate, how long would %name% take to swim %target% laps?',
        solve: function (v) {
          return {
            steps: ['$' + v.laps * v.times + '\\div' + v.laps + '=' + v.times + '$ groups of $' + v.laps + '$ laps', '$' + v.times + '\\times' + v.mins + '=' + v.times * v.mins + '$'],
            answer: '$' + v.times * v.mins + '$ minutes'
          };
        } }
    ]
  });

  S.push({
    topic: 'rates', id: 'hose', label: 'Filling a tank with a hose',
    values: { litres: { vary: [8, 30], label: 'Litres' }, mins: { choose: [2, 3, 4, 5, 6, 10], label: 'Minutes' }, times: { vary: [8, 30], label: 'Tank size, in groups of those litres' } },
    ok: function (v) { return 60 % v.mins === 0; },
    okMessage: 'The minutes must divide 60 evenly.',
    stem: 'A garden hose puts %litres% litres of water into a tank every %mins% minutes. The tank holds %capacity% litres.',
    given: function (v, D, F) { return { capacity: F.num(v.litres * v.times) }; },
    parts: [
      { prompt: 'How many litres does the hose put in the tank in one hour?',
        solve: function (v, F) {
          var k = 60 / v.mins;
          return { steps: ['$60\\div' + v.mins + '=' + k + '$', '$' + k + '\\times' + v.litres + '=' + F.num(k * v.litres) + '$'], answer: '$' + F.num(k * v.litres) + '$ litres' };
        } },
      { prompt: 'How long does it take to fill the empty tank?',
        solve: function (v, F) {
          return {
            steps: ['$' + F.num(v.litres * v.times) + '\\div' + v.litres + '=' + v.times + '$ groups of $' + v.mins + '$ minutes', '$' + v.times + '\\times' + v.mins + '=' + v.times * v.mins + '$'],
            answer: '$' + v.times * v.mins + '$ minutes'
          };
        } },
      { prompt: 'Give a reason why filling the tank could really take a different amount of time.',
        think: 'Water pressure changes, the hose kinks, someone else in the house uses water, the tank leaks, or the measurement was rounded.' + REASONABLE }
    ]
  });

  S.push({
    topic: 'rates', id: 'heartbeat', label: 'Heartbeats',
    values: { name: { name: true }, beats: { vary: [20, 26], label: 'Heartbeats' }, secs: { choose: [15, 20], label: 'Seconds' } },
    ok: function (v) { return 60 % v.secs === 0; },
    okMessage: 'The seconds must divide 60 evenly.',
    stem: 'Sitting in class, %name% counts %beats% heartbeats in %secs% seconds.',
    parts: [
      { prompt: 'What is %name%\'s heart rate in beats per minute?',
        solve: function (v) {
          var k = 60 / v.secs;
          return { steps: ['$60\\div' + v.secs + '=' + k + '$', '$' + k + '\\times' + v.beats + '=' + k * v.beats + '$'], answer: '$' + k * v.beats + '$ beats per minute' };
        } },
      { prompt: 'How many times would %name%\'s heart beat in one hour at this rate?',
        solve: function (v, F) {
          var bpm = 60 / v.secs * v.beats;
          return { steps: ['$' + bpm + '\\times60=' + F.num(bpm * 60) + '$'], answer: '$' + F.num(bpm * 60) + '$ beats' };
        } },
      { prompt: 'Would %name%\'s heart beat at the same rate for a whole hour? When might it change?',
        think: 'No: it speeds up with exercise, excitement or stress, and slows down when resting or sleeping.' + REASONABLE },
      { prompt: 'Why is counting for %secs% seconds better than counting for 5 seconds?',
        think: 'A longer count averages out small changes and counting mistakes (one missed beat in 5 seconds is a big error), so the rate is more reliable.' + REASONABLE }
    ]
  });
})(typeof window !== 'undefined' ? window : this);
