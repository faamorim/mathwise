/*
 * Real data for written questions: the planets of our solar system.
 * Source: NASA Planetary Fact Sheet (metric), nssdc.gsfc.nasa.gov/planetary/factsheet/
 * "Distance from Sun" is the mean distance, in millions of km (10^6 km).
 * Data files hold facts only; generators decide how to ask about them.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  D.planets = {
    source: 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)',
    // distance: mean distance from the Sun in millions of km, as the digits of the
    // number written out (so 149.6 million km is digits "1496", exponent 8).
    items: [
      { name: 'Mercury', distance: { digits: '579', exponent: 7 } },
      { name: 'Venus', distance: { digits: '1082', exponent: 8 } },
      { name: 'Earth', distance: { digits: '1496', exponent: 8 } },
      { name: 'Mars', distance: { digits: '228', exponent: 8 } },
      { name: 'Jupiter', distance: { digits: '7785', exponent: 8 } },
      { name: 'Saturn', distance: { digits: '1432', exponent: 9 } },
      { name: 'Uranus', distance: { digits: '2867', exponent: 9 } },
      { name: 'Neptune', distance: { digits: '4515', exponent: 9 } }
    ]
  };
  // Speed of light in a vacuum: 299 792 km/s (exact by definition of the metre); questions use 3.0 x 10^5.
  D.lightSpeed = { digits: '3', exponent: 5, source: 'SI definition of the metre (299 792.458 km/s), rounded' };
})(typeof window !== 'undefined' ? window : this);
