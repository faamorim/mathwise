/*
 * Generator controls for the editor, built only from generator descriptors
 * (docs/generator-api.md): the settings of a generated question, and the
 * "Add generated question" picker.
 *
 * Nothing here knows what any particular generator does. A parameter is shown
 * by its type (number, choice, set, toggle); its label and allowed values come
 * from the descriptor. Values are checked with the library's validate() before
 * they are applied, so a bad combination is explained instead of breaking.
 */
(function (WS) {
  'use strict';

  function lib() { return window.Mathwise && window.Mathwise.generators; }

  function h(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function merged(gen, values) {
    var v = lib().defaults(gen);
    Object.keys(values || {}).forEach(function (k) { v[k] = values[k]; });
    return v;
  }

  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /**
   * Controls for every parameter of `gen`.
   *   values:   the stored params (missing keys show their defaults)
   *   onChange: function (key, value) — called only when the whole set of
   *             values passes validate(); otherwise the problem is shown and
   *             the control goes back to its last good value.
   * Returns an element with .reset() that puts every control back to `values`.
   */
  function paramControls(gen, values, onChange) {
    var cur = merged(gen, values);
    var msg = h('p', { class: 'error gen-error', hidden: true });
    var grid = h('div', { class: 'gen-params' });
    var redraws = [];

    function tryChange(key, value, redraw) {
      var next = JSON.parse(JSON.stringify(cur));
      next[key] = value;
      var errs = lib().validate(gen, next);
      if (errs.length) {
        msg.textContent = errs.join(' ');
        msg.hidden = false;
        redraw();   // back to the last good value
        return;
      }
      msg.hidden = true;
      cur = next;
      onChange(key, value);
    }

    (gen.params || []).forEach(function (p) {
      var ctl, redraw;
      if (p.type === 'number') {
        ctl = h('input', { type: 'number', min: p.min, max: p.max, step: 1, class: 'gen-num',
          title: 'A whole number from ' + p.min + ' to ' + p.max });
        redraw = function () { ctl.value = cur[p.key]; };
        ctl.addEventListener('change', function () {
          var v = ctl.value.trim() === '' ? NaN : +ctl.value;
          tryChange(p.key, v, redraw);
        });
      } else if (p.type === 'choice') {
        ctl = h('select');
        p.values.forEach(function (o, n) { ctl.appendChild(h('option', { value: String(n), text: o.label })); });
        redraw = function () {
          var n = p.values.map(function (o) { return o.value; }).indexOf(cur[p.key]);
          ctl.value = String(Math.max(0, n));
        };
        ctl.addEventListener('change', function () { tryChange(p.key, p.values[+ctl.value].value, redraw); });
      } else if (p.type === 'set') {
        ctl = h('div', { class: 'gen-set' });
        var boxes = p.values.map(function (o) {
          var c = h('input', { type: 'checkbox' });
          c.addEventListener('change', function () {
            var chosen = p.values.filter(function (x, n) { return boxes[n].checked; }).map(function (x) { return x.value; });
            tryChange(p.key, chosen, redraw);
          });
          ctl.appendChild(h('label', { class: 'check' }, c, o.label));
          return c;
        });
        redraw = function () {
          boxes.forEach(function (c, n) { c.checked = (cur[p.key] || []).indexOf(p.values[n].value) >= 0; });
        };
      } else if (p.type === 'toggle') {
        var c = h('input', { type: 'checkbox' });
        ctl = h('label', { class: 'check' }, c, 'On');
        redraw = function () { c.checked = !!cur[p.key]; };
        c.addEventListener('change', function () { tryChange(p.key, c.checked, redraw); });
      } else {
        // A type this page does not know (a newer library): show it read-only.
        ctl = h('span', { class: 'muted', text: JSON.stringify(cur[p.key]) });
        redraw = function () {};
      }
      redraw();
      redraws.push(redraw);
      grid.appendChild(h('div', { class: 'field gen-param gen-' + p.type },
        h('span', { text: p.label }), ctl));
    });

    var box = h('div', { class: 'gen-controls' }, grid, msg);
    box.reset = function (v) { cur = merged(gen, v); msg.hidden = true; redraws.forEach(function (r) { r(); }); };
    return box;
  }

  // Generators grouped by topic, in library order.
  function byTopic() {
    var groups = [], seen = {};
    lib().list().forEach(function (g) {
      var t = g.topic || 'Other';
      if (!seen[t]) { seen[t] = { topic: t, gens: [] }; groups.push(seen[t]); }
      seen[t].gens.push(g);
    });
    return groups;
  }

  // Up to `n` sample prompts as HTML (for the picker's preview).
  function samples(gen, values, seed, n) {
    var html = [];
    for (var i = 0; i < n; i++) {
      try {
        var r = lib().generate(gen.name, values, seed + ':' + i, { output: 'answer', index: i, count: n });
        html.push('<li>' + WS.markup.inline(r.prompt) + ' <span class="gen-sample-ans">' +
          WS.markup.inline(r.answer || '') + '</span></li>');
      } catch (e) {
        return '<p class="error">' + WS.markup.escapeHtml(e.message || String(e)) + '</p>';
      }
      if (gen.whole) break;
    }
    return '<ol class="gen-samples">' + html.join('') + '</ol>';
  }

  /**
   * The "Add generated question" picker.
   *   opts.onAdd(generatorField): the stored form { name, params, count }
   *   opts.onCancel()
   */
  function picker(opts) {
    var groups = byTopic();
    var sel = h('select', { class: 'gen-pick' });
    groups.forEach(function (g) {
      var og = h('optgroup', { label: g.topic });
      g.gens.forEach(function (gen) { og.appendChild(h('option', { value: gen.name, text: gen.title })); });
      sel.appendChild(og);
    });
    if (opts.last) sel.value = opts.last;

    var params = {};
    var count = h('input', { type: 'number', min: 1, max: 20, step: 1, class: 'count', title: 'How many parts' });
    var countField = h('label', { class: 'field' }, h('span', { text: 'Parts' }), count);
    var settings = h('div');
    var preview = h('div', { class: 'gen-preview' });
    var seed = WS.generated ? WS.generated.newSeed() : 'sample';

    function gen() { return lib().get(sel.value); }

    function showPreview() {
      var g = gen();
      preview.innerHTML = '<div class="muted">Sample (' + WS.markup.escapeHtml(g.prompt) + '):</div>' +
        samples(g, merged(g, params), seed, 3);
    }

    function pick() {
      var g = gen();
      params = {};
      count.value = 4;
      countField.hidden = !!g.whole;
      settings.innerHTML = '';
      settings.appendChild(paramControls(g, params, function (k, v) { params[k] = v; showPreview(); }));
      showPreview();
    }
    sel.addEventListener('change', pick);

    var panel = h('div', { class: 'gen-picker' },
      h('div', { class: 'row' },
        h('label', { class: 'field grow' }, h('span', { text: 'Kind of question' }), sel),
        countField),
      settings,
      h('div', { class: 'row' },
        preview,
        h('button', { class: 'btn small', text: '🎲 Other sample', onclick: function () {
          seed = WS.generated ? WS.generated.newSeed() : seed + 'x'; showPreview();
        } })),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', text: 'Add question', onclick: function () {
          var g = gen();
          var out = { name: g.name, params: {} };
          // Store real values for what the teacher changed; the rest use the defaults.
          var d = lib().defaults(g);
          Object.keys(params).forEach(function (k) { if (!same(params[k], d[k])) out.params[k] = params[k]; });
          if (!g.whole) out.count = Math.max(1, Math.min(20, Math.round(+count.value) || 4));
          opts.onAdd(out);
        } }),
        h('button', { class: 'btn', text: 'Cancel', onclick: function () { opts.onCancel(); } })));
    pick();
    return panel;
  }

  WS.genPanel = { paramControls: paramControls, picker: picker, byTopic: byTopic };
})(window.WS = window.WS || {});
