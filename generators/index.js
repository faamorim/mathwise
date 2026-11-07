/*
 * The one list of generator files. Pages and node tools load THIS file only,
 * so adding a generator never means editing the editor (or any other page).
 *
 * To add a generator file: put it in this folder and add its name below
 * (after core.js). See docs/generator-api.md for what a generator must provide.
 *
 * In a page: <script src="../generators/index.js"></script>, before any script
 * that uses Mathwise.generators. The files below are written into the page right
 * after this script, so they run in order before the next script tag (this also
 * works when the page is opened straight from disk).
 * In node: tools/load-generators.js reads Mathwise.generatorFiles.
 */
(function (root) {
  'use strict';
  var FILES = [
    'core.js',
    'powers.js',
    'sci-notation.js',
    'factoring.js'
  ];
  var MW = root.Mathwise = root.Mathwise || {};
  MW.generatorFiles = FILES.slice();
  if (typeof document !== 'undefined' && document.currentScript && document.readyState === 'loading') {
    var base = document.currentScript.src.replace(/[^\/]*$/, '');
    FILES.forEach(function (f) { document.write('<script src="' + base + f + '"><\/script>'); });
  }
})(typeof window !== 'undefined' ? window : this);
