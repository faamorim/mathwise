/*
 * Library of rate scenarios for written questions (Math 8 rates).
 * Each scenario is plain text with %placeholders%:
 *   %name% (a first name), %n% (amount), %t% (minutes), %total% (amount in one hour).
 * thinking: follow-up questions that ask students to reason, not compute, each with
 * possible answers for the teacher key. Add scenarios or follow-ups freely: the
 * generator picks them up. Keep the wording free of he/she (repeat the name instead).
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  D.rateScenarios = [
    {
      id: 'swim', label: 'Swimming laps', unit: 'laps', n: [2, 6],
      text: '%name% takes %t% minutes to swim %n% laps in the pool. At this rate, how many laps can %name% swim in one hour?',
      thinking: [
        { prompt: 'Give a reason why %name%\'s rate could change during the hour.',
          answer: '%name% gets tired and slows down, stops to rest, the pool gets crowded, or swims faster after warming up. Any reasonable reason.' },
        { prompt: 'Would %name% really swim %total% laps in one hour? Explain your thinking.',
          answer: 'Probably fewer: few people keep the same speed for a whole hour. A strong swimmer who paces well might come close.' }
      ]
    },
    {
      id: 'read', label: 'Reading pages', unit: 'pages', n: [3, 12],
      text: '%name% reads %n% pages in %t% minutes. At this rate, how many pages can %name% read in one hour?',
      thinking: [
        { prompt: 'Give a reason why %name% might not read at the same rate for the whole hour.',
          answer: 'Harder chapters, pages with more or less text, pictures, distractions, getting tired or getting into the story. Any reasonable reason.' },
        { prompt: 'Is the number of pages a good way to measure reading speed? What could be better?',
          answer: 'Pages differ in size and text; words per minute is fairer. Any reasonable comparison.' }
      ]
    },
    {
      id: 'hose', label: 'Filling with a hose', unit: 'litres', n: [8, 30],
      text: 'A garden hose fills a tank with %n% litres of water in %t% minutes. At this rate, how many litres does it fill in one hour?',
      thinking: [
        { prompt: 'Give a reason why the hose might not keep the same rate for the whole hour.',
          answer: 'Water pressure changes, the hose gets kinked, someone else uses water in the house, or the tank overflows. Any reasonable reason.' },
        { prompt: 'The tank holds 500 litres. Does your answer make sense? What would really happen?',
          answer: 'Compare %total% with 500: if it is more, the tank overflows before the hour ends, so the hose fills at most 500 litres.' }
      ]
    },
    {
      id: 'heart', label: 'Heartbeats', unit: 'beats', n: [70, 90],
      text: '%name% counts %n% heartbeats in %t% minutes while sitting in class. At this rate, how many times does %name%\'s heart beat in one hour?',
      thinking: [
        { prompt: 'Would %name%\'s heart beat at the same rate for the whole hour? When might it change?',
          answer: 'It speeds up with exercise, excitement or stress, and slows down when resting or sleeping.' },
        { prompt: 'Why is it better to count heartbeats for a few minutes than for 10 seconds?',
          answer: 'A longer count averages out small changes and counting mistakes, so the rate is more reliable.' }
      ]
    },
    {
      id: 'type', label: 'Typing words', unit: 'words', n: [40, 120],
      text: '%name% types %n% words in %t% minutes. At this rate, how many words can %name% type in one hour?',
      thinking: [
        { prompt: 'Give a reason why %name%\'s typing rate could change.',
          answer: 'Tired fingers, stopping to think or fix mistakes, harder words, or getting faster with practice. Any reasonable reason.' }
      ]
    }
  ];
  D.names = ['Bobby', 'Amira', 'Jun', 'Priya', 'Mateo', 'Leah', 'Kofi', 'Sofia', 'Liam', 'Mei', 'Noah', 'Zara', 'Tariq', 'Ana'];
})(typeof window !== 'undefined' ? window : this);
