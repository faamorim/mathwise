/*
 * Shared table: first names, for every story in every grade and unit. Stories write
 * names, never he/she. Rows are only ever added within a release.
 */
(function (root) {
  'use strict';
  var D = (root.Mathwise = root.Mathwise || {}).data = root.Mathwise.data || {};
  var T = D.tables = D.tables || {};
  T.people = {
    rows: ['Anna', 'Melissa', 'Bobby', 'Amira', 'Jun', 'Priya', 'Mateo', 'Leah', 'Kofi', 'Sofia', 'Liam', 'Mei', 'Noah', 'Zara', 'Tariq', 'Ana']
      .map(function (n) { return { name: n }; })
  };
})(typeof window !== 'undefined' ? window : this);
