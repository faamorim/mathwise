/*
 * Shared constants, each with its unit and source. A story gives a constant; it never
 * asks for one.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  D.constants = {
    lightSpeed: { digits: '3', exponent: 5, unit: 'km/s', label: 'Speed of light', source: 'SI definition of the metre (299 792.458 km/s), rounded' }
  };
})(typeof window !== 'undefined' ? window : this);
