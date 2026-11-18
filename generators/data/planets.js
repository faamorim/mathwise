/*
 * Shared table: the planets of our solar system. Facts only; stories decide how to ask.
 * A story names the exact column it uses (planets.meanSunDistance). Columns and rows are
 * only ever added within a release, never renamed or removed, so older stories keep
 * working. A row without a value in a column is never picked by a story that needs it.
 * Numbers in scientific notation are { digits, exponent }: 1.496 x 10^8 = '1496', 8.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var T = D.tables = D.tables || {};
  var NASA = 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)';
  T.planets = {
    columns: {
      meanSunDistance: { label: 'Mean distance from the Sun', unit: 'km', source: NASA }
    },
    rows: [
      { name: 'Mercury', meanSunDistance: { digits: '579', exponent: 7 } },
      { name: 'Venus', meanSunDistance: { digits: '1082', exponent: 8 } },
      { name: 'Earth', meanSunDistance: { digits: '1496', exponent: 8 } },
      { name: 'Mars', meanSunDistance: { digits: '228', exponent: 8 } },
      { name: 'Jupiter', meanSunDistance: { digits: '7785', exponent: 8 } },
      { name: 'Saturn', meanSunDistance: { digits: '1432', exponent: 9 } },
      { name: 'Uranus', meanSunDistance: { digits: '2867', exponent: 9 } },
      { name: 'Neptune', meanSunDistance: { digits: '4515', exponent: 9 } }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
