/*
 * Generated questions in the editor: fill blocks that carry a `generator`,
 * reroll them with a new seed, and save them short (just the generator line).
 *
 * A generated question block:
 *   { kind: 'question', generator: { name, params, seed?, count } }
 * Without its own seed, a block uses the document seed (Mathwise.generators.blockSeed).
 *
 * Saving: a block whose parts still match what its generator makes is saved
 * without parts (and without its prompt if that is the generator's default).
 * A block that was changed by hand keeps all its text, so edits are never lost.
 */
(function (WS) {
  'use strict';

  // The editor uses only the generator API described in docs/generator-api.md
  // (list/get descriptors, validate, fillBlock, blockSeed). It never knows what
  // any particular generator does.
  var API_VERSION = 1;
  function lib() { return window.Mathwise && window.Mathwise.generators; }
  function available() { return !!lib() && lib().apiVersion === API_VERSION; }

  function isGenerated(b) { return !!(b && b.kind === 'question' && b.generator && b.generator.name); }

  function genOf(b) {
    if (!available()) return null;
    try { return lib().get(b.generator.name); } catch (e) { return null; }
  }

  // The seed block i actually uses (the rule itself lives in the generator library).
  function seedOf(doc, i) {
    if (!available()) return doc.blocks[i].generator.seed || '';
    return lib().blockSeed(doc.blocks[i].generator, doc.seed, i + 1);
  }

  // What the generator makes for block i (a fresh block; the document is not changed).
  function build(doc, i) {
    var b = doc.blocks[i];
    var copy = JSON.parse(JSON.stringify(b));
    delete copy.parts; delete copy.answer; delete copy.solution;
    var gen = genOf(b);
    if (gen && !gen.whole && b.prompt != null && b.prompt !== '') copy.prompt = b.prompt; else delete copy.prompt;
    return lib().fillBlock(copy, { docSeed: doc.seed, blockNumber: i + 1 });
  }

  function items(b) {
    var list = Array.isArray(b.parts) && b.parts.length ? b.parts : [b];
    return JSON.stringify(list.map(function (p) {
      return { prompt: p.prompt || '', answer: p.answer || '', solution: p.solution || '' };
    }));
  }

  // Does block i still show exactly what its generator makes?
  function inSync(doc, i) {
    if (!available() || !genOf(doc.blocks[i])) return false;
    try { return items(build(doc, i)) === items(doc.blocks[i]); } catch (e) { return false; }
  }

  function hasContent(b) {
    return (Array.isArray(b.parts) && b.parts.length) || (b.answer != null && b.answer !== '');
  }

  // Fill every generated block that has no questions yet (a short "recipe" file).
  // Returns a list of problems (unknown generator, bad settings) to show the user.
  function fillEmpty(doc) {
    var problems = [];
    if (!doc || !Array.isArray(doc.blocks)) return problems;
    doc.blocks.forEach(function (b, i) {
      if (!isGenerated(b) || hasContent(b)) return;
      if (!available()) { problems.push('Question ' + (i + 1) + ' needs the generator library, which did not load.'); return; }
      if (!genOf(b)) { problems.push('Question ' + (i + 1) + ': unknown generator "' + b.generator.name + '".'); return; }
      try { regenerate(doc, i); }
      catch (e) { problems.push('Question ' + (i + 1) + ': ' + e.message); }
    });
    return problems;
  }

  // Replace block i's questions with what its generator makes (after a seed or
  // settings change). The block object is updated in place so the editor keeps
  // its card open; the teacher's layout and marks are kept.
  function regenerate(doc, i) {
    var b = doc.blocks[i];
    var fresh = build(doc, i);
    var keep = ['label', 'numbered', 'marks', 'space', 'columns', 'boxed', 'id'];
    keep.forEach(function (k) { if (b[k] !== undefined) fresh[k] = b[k]; });
    Object.keys(b).forEach(function (k) { delete b[k]; });
    Object.keys(fresh).forEach(function (k) { b[k] = fresh[k]; });
    return b;
  }

  function newSeed() {
    return Math.random().toString(36).slice(2, 8);
  }

  function reroll(doc, i) {
    doc.blocks[i].generator.seed = newSeed();
    return regenerate(doc, i);
  }

  // New document seed: every generated block without hand edits gets new numbers.
  function rerollAll(doc) {
    var synced = doc.blocks.map(function (b, i) { return isGenerated(b) && inSync(doc, i); });
    doc.seed = newSeed();
    var skipped = 0;
    doc.blocks.forEach(function (b, i) {
      if (!isGenerated(b)) return;
      if (!synced[i]) { skipped++; return; }
      delete b.generator.seed;
      regenerate(doc, i);
    });
    return skipped;
  }

  // The document as it is saved: generated blocks that match their generator lose their parts.
  function compact(doc) {
    var out = JSON.parse(JSON.stringify(doc));
    doc.blocks.forEach(function (b, i) {
      if (!isGenerated(b) || !inSync(doc, i)) return;
      var gen = genOf(b);
      var o = out.blocks[i];
      delete o.parts; delete o.answer; delete o.solution;
      if (gen.whole || o.prompt === gen.prompt) delete o.prompt;
    });
    return out;
  }

  // The generator's descriptor (null when the library or the generator is missing).
  function descriptor(b) { return isGenerated(b) ? genOf(b) : null; }

  function title(b) { var g = genOf(b); return g ? g.title : b.generator.name; }

  WS.generated = {
    available: available,
    isGenerated: isGenerated,
    seedOf: seedOf,
    inSync: inSync,
    fillEmpty: fillEmpty,
    regenerate: regenerate,
    reroll: reroll,
    rerollAll: rerollAll,
    compact: compact,
    title: title,
    descriptor: descriptor,
    newSeed: newSeed
  };
})(window.WS = window.WS || {});
