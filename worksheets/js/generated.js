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
    var keep = ['label', 'numbered', 'marks', 'space', 'columns', 'boxed', 'lined', 'id'];
    keep.forEach(function (k) { if (b[k] !== undefined) fresh[k] = b[k]; });
    if (Array.isArray(fresh.parts)) keepPartFields(b.parts, fresh.parts);
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
    // Unlinked questions: record text typed over by hand as overrides before saving.
    doc.blocks.forEach(function (b) {
      if (isTemplateBlock(b) && templateOf(b)) templateItems(b).forEach(function (it) { captureOverrides(b, it); });
    });
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

  // ---------- unlinked questions (question templates, docs/generator-api.md §6) ----------
  //
  // An unlinked block has `template: { name, params }` and no generator/seed; each
  // part has `template: { vars, overrides? }` (a `whole` template keeps vars and
  // overrides on block.template). Its text is always stored, so it shows anywhere.

  function isTemplateBlock(b) {
    return !!(b && b.kind === 'question' && !b.generator && b.template && b.template.name);
  }

  function templateOf(b) {
    if (!available() || !isTemplateBlock(b)) return null;
    try { return lib().get(b.template.name); } catch (e) { return null; }
  }

  // Can block b (a generated question) be unlinked here?
  function canUnlink(b) {
    var g = isGenerated(b) && genOf(b);
    return !!(g && lib().isTemplate && lib().isTemplate(g));
  }

  // Turn generated block i into an unlinked template block with the same questions.
  // The block object is updated in place (the editor keeps its card open).
  function unlink(doc, i) {
    var b = doc.blocks[i];
    var fresh = lib().unlink(b, { docSeed: doc.seed, blockNumber: i + 1 });
    if (Array.isArray(fresh.parts)) keepPartFields(b.parts, fresh.parts);
    Object.keys(b).forEach(function (k) { delete b[k]; });
    Object.keys(fresh).forEach(function (k) { b[k] = fresh[k]; });
    return b;
  }

  // The things in block b that carry vars: [{ target, tv, index }] where `target`
  // holds the text (prompt/answer/solution) and `tv` holds { vars, overrides }.
  function templateItems(b) {
    var g = templateOf(b);
    if (!g) return [];
    if (g.whole) return b.template.vars ? [{ target: b, tv: b.template, index: -1 }] : [];
    return (b.parts || []).map(function (p, i) { return p.template && p.template.vars ? { target: p, tv: p.template, index: i } : null; })
      .filter(Boolean);
  }

  function textOf(target) {
    return { prompt: target.prompt || '', answer: target.answer || '', steps: target.solution ? target.solution.split('\n') : [] };
  }

  function renderSafe(name, vars, overrides) {
    var r = lib().render(name, vars, { output: 'steps', overrides: overrides, noThrow: true });
    return r.errors ? null : r;
  }

  // Record what the teacher typed over the rendered text as overrides (and drop
  // overrides that now match the plain rendering). An override that still renders
  // to the text shown is kept as it is, so %name% placeholders survive.
  function captureOverrides(b, item) {
    var name = b.template.name;
    var plain = renderSafe(name, item.tv.vars);
    if (!plain) return;
    var cur = item.tv.overrides || {};
    var withOv = renderSafe(name, item.tv.vars, cur) || plain;
    var now = textOf(item.target);
    var next = {};
    ['prompt', 'answer', 'steps'].forEach(function (f) {
      var shown = f === 'steps' ? JSON.stringify(now.steps) : now[f];
      var a = f === 'steps' ? JSON.stringify(withOv.steps || []) : (withOv[f] || '');
      var p = f === 'steps' ? JSON.stringify(plain.steps || []) : (plain[f] || '');
      if (cur[f] != null && shown === a) next[f] = cur[f];
      else if (shown !== p) next[f] = now[f];
    });
    if (Object.keys(next).length) item.tv.overrides = next; else delete item.tv.overrides;
  }

  function hasOverrides(item) { return !!(item.tv.overrides && Object.keys(item.tv.overrides).length); }

  function applyRender(target, r) {
    target.prompt = r.prompt;
    if (r.parts) {
      // A story question: the story is the prompt, the questions are its parts.
      delete target.answer; delete target.solution;
      if (r.graph) target.graph = r.graph; else delete target.graph;
      target.parts = keepPartFields(target.parts, r.parts.map(function (p) {
        var it = { prompt: p.prompt, answer: p.answer };
        if (p.steps && p.steps.length) it.solution = p.steps.join('\n');
        if (p.thinking) it.thinking = true;
        if (p.graph) it.graph = p.graph;
        return it;
      }));
      return;
    }
    target.answer = r.answer;
    if (r.steps && r.steps.length) target.solution = r.steps.join('\n'); else delete target.solution;
    if (r.graph) target.graph = r.graph; else delete target.graph;
  }

  // New generated parts keep the teacher's layout fields of the old part at the same place.
  var GENERATED_FIELDS = ['prompt', 'answer', 'solution', 'template', 'thinking', 'graph'];
  function keepPartFields(oldParts, newParts) {
    (oldParts || []).forEach(function (o, i) {
      var n = newParts[i];
      if (!n) return;
      Object.keys(o).forEach(function (k) { if (GENERATED_FIELDS.indexOf(k) < 0 && n[k] === undefined) n[k] = o[k]; });
    });
    return newParts;
  }

  /**
   * Change the vars of one item of template block b; the text re-renders and
   * anything typed over by hand stays. Returns a list of problems (nothing is
   * changed when there are any).
   */
  function setVars(b, item, vars) {
    captureOverrides(b, item);
    var r = lib().render(b.template.name, vars, { output: 'steps', overrides: item.tv.overrides, noThrow: true });
    if (r.errors) return r.errors;
    item.tv.vars = vars;
    applyRender(item.target, r);
    return [];
  }

  // Drop the hand-typed text of one item: back to what the template writes.
  function clearOverrides(b, item) {
    delete item.tv.overrides;
    var r = renderSafe(b.template.name, item.tv.vars);
    if (r) applyRender(item.target, r);
  }

  // One more part like the others, picked with a fresh seed from the stored settings.
  function addTemplatePart(b) {
    var g = templateOf(b);
    if (!g || g.whole) return null;
    b.parts = b.parts || [];
    var n = b.parts.length;
    var seed = newSeed();
    var seen = {};
    b.parts.forEach(function (p) { seen[p.prompt] = true; });
    var vars, r;
    for (var attempt = 0; attempt < 30; attempt++) {
      vars = lib().pick(g.name, b.template.params || {}, seed + ':' + attempt, { index: n, count: n + 1 });
      r = lib().render(g.name, vars, { output: 'steps' });
      if (!seen[r.prompt]) break;
    }
    var part = { template: { vars: vars } };
    applyRender(part, r);
    b.parts.push(part);
    return part;
  }

  function placeholders(b, item) {
    try { return lib().placeholders(b.template.name, item.tv.vars); } catch (e) { return []; }
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
    isTemplateBlock: isTemplateBlock,
    templateOf: templateOf,
    canUnlink: canUnlink,
    unlink: unlink,
    templateItems: templateItems,
    captureOverrides: captureOverrides,
    hasOverrides: hasOverrides,
    setVars: setVars,
    clearOverrides: clearOverrides,
    addTemplatePart: addTemplatePart,
    placeholders: placeholders,
    newSeed: newSeed
  };
})(window.WS = window.WS || {});
