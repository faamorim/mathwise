/*
 * Editor page: builds the form UI, keeps the live preview in sync, and
 * handles open / save / print.
 */
(function (WS) {
  'use strict';

  var model = WS.model;
  var AUTOSAVE_KEY = 'hs-assist.worksheet-editor.autosave';
  var EXAMPLES = [
    { file: '../examples/math9-scientific-notation-notes.json', name: 'Math 9 · Scientific notation (worksheet)' },
    { file: '../examples/math9-powers-quiz.json', name: 'Math 9 · Powers quiz' },
    { file: '../examples/recipes/math9-powers-practice-quiz.json', name: 'Math 9 · Powers practice quiz (generated)' }
  ];

  var state = {
    doc: null,
    fileHandle: null,
    fileName: '',
    dirty: false,
    showAnswers: false,
    view: 'handout',
    openSteps: new WeakSet(),
    genOpen: new WeakSet(),
    printing: false,
    lookOpen: false,
    partsOpen: new WeakSet(),
    partsClosed: new WeakSet(),
    picking: false,
    lastGenerator: null,
    open: new WeakSet(),
    undo: [],
    lastField: null
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- tiny DOM helpers ----------

  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else if (k === 'style') e.style.cssText = v;
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(e, x); }); return; }
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  function field(label, input, cls) {
    return h('label', { class: 'field' + (cls ? ' ' + cls : '') }, h('span', { text: label }), input);
  }

  function trackFocus(e) {
    e.addEventListener('focus', function () { state.lastField = e; });
    return e;
  }

  // Text bound to obj[key]. Empty string is kept (prompts etc.).
  function textInput(obj, key, opts) {
    opts = opts || {};
    var e = opts.multiline
      ? h('textarea', { rows: opts.rows || 3, placeholder: opts.placeholder, spellcheck: 'true' })
      : h('input', { type: 'text', placeholder: opts.placeholder, class: opts.mono ? 'mono' : null });
    e.value = obj[key] == null ? '' : obj[key];
    e.addEventListener('input', function () {
      if (opts.emptyDeletes && e.value === '') delete obj[key];
      else obj[key] = e.value;
      changed(false);
      if (opts.onInput) opts.onInput(e.value);
    });
    return trackFocus(e);
  }

  // Number bound to obj[key]; empty input deletes the key (use the default).
  function numInput(obj, key, opts) {
    opts = opts || {};
    var e = h('input', {
      type: 'number', min: opts.min, max: opts.max, step: opts.step || 'any', placeholder: opts.placeholder,
      title: opts.title
    });
    if (obj[key] != null) e.value = obj[key];
    e.addEventListener('input', function () {
      var v = e.value.trim();
      if (v === '' || isNaN(+v)) delete obj[key];
      else obj[key] = +v;
      changed(false);
      if (opts.onInput) opts.onInput();
    });
    return e;
  }

  function checkbox(label, get, set, title) {
    var c = h('input', { type: 'checkbox' });
    c.checked = !!get();
    c.addEventListener('change', function () { set(c.checked); changed(true); });
    return h('label', { class: 'check', title: title }, c, label);
  }

  function selectInput(obj, key, options, opts) {
    opts = opts || {};
    var s = h('select', { title: opts.title });
    options.forEach(function (o) {
      s.appendChild(h('option', { value: o[0], text: o[1] }));
    });
    s.value = obj[key] != null ? String(obj[key]) : String(opts.def != null ? opts.def : options[0][0]);
    s.addEventListener('change', function () {
      var v = s.value;
      obj[key] = opts.number ? +v : v;
      changed(opts.structural !== false);
    });
    return s;
  }

  // ---------- state changes ----------

  var previewTimer = null;
  var renderToken = 0;

  function changed(structural) {
    state.dirty = true;
    updateStatus();
    autosave();
    if (structural) { buildSettings(); buildBlocks(); }
    else refreshHeads();
    schedulePreview();
  }

  function snapshot() {
    state.undo.push(JSON.stringify(state.doc));
    if (state.undo.length > 50) state.undo.shift();
    $('btn-undo').disabled = false;
  }

  function undo() {
    var s = state.undo.pop();
    $('btn-undo').disabled = !state.undo.length;
    if (!s) return;
    state.doc = model.normalize(JSON.parse(s));
    state.dirty = true;
    buildAll();
    autosave();
  }

  function schedulePreview(now) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, now ? 0 : 250);
  }

  function renderPreview() {
    var token = ++renderToken;
    var pane = $('preview-pane');
    var scroll = pane.scrollTop;
    var target = document.createElement('div');
    target.className = 'pages';
    target.id = 'pages';
    target.style.zoom = $('sel-zoom').value;
    var old = $('pages');
    // Paginate in a hidden copy, then swap, to avoid flicker.
    target.style.position = 'absolute';
    target.style.visibility = 'hidden';
    target.removeAttribute('id');
    pane.appendChild(target);
    return WS.render.render(target, state.doc, {
      showAnswers: state.showAnswers, view: state.view,
      nudge: state.view === 'handout' && !state.printing   // empty work spaces stay draggable in the preview
    }).then(function () {
      if (token !== renderToken) { target.remove(); return; }
      target.style.position = '';
      target.style.visibility = '';
      target.id = 'pages';
      old.replaceWith(target);
      pane.scrollTop = scroll;
      updatePrintButtons();
      document.title = (state.doc.title ? stripMarkup(state.doc.title) + ' – ' : '') + 'Worksheet & Quiz Editor';
    });
  }

  function stripMarkup(s) {
    return String(s).replace(/[$*_]/g, '').replace(/\\[a-z]+/gi, '').trim();
  }

  function autosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: state.doc, fileName: state.fileName, dirty: state.dirty }));
    } catch (e) { /* storage full or disabled */ }
  }

  function updateStatus() {
    var s = $('status');
    s.textContent = (state.fileName || 'Untitled') + (state.dirty ? ' (unsaved)' : '');
    s.classList.toggle('dirty', state.dirty);
  }

  // ---------- document settings ----------

  function buildSettings() {
    var doc = state.doc;
    var hd = doc.header;
    var root = $('doc-settings');
    root.innerHTML = '';

    var total = model.totalMarks(doc);
    var std = model.STANDARD_FIELDS.map(function (f) {
      return checkbox(f.charAt(0).toUpperCase() + f.slice(1), function () {
        return hd.fields.indexOf(f) >= 0;
      }, function (on) {
        var set = model.STANDARD_FIELDS.filter(function (x) {
          return x === f ? on : hd.fields.indexOf(x) >= 0;
        });
        hd.fields = set;
      });
    });

    var customList = h('div');
    hd.custom.forEach(function (c, i) {
      customList.appendChild(h('div', { class: 'custom-row' },
        textInput(c, 'label', { placeholder: 'Field label, e.g. Group' }),
        selectInput(c, 'width', [['s', 'Short blank'], ['m', 'Medium blank'], ['l', 'Long blank']], { structural: false }),
        h('button', { class: 'btn icon danger', title: 'Remove field', text: '✕', onclick: function () {
          hd.custom.splice(i, 1); changed(true);
        } })));
    });

    var totalInput = numInput(hd, 'gradeTotal', {
      min: 0, placeholder: String(total), title: 'Leave empty to add up the marks automatically'
    });
    totalInput.id = 'grade-total';

    root.appendChild(h('fieldset', null,
      h('legend', { text: 'Document' }),
      h('div', { class: 'row' },
        field('Type', selectInput(doc, 'type', [['worksheet', 'Worksheet'], ['quiz', 'Quiz']])),
        field('Title', textInput(doc, 'title', { placeholder: 'e.g. (5) Math 9 Scientific notation (notes)' }), 'grow')),
      h('div', { class: 'row' },
        field('Paper', selectInput(doc, 'paper', [['letter', 'Letter'], ['a4', 'A4']])),
        field('Default marks per question / part', numInput(doc, 'defaultMarks', { min: 0, step: 0.5 })),
        h('div', { class: 'field' }, h('span', { text: ' ' }),
          checkbox('Show marks next to questions', function () { return doc.showMarks; },
            function (v) { doc.showMarks = v; }))),
      h('div', { class: 'row' },
        checkbox('Compact: no work space (students work on separate paper)', function () { return !!doc.compact; },
          function (v) { if (v) doc.compact = true; else delete doc.compact; })),
      h('div', { class: 'row' },
        checkbox('Page numbers ("1 out of 3")', function () { return doc.footer.pageNumbers; },
          function (v) { doc.footer.pageNumbers = v; }),
        field('Answers for students', selectInput(doc.answers, 'handout', [
          ['none', 'None'],
          ['final', 'Answers page in the handout']
        ], { title: 'A final-answers page at the end of the handout, counted in the page numbers' })),
        field('Teacher key (separate)', selectInput(doc.answers, 'key', [
          ['none', 'None'],
          ['final', 'Final answers'],
          ['worked', 'Worked solutions']
        ], { title: 'A separate document for the teacher, printed with “Print key”' })))
    ));

    if (WS.themes) root.appendChild(buildLook(doc));

    if (WS.generated && doc.blocks.some(WS.generated.isGenerated)) {
      var qs = h('input', { type: 'text', class: 'mono seed', placeholder: 'mathwise',
        title: 'Generated questions without their own seed use this seed plus their position' });
      qs.value = doc.seed != null ? doc.seed : '';
      qs.addEventListener('change', function () {
        snapshot();
        if (qs.value.trim() === '') delete doc.seed; else doc.seed = qs.value.trim();
        doc.blocks.forEach(function (b, i) {
          if (WS.generated.isGenerated(b) && (b.generator.seed == null || b.generator.seed === '')) WS.generated.regenerate(doc, i);
        });
        changed(true);
      });
      root.appendChild(h('fieldset', null,
        h('legend', { text: 'Generated questions' }),
        h('div', { class: 'row' },
          field((doc.type === 'quiz' ? 'Quiz' : 'Worksheet') + ' seed', qs),
          h('div', { class: 'field' }, h('span', { text: ' ' }),
            h('button', { class: 'btn small primary', text: '🎲 New version',
              title: 'New numbers for every generated question (questions changed by hand are kept)',
              onclick: function () {
                snapshot();
                var skipped = WS.generated.rerollAll(doc);
                changed(true);
                if (skipped) alert(skipped + ' question(s) changed by hand were kept as they are.');
              } })),
          h('span', { class: 'muted', text: 'Same seed = same questions. Each question can also have its own seed.' }))));
    }

    root.appendChild(h('fieldset', null,
      h('legend', { text: 'Header' }),
      h('div', { class: 'row' }, h('span', { class: 'muted', text: 'Blanks:' }), std),
      h('div', { class: 'row' },
        checkbox('Grade blank', function () { return hd.showGrade; }, function (v) { hd.showGrade = v; }),
        field('Grade label', textInput(hd, 'gradeLabel', {
          placeholder: doc.type === 'quiz' ? 'Quiz' : 'Mark', emptyDeletes: true
        })),
        field('Out of', totalInput),
        h('span', { class: 'muted', id: 'auto-total', text: 'auto total: ' + total })),
      h('div', { class: 'row' },
        checkbox('Repeat the blanks on every page', function () { return hd.repeat; },
          function (v) { hd.repeat = v; }, 'Otherwise later pages only show the title')),
      h('div', { class: 'sub' },
        h('span', { class: 'sub-title', text: 'Custom fields' }),
        h('button', { class: 'btn small', text: '+ Add field', onclick: function () {
          hd.custom.push({ label: 'Group', width: 's' }); changed(true);
        } }),
        customList)
    ));
  }

  // ---------- blocks ----------

  var KIND_NAMES = {
    heading: 'Heading', text: 'Text', example: 'Example', question: 'Question',
    table: 'Table', image: 'Image', notes: 'My notes', pageBreak: 'Page break'
  };

  function summaryOf(b) {
    var s = '';
    switch (b.kind) {
      case 'heading': s = b.text; break;
      case 'text': s = b.content; break;
      case 'question': case 'example':
        s = b.prompt;
        if (model.hasParts(b)) s += '  (' + b.parts.length + ' parts)';
        if (b.table) s += '  (table)';
        break;
      case 'table': s = (b.header || []).join(' | ') || b.rows.length + ' rows'; break;
      case 'image': s = b.caption || (b.src ? 'image' : 'no image yet'); break;
      case 'pageBreak': s = 'next block starts on a new page'; break;
      case 'notes': s = (b.title || 'Notes') + '  (' + (b.lines || 0) + ' lines)'; break;
    }
    return String(s || '').replace(/\s+/g, ' ').slice(0, 90);
  }

  function badgeText(b, label) {
    return KIND_NAMES[b.kind] + (label ? ' ' + label : '');
  }

  function refreshHeads() {
    var labels = model.labels(state.doc);
    document.querySelectorAll('#blocks .card').forEach(function (card) {
      var i = +card.dataset.index;
      var b = state.doc.blocks[i];
      if (!b) return;
      card.querySelector('.badge').textContent = badgeText(b, labels[i]);
      card.querySelector('.summary').textContent = summaryOf(b);
      var m = card.querySelector('.marks');
      m.textContent = b.kind === 'question' ? fmt(model.questionMarks(b, state.doc)) + ' mk' : '';
    });
    var total = model.totalMarks(state.doc);
    var at = $('auto-total');
    if (at) at.textContent = 'auto total: ' + total;
    var gt = $('grade-total');
    if (gt) gt.placeholder = String(total);
  }

  function fmt(n) { return String(Math.round(n * 1000) / 1000); }

  function buildBlocks() {
    var root = $('blocks');
    var labels = model.labels(state.doc);
    root.innerHTML = '';
    state.doc.blocks.forEach(function (b, i) {
      root.appendChild(blockCard(b, i, labels[i]));
    });
    refreshHeads();
  }

  function moveBlock(i, d) {
    var bl = state.doc.blocks;
    var j = i + d;
    if (j < 0 || j >= bl.length) return;
    snapshot();
    var t = bl[i]; bl[i] = bl[j]; bl[j] = t;
    changed(true);
  }

  function blockCard(b, i, label) {
    var card = h('div', { class: 'card' + (state.open.has(b) ? ' open' : ''), 'data-index': i });
    var head = h('div', { class: 'card-head', onclick: function (ev) {
      if (ev.target.closest('.tools')) return;
      if (state.open.has(b)) state.open.delete(b); else state.open.add(b);
      card.classList.toggle('open');
      if (card.classList.contains('open')) flashPreview(i);
    } },
      h('span', { class: 'badge k-' + b.kind, text: badgeText(b, label) }),
      h('span', { class: 'summary' }),
      h('span', { class: 'marks' }),
      h('span', { class: 'tools' },
        h('button', { title: 'Move up', text: '↑', onclick: function () { moveBlock(i, -1); } }),
        h('button', { title: 'Move down', text: '↓', onclick: function () { moveBlock(i, 1); } }),
        h('button', { title: 'Duplicate', text: '⧉', onclick: function () {
          snapshot();
          var copy = JSON.parse(JSON.stringify(b));
          state.doc.blocks.splice(i + 1, 0, copy);
          state.open.add(copy);
          changed(true);
        } }),
        h('button', { title: 'Delete (Undo brings it back)', text: '✕', onclick: function () {
          snapshot();
          state.doc.blocks.splice(i, 1);
          changed(true);
        } })));
    card.appendChild(head);
    var body = h('div', { class: 'card-body' });
    buildBlockBody(b, body);
    card.appendChild(body);
    return card;
  }

  function buildBlockBody(b, body) {
    switch (b.kind) {
      case 'heading':
        body.appendChild(h('div', { class: 'row' },
          field('Heading text', textInput(b, 'text'), 'grow'),
          field('Size', selectInput(b, 'size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], { def: 'm', structural: false })),
          field('Align', selectInput(b, 'align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], { structural: false }))));
        break;
      case 'text':
        body.appendChild(field('Text (bold, lists, math, blanks: see Help above)',
          textInput(b, 'content', { multiline: true, rows: 7 })));
        body.appendChild(h('div', { class: 'row' },
          field('Align', selectInput(b, 'align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], { structural: false }))));
        break;
      case 'question':
      case 'example':
        buildQuestionBody(b, body);
        break;
      case 'notes':
        body.appendChild(h('div', { class: 'row' },
          field('Title', textInput(b, 'title', { placeholder: 'e.g. In my own words / Note to my future self' }), 'grow'),
          field('Size (lines)', numInput(b, 'lines', { min: 0, max: 40, step: 1 })),
          h('div', { class: 'field' }, h('span', { text: ' ' }), checkbox('Lined', function () { return !!b.lined; },
            function (v) { if (v) b.lined = true; else delete b.lined; }, 'Ruled lines instead of blank space'))));
        body.appendChild(field('Instruction for students (optional)', textInput(b, 'prompt', {
          multiline: true, rows: 2, placeholder: 'e.g. Write what you learned today, as if explaining it to a friend.' })));
        body.appendChild(h('p', { class: 'muted', text: 'A box for students to write (or sketch) their own notes or summary. Not numbered and not marked.' }));
        break;
      case 'table':
        buildTableEditor(b, body);
        break;
      case 'image':
        buildImageBody(b, body);
        break;
      case 'pageBreak':
        body.appendChild(h('p', { class: 'muted', text: 'The next block starts on a new page.' }));
        break;
    }
  }

  // ---------- look (theme) ----------

  // The "Look" panel: pick a theme, change any of its settings, save / load it
  // as its own file. Stored as doc.theme = { name, ...changed settings }.
  function buildLook(doc) {
    var T = WS.themes;
    var t = doc.theme || { name: 'classic' };
    var base = T.resolve({ name: t.name });
    var cur = T.resolve(t);
    function store(next) {
      snapshot();
      var clean = { name: next.name || 'classic' };
      var b = T.resolve({ name: clean.name });
      Object.keys(T.CLASSIC).forEach(function (k) { if (next[k] != null && next[k] !== b[k]) clean[k] = next[k]; });
      if (clean.name === 'classic' && Object.keys(clean).length === 1) delete doc.theme; else doc.theme = clean;
      changed(true);
    }
    var themeSel = h('select');
    Object.keys(T.THEMES).forEach(function (k) { themeSel.appendChild(h('option', { value: k, text: T.THEMES[k].label })); });
    themeSel.value = T.THEMES[t.name] ? t.name : 'classic';
    themeSel.addEventListener('change', function () { store({ name: themeSel.value }); });

    var grid = h('div', { class: 'row look-grid' });
    T.SETTINGS.forEach(function (d) {
      var v = cur[d.key];
      var changedHere = v !== base[d.key];
      var ctl;
      function set(val) { var n = JSON.parse(JSON.stringify(t)); n.name = themeSel.value; n[d.key] = val; store(n); }
      if (d.type === 'choice') {
        ctl = h('select');
        d.values.forEach(function (o) { ctl.appendChild(h('option', { value: o[0], text: o[1] })); });
        ctl.value = v;
        ctl.addEventListener('change', function () { set(ctl.value); });
      } else if (d.type === 'number') {
        ctl = h('input', { type: 'number', min: d.min, max: d.max, step: d.step, class: 'look-num' });
        ctl.value = v;
        ctl.addEventListener('change', function () {
          var n = +ctl.value;
          if (ctl.value === '' || isNaN(n)) { ctl.value = v; return; }
          set(Math.max(d.min, Math.min(d.max, n)));
        });
      } else {
        var c = h('input', { type: 'color' });
        c.value = v || '#ffffff';
        c.addEventListener('change', function () { set(c.value); });
        ctl = d.optional
          ? h('span', { class: 'look-color' }, c, ' ', h('button', { class: 'btn small', text: 'None', title: 'No fill',
            onclick: function () { set(''); } }))
          : c;
        if (d.optional && !v) c.style.opacity = 0.4;
      }
      grid.appendChild(field(d.label + (changedHere ? ' •' : ''), ctl));
    });

    var fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files[0];
      if (!f) return;
      f.text().then(function (text) { store(T.fromFile(JSON.parse(text))); })
        .catch(function (e) { alert('Could not load the theme: ' + (e.message || e)); });
    });
    var custom = Object.keys(t).filter(function (k) { return k !== 'name'; }).length;
    return h('fieldset', null,
      h('legend', { text: 'Look' }),
      h('div', { class: 'row' },
        field('Theme', themeSel),
        h('span', { class: 'muted', text: custom ? custom + ' setting(s) changed (•)' : 'Only how the pages look; the questions do not change.' })),
      h('details', { class: 'look-more', open: state.lookOpen,
        ontoggle: function (ev) { state.lookOpen = ev.target.open; } },
        h('summary', { text: 'Fonts, colours, lines, boxes…' }),
        grid,
        h('div', { class: 'row' },
          custom ? h('button', { class: 'btn small', text: 'Reset to ' + T.THEMES[themeSel.value].label,
            onclick: function () { store({ name: themeSel.value }); } }) : null,
          h('button', { class: 'btn small', text: 'Save theme…', title: 'Save this look as a .json file to reuse in other worksheets',
            onclick: function () {
              var a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([JSON.stringify(T.toFile(t), null, 2) + '\n'], { type: 'application/json' }));
              a.download = 'mathwise-theme-' + (t.name || 'classic') + '.json';
              document.body.appendChild(a); a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            } }),
          h('button', { class: 'btn small', text: 'Load theme…', onclick: function () { fileIn.value = ''; fileIn.click(); } }),
          fileIn)));
  }

  // ---------- generated questions ----------

  // "Largest exponent: 4 · Forms: 2⁻³, 10⁻ⁿ" from the stored params, using the
  // descriptor's labels when the generator is known.
  function paramSummary(q) {
    var p = q.generator.params || {};
    var gen = WS.generated.descriptor(q);
    var defs = {};
    ((gen && gen.params) || []).forEach(function (d) { defs[d.key] = d; });
    function show(d, v) {
      if (!d || !d.values) return typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v);
      var o = d.values.filter(function (x) { return x.value === v; })[0];
      return o ? o.label : String(v);
    }
    return Object.keys(p).map(function (k) {
      var d = defs[k], v = p[k];
      return (d ? d.label : k) + ': ' + (Array.isArray(v) ? v.map(function (x) { return show(d, x); }).join(', ') : show(d, v));
    }).join(' · ') || 'default settings';
  }

  function generatorBox(q) {
    var G = WS.generated;
    var doc = state.doc;
    var i = doc.blocks.indexOf(q);
    var synced = G.available() && G.inSync(doc, i);
    function redo(fn) {
      if (!synced && !window.confirm('This question was changed by hand. Replace it with newly generated questions?')) return;
      snapshot();
      try { fn(); } catch (e) { alert(e.message || e); }
      changed(true);
    }
    var seed = h('input', { type: 'text', class: 'mono seed', placeholder: G.seedOf(doc, i),
      title: 'Same seed = same questions. Empty = use the quiz seed.' });
    seed.value = q.generator.seed != null ? q.generator.seed : '';
    seed.addEventListener('change', function () {
      redo(function () {
        if (seed.value.trim() === '') delete q.generator.seed; else q.generator.seed = seed.value.trim();
        G.regenerate(doc, i);
      });
    });
    var count = h('input', { type: 'number', min: 1, max: 20, step: 1, class: 'count', title: 'How many parts' });
    count.value = q.generator.count || (q.parts ? q.parts.length : 1);
    count.addEventListener('change', function () {
      var n = Math.max(1, Math.min(20, Math.round(+count.value) || 1));
      redo(function () { q.generator.count = n; G.regenerate(doc, i); });
    });
    var settings = null;
    var gen = G.descriptor(q);
    if (gen && (gen.params || []).length) {
      var controls = WS.genPanel.paramControls(gen, q.generator.params, function (k, v) {
        var applied = false;
        redo(function () {
          q.generator.params = q.generator.params || {};
          q.generator.params[k] = v;
          G.regenerate(doc, i);
          applied = true;
        });
        if (!applied) controls.reset(q.generator.params);
      });
      settings = h('details', { class: 'gen-settings', open: state.genOpen.has(q),
        ontoggle: function (ev) { if (ev.target.open) state.genOpen.add(q); else state.genOpen.delete(q); } },
        h('summary', { text: 'Settings' }),
        controls,
        h('button', { class: 'btn small', text: 'Reset to defaults',
          title: 'Use the generator\'s default settings',
          onclick: function () { redo(function () { delete q.generator.params; G.regenerate(doc, i); }); } }));
    }
    return h('div', { class: 'gen-box' + (synced ? '' : ' edited') },
      h('div', { class: 'row' },
        h('span', { class: 'gen-title', text: '⚙ Generated: ' + G.title(q) }),
        h('span', { class: 'muted', text: paramSummary(q) })),
      h('div', { class: 'row' },
        field('Seed', seed),
        G.available() && !(G.descriptor(q) || {}).whole ? field('Parts', count) : null,
        h('div', { class: 'field' }, h('span', { text: ' ' }),
          h('button', { class: 'btn small primary', text: '🎲 New seed',
            title: 'Make new questions of the same kind (Undo brings the old ones back)',
            onclick: function () { redo(function () { G.reroll(doc, i); }); } })),
        G.canUnlink(q) ? h('div', { class: 'field' }, h('span', { text: ' ' }),
          h('button', { class: 'btn small', text: '✂ Unlink to edit numbers',
            title: 'Keep these questions but stop using the seed: change any number, letter or operation and the answer and steps follow',
            onclick: function () {
              redo(function () { G.unlink(doc, i); });
            } })) : null),
      synced ? null : h('p', { class: 'muted warn',
        text: G.available() ? 'Changed by hand: saved with all its text. A new seed replaces your changes.'
          : 'The generator library did not load, so this question cannot be regenerated here.' }),
      settings);
  }

  // An unlinked question: edit the values of each part; answers and steps follow.
  function templateBox(q) {
    var G = WS.generated;
    var gen = G.templateOf(q);
    if (!gen) {
      return h('div', { class: 'gen-box edited' },
        h('span', { class: 'gen-title', text: '✎ Unlinked question: ' + q.template.name }),
        h('p', { class: 'muted warn', text: 'This template is not available here, so the question is kept exactly as typed.' }));
    }
    var items = G.templateItems(q);
    items.forEach(function (it) { G.captureOverrides(q, it); });
    var list = h('div', { class: 'tmpl-items' });
    items.forEach(function (it) {
      var controls = WS.genPanel.varControls(gen, it.tv.vars, function (vars) {
        snapshot();
        var errs = G.setVars(q, it, vars);
        if (errs.length) { state.undo.pop(); $('btn-undo').disabled = !state.undo.length; return errs; }
        changed(true);
        return [];
      });
      list.appendChild(h('div', { class: 'tmpl-item' },
        it.index >= 0 ? h('span', { class: 'lbl', text: model.partLabel(it.index, q.parts[it.index]) }) : null,
        controls,
        G.hasOverrides(it) ? h('button', { class: 'btn small tmpl-typed',
          text: '✎ your text ✕', title: 'Text you typed over (' + Object.keys(it.tv.overrides).join(', ') +
            ') is kept when values change. Click to go back to the template\'s own text.',
          onclick: function () { snapshot(); G.clearOverrides(q, it); changed(true); } }) : null));
    });
    var names = items.length ? G.placeholders(q, items[0]) : [];
    return h('div', { class: 'gen-box tmpl-box' },
      h('div', { class: 'row' },
        h('span', { class: 'gen-title', text: '✎ Unlinked: ' + gen.title }),
        h('span', { class: 'muted', text: 'Change a value and the question, answer and steps follow. Text you type over by hand stays.' })),
      list,
      h('div', { class: 'row' },
        gen.whole ? null : h('button', { class: 'btn small', text: '+ Add part like these',
          title: 'Pick one more part with the same settings',
          onclick: function () { snapshot(); try { G.addTemplatePart(q); } catch (e) { alert(e.message || e); } changed(true); } }),
        names.length ? h('details', { class: 'tmpl-help' },
          h('summary', { text: 'Placeholders for your own text' }),
          h('p', { class: 'muted', text: 'In a part\'s text, answer or steps you can type these and they follow the values: ' +
            names.map(function (n) { return '%' + n + '%'; }).join('  ') + '  (%% is a literal %).' })) : null));
  }

  function buildQuestionBody(q, body) {
    var isQ = q.kind === 'question';
    var parts = model.hasParts(q);
    var many = parts || !!q.table;
    var linked = isQ && WS.generated && WS.generated.isGenerated(q);
    var unlinked = isQ && WS.generated && !linked && WS.generated.isTemplateBlock(q) && !!WS.generated.templateOf(q);
    var generated = linked || unlinked;
    var whole = generated && (linked ? WS.generated.descriptor(q) : WS.generated.templateOf(q) || {}).whole;
    if (generated) {
      // A generated question is mostly driven by its settings (or, unlinked, by its
      // values): show those, the instructions and the layout, and fold the text away
      // until the teacher wants to read or change it by hand.
      body.appendChild(linked ? generatorBox(q) : templateBox(q));
      var synced = unlinked || (WS.generated.available() && WS.generated.inSync(state.doc, state.doc.blocks.indexOf(q)));
      if (!whole) {
        body.appendChild(field('Instructions', textInput(q, 'prompt', { placeholder: 'e.g. Simplify' })));
      }
      body.appendChild(h('div', { class: 'row' },
        field(parts ? 'Marks per part' : 'Marks', numInput(q, 'marks', {
          min: 0, step: 0.5, placeholder: String(state.doc.defaultMarks), title: 'Empty = document default'
        })),
        field(parts ? 'Work space per part (lines)' : 'Work space (lines)', numInput(q, 'space', {
          min: 0, step: 0.5, placeholder: parts ? (q.boxed === false ? '1' : '2') : '3'
        })),
        parts ? field('Columns', selectInput(q, 'columns', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], { number: true, def: '1' })) : null,
        parts ? h('div', { class: 'field' }, h('span', { text: ' ' }), checkbox('Boxes', function () { return q.boxed !== false; },
          function (v) { if (v) delete q.boxed; else q.boxed = false; }, 'Draw a box around each part')) : null,
        h('div', { class: 'field' }, h('span', { text: ' ' }), checkbox('Lined', function () { return !!q.lined; },
          function (v) { if (v) q.lined = true; else delete q.lined; }, 'Ruled lines in the work space, for written answers (sentences)'))));
      var n = parts ? q.parts.length : 0;
      var more = h('details', { class: 'gen-more', open: state.partsOpen.has(q) || (!synced && !state.partsClosed.has(q)),
        ontoggle: function (ev) {
          if (ev.target.open) { state.partsOpen.add(q); state.partsClosed.delete(q); }
          else { state.partsOpen.delete(q); state.partsClosed.add(q); }
        } },
        h('summary', { text: (parts ? 'Show the ' + n + (linked ? ' generated' : '') + ' part' + (n === 1 ? '' : 's')
          : 'Show the ' + (linked ? 'generated ' : '') + 'question') + ' (label, answers, steps, edit by hand)' }));
      body.appendChild(more);
      body = more;
    }

    body.appendChild(h('div', { class: 'row' },
      field('Label', textInput(q, 'label', {
        placeholder: 'automatic', emptyDeletes: true
      })),
      h('div', { class: 'field' }, h('span', { text: ' ' }),
        checkbox('No label', function () { return q.numbered === false; }, function (v) {
          if (v) q.numbered = false; else delete q.numbered;
        }, 'Hide the number/label (and skip it in the numbering)'))));
    if (!generated || whole) {
      body.appendChild(field(isQ ? 'Question / instructions' : 'Example', textInput(q, 'prompt', {
        multiline: true, rows: 3, placeholder: isQ ? 'e.g. Write in scientific notation' : 'e.g. Simplify $$\\frac{2.4\\times10^{10}}{3200}$$'
      })));
    }

    var row = h('div', { class: 'row' });
    if (isQ && !generated) {
      row.appendChild(field(many ? 'Marks per part' : 'Marks', numInput(q, 'marks', {
        min: 0, step: 0.5, placeholder: String(state.doc.defaultMarks), title: 'Empty = document default'
      })));
    }
    if (!generated) {
      row.appendChild(field(parts ? 'Work space per part (lines)' : 'Work space (lines)', numInput(q, 'space', {
        min: 0, step: 0.5, placeholder: parts ? (q.boxed === false ? '1' : '2') : (q.table ? '-' : (isQ ? '3' : '4'))
      })));
      if (!q.table) row.appendChild(h('div', { class: 'field' }, h('span', { text: ' ' }), checkbox('Lined', function () { return !!q.lined; },
          function (v) { if (v) q.lined = true; else delete q.lined; }, 'Ruled lines in the work space, for written answers (sentences)')));
    }
    if (!parts && !q.table) {
      row.appendChild(field('Answer (for the key)', textInput(q, 'answer', {
        placeholder: 'e.g. $x = 5$', emptyDeletes: true
      }), 'grow'));
    }
    body.appendChild(row);
    if (isQ) {
      body.appendChild(field(parts ? 'Worked solution for the whole question (teacher key, optional)' : 'Worked solution (teacher key, optional)',
        textInput(q, 'solution', {
          multiline: true, rows: 2, emptyDeletes: true,
          placeholder: 'One step per line, e.g.\n$2^x = 2^{-1}$\n$x = -1$'
        })));
    }

    // Parts
    var partsBox = h('div', { class: 'sub' });
    partsBox.appendChild(h('div', { class: 'row' },
      h('span', { class: 'sub-title', text: 'Parts a), b), c)…' }),
      parts && !generated ? field('Columns', selectInput(q, 'columns', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], { number: true, def: '1' })) : null,
      parts && !generated ? h('div', { class: 'field' }, h('span', { text: ' ' }), checkbox('Boxes', function () { return q.boxed !== false; },
        function (v) { if (v) delete q.boxed; else q.boxed = false; }, 'Draw a box around each part')) : null,
      h('div', { class: 'field' }, h('span', { text: ' ' }), h('div', null,
        h('button', { class: 'btn small', text: '+ Add part', onclick: function () {
          snapshot();
          q.parts = q.parts || [];
          q.parts.push({ prompt: '' });
          changed(true);
          focusLastPart(q);
        } }), ' ',
        h('button', { class: 'btn small', text: 'Bulk edit', title: 'Edit all parts as text, one per line', onclick: function () {
          toggleBulk(q, partsBox);
        } })))));
    if (parts) {
      var list = h('div', { class: 'parts' });
      list.appendChild(h('div', { class: 'part-row head' },
        h('span'), h('span', { text: 'Part' }), h('span', { text: 'Answer' }),
        h('span', { text: isQ ? 'Marks' : '' }), h('span', { text: 'Space' }), h('span', { text: isQ ? 'Steps' : '' }), h('span')));
      q.parts.forEach(function (p, pi) {
        list.appendChild(h('div', { class: 'part-row', 'data-part': pi },
          h('span', { class: 'lbl', text: model.partLabel(pi, p) }),
          textInput(p, 'prompt', { placeholder: 'e.g. $5^{-1} =$', mono: true }),
          textInput(p, 'answer', { placeholder: 'answer', emptyDeletes: true, mono: true }),
          isQ ? numInput(p, 'marks', { min: 0, step: 0.5, placeholder: '' + (q.marks != null ? q.marks : state.doc.defaultMarks) }) : h('span'),
          numInput(p, 'space', { min: 0, step: 0.5, placeholder: 'auto', title: 'Work space (lines) for this part only' }),
          isQ ? h('button', {
            class: 'btn icon' + (p.solution ? ' on' : ''), text: '✎',
            title: 'Worked solution for this part (teacher key)',
            onclick: function () {
              if (state.openSteps.has(p)) state.openSteps.delete(p); else state.openSteps.add(p);
              changed(true);
            }
          }) : h('span'),
          h('button', { class: 'btn icon danger', title: 'Remove part', text: '✕', onclick: function () {
            snapshot();
            q.parts.splice(pi, 1);
            if (!q.parts.length) delete q.parts;
            changed(true);
          } })));
        if (isQ && (state.openSteps.has(p) || p.solution)) {
          list.appendChild(h('div', { class: 'part-steps' },
            textInput(p, 'solution', {
              multiline: true, rows: 2, emptyDeletes: true,
              placeholder: model.partLabel(pi, p) + ' worked solution, one step per line'
            })));
        }
      });
      partsBox.appendChild(list);
    }
    body.appendChild(partsBox);

    // Table inside the question
    var tbox = h('div', { class: 'sub' });
    if (q.table) {
      tbox.appendChild(h('div', { class: 'row' },
        h('span', { class: 'sub-title', text: 'Table' }),
        h('button', { class: 'btn small danger', text: 'Remove table', onclick: function () {
          snapshot(); delete q.table; changed(true);
        } })));
      buildTableEditor(q.table, tbox);
    } else {
      tbox.appendChild(h('button', { class: 'btn small', text: '+ Add a table to this ' + (isQ ? 'question' : 'example'), onclick: function () {
        snapshot();
        q.table = { header: ['', ''], rows: [['', { blank: true, answer: '' }]], rowLabels: true };
        changed(true);
      } }));
    }
    body.appendChild(tbox);
  }

  function focusLastPart(q) {
    var i = state.doc.blocks.indexOf(q);
    var card = document.querySelector('#blocks .card[data-index="' + i + '"]');
    if (!card) return;
    var rows = card.querySelectorAll('.part-row[data-part]');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('input').focus();
  }

  // One part per line: "prompt || answer"
  function toggleBulk(q, box) {
    var existing = box.querySelector('.bulk');
    if (existing) { existing.remove(); return; }
    var ta = h('textarea', { rows: Math.max(4, (q.parts || []).length + 1), spellcheck: 'false' });
    ta.value = (q.parts || []).map(function (p) {
      return p.prompt + (p.answer ? ' || ' + p.answer : '');
    }).join('\n');
    var bulk = h('div', { class: 'bulk' },
      h('p', { class: 'muted', html: 'One part per line. Add the answer after <code>||</code>, e.g. <code>$1000 =$ || $1.0\\times10^3$</code>' }),
      ta,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', text: 'Apply', onclick: function () {
          snapshot();
          var old = q.parts || [];
          var lines = ta.value.split('\n').filter(function (l) { return l.trim() !== ''; });
          q.parts = lines.map(function (l, i) {
            var k = l.indexOf('||');
            var p = old[i] ? JSON.parse(JSON.stringify(old[i])) : {};
            p.prompt = (k >= 0 ? l.slice(0, k) : l).trim();
            var a = k >= 0 ? l.slice(k + 2).trim() : '';
            if (a) p.answer = a; else delete p.answer;
            return p;
          });
          if (!q.parts.length) delete q.parts;
          changed(true);
        } }),
        h('button', { class: 'btn small', text: 'Cancel', onclick: function () { bulk.remove(); } })));
    box.appendChild(bulk);
    ta.focus();
  }

  function buildTableEditor(t, box) {
    model.normalizeTable(t);
    var cols = t.header ? t.header.length : (t.rows[0] ? t.rows[0].length : 1);

    box.appendChild(h('div', { class: 'row' },
      checkbox('Header row', function () { return !!t.header; }, function (v) {
        if (v) { t.header = []; model.normalizeTable(t); } else t.header = null;
      }),
      checkbox('Row labels a) b) c)', function () { return !!t.rowLabels; }, function (v) {
        if (v) t.rowLabels = true; else delete t.rowLabels;
      }),
      field('Row height (lines)', numInput(t, 'rowSpace', { min: 0, step: 0.5, placeholder: 'auto' })),
      field('Column widths', (function () {
        var e = h('input', { type: 'text', placeholder: 'e.g. 4,3,3', title: 'Relative widths, comma separated', style: 'width:110px' });
        e.value = Array.isArray(t.widths) ? t.widths.join(',') : '';
        e.addEventListener('input', function () {
          var w = e.value.split(',').map(function (x) { return +x.trim(); }).filter(function (x) { return x > 0; });
          if (w.length) t.widths = w; else delete t.widths;
          changed(false);
        });
        return e;
      })())));

    function cellEditor(row, ci, isHeader) {
      var c = row[ci];
      var blank = model.isBlankCell(c);
      var input = h('input', { type: 'text', class: 'mono', placeholder: blank ? 'answer' : '' });
      input.value = blank ? (c.answer || '') : (c == null ? '' : String(c));
      trackFocus(input);
      input.addEventListener('input', function () {
        if (model.isBlankCell(row[ci])) row[ci].answer = input.value;
        else row[ci] = input.value;
        changed(false);
      });
      var wrap = h('div', { class: 'cell' + (blank ? ' blank' : '') }, input);
      if (!isHeader) {
        wrap.appendChild(h('button', {
          title: blank ? 'Blank cell (students fill it in). Click to make it a given cell.' : 'Make this a blank cell to fill in',
          text: '▢',
          onclick: function () {
            if (model.isBlankCell(row[ci])) row[ci] = row[ci].answer || '';
            else row[ci] = { blank: true, answer: typeof row[ci] === 'string' ? row[ci] : '' };
            changed(true);
          }
        }));
      }
      return wrap;
    }

    var table = h('table');
    var colHead = h('tr', null, h('th'));
    for (var c = 0; c < cols; c++) {
      (function (ci) {
        colHead.appendChild(h('th', null, 'col ' + (ci + 1) + ' ',
          h('button', { class: 'btn icon small danger', title: 'Delete column', text: '✕', onclick: function () {
            if (cols <= 1) return;
            snapshot();
            if (t.header) t.header.splice(ci, 1);
            t.rows.forEach(function (r) { r.splice(ci, 1); });
            if (t.widths) t.widths.splice(ci, 1);
            changed(true);
          } })));
      })(c);
    }
    table.appendChild(colHead);
    if (t.header) {
      var hr = h('tr', null, h('th', { text: 'header' }));
      for (var hc = 0; hc < cols; hc++) hr.appendChild(h('td', null, cellEditor(t.header, hc, true)));
      table.appendChild(hr);
    }
    t.rows.forEach(function (r, ri) {
      var tr = h('tr', null, h('th', { text: t.rowLabels ? model.rowLabel(ri) : String(ri + 1) }));
      for (var ci = 0; ci < cols; ci++) tr.appendChild(h('td', null, cellEditor(r, ci, false)));
      tr.appendChild(h('td', null, h('button', { class: 'btn icon danger', title: 'Delete row', text: '✕', onclick: function () {
        snapshot(); t.rows.splice(ri, 1); changed(true);
      } })));
      table.appendChild(tr);
    });
    box.appendChild(h('div', { class: 'tbl-edit' }, table));
    box.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn small', text: '+ Row', onclick: function () {
        snapshot();
        var r = [];
        for (var i = 0; i < cols; i++) r.push('');
        t.rows.push(r);
        changed(true);
      } }),
      h('button', { class: 'btn small', text: '+ Column', onclick: function () {
        snapshot();
        if (t.header) t.header.push('');
        t.rows.forEach(function (r) { r.push(''); });
        if (t.widths) t.widths.push(1);
        changed(true);
      } }),
      h('span', { class: 'muted', text: '▢ marks a blank cell; type its answer in the box.' })));
  }

  function buildImageBody(b, body) {
    var file = h('input', { type: 'file', accept: 'image/*' });
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      readImage(f).then(function (url) {
        b.src = url;
        changed(true);
      });
    });
    body.appendChild(h('div', { class: 'row' },
      b.src ? h('img', { class: 'img-thumb', src: b.src, alt: '' }) : null,
      field('Choose image (stored inside the file)', file, 'grow')));
    body.appendChild(h('div', { class: 'row' },
      field('Width (% of page)', numInput(b, 'width', { min: 5, max: 100, step: 5 })),
      field('Align', selectInput(b, 'align', [['center', 'Centre'], ['left', 'Left'], ['right', 'Right']], { structural: false })),
      field('Caption', textInput(b, 'caption', { emptyDeletes: true }), 'grow')));
  }

  // Embed an image as a data URL, shrinking very large photos.
  function readImage(file) {
    var MAX = 1600;
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = reject;
      r.onload = function () {
        var url = r.result;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { resolve(url); return; }
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, MAX / Math.max(img.width, img.height));
          if (scale >= 1 && file.size < 600 * 1024) { resolve(url); return; }
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
        };
        img.onerror = function () { resolve(url); };
        img.src = url;
      };
      r.readAsDataURL(file);
    });
  }

  function buildAddBar() {
    var bar = $('add-bar');
    bar.innerHTML = '';
    if (state.picking) {
      bar.appendChild(WS.genPanel.picker({
        last: state.lastGenerator,
        onAdd: function (g) {
          snapshot();
          state.picking = false;
          state.lastGenerator = g.name;
          var b = { kind: 'question', generator: g };
          state.doc.blocks.push(b);
          state.open.add(b);
          try { WS.generated.regenerate(state.doc, state.doc.blocks.length - 1); }
          catch (e) { alert(e.message || e); }
          buildAddBar();
          changed(true);
          var cards = document.querySelectorAll('#blocks .card');
          var last = cards[cards.length - 1];
          if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        onCancel: function () { state.picking = false; buildAddBar(); }
      }));
      return;
    }
    ['question', 'example', 'text', 'heading', 'table', 'image', 'pageBreak'].forEach(function (k) {
      bar.appendChild(h('button', { class: 'btn', text: '+ ' + KIND_NAMES[k], onclick: function () {
        snapshot();
        var b = model.newBlock(k);
        state.doc.blocks.push(b);
        state.open.add(b);
        changed(true);
        var cards = document.querySelectorAll('#blocks .card');
        var last = cards[cards.length - 1];
        if (last) {
          last.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var inp = last.querySelector('.card-body textarea, .card-body input[type=text]');
          if (inp) inp.focus({ preventScroll: true });
        }
      } }));
    });
    // Ready-made blocks for thinking and reflection (Building Thinking Classrooms).
    var READY = [
      { text: '+ Thinking question', title: 'An open question with room to write a reason or explanation',
        make: function () { return { kind: 'question', prompt: 'Give a reason why …', space: 3 }; } },
      { text: '+ Make your own question', title: 'Students write their own question about the topic, then solve it',
        make: function () {
          return { kind: 'question', prompt: 'Make your own question about … Then solve it.', boxed: false,
            parts: [{ prompt: 'My question:', space: 3 }, { prompt: 'My solution:', space: 5 }] };
        } },
      { text: '+ My notes', title: 'A box for students to write their own notes or summary',
        make: function () { return model.newBlock('notes'); } }
    ];
    READY.forEach(function (r) {
      bar.appendChild(h('button', { class: 'btn ready', text: r.text, title: r.title, onclick: function () {
        snapshot();
        var b = r.make();
        state.doc.blocks.push(b);
        state.open.add(b);
        changed(true);
        var cards = document.querySelectorAll('#blocks .card');
        var last = cards[cards.length - 1];
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }));
    });
    if (WS.generated && WS.generated.available() && WS.genPanel) {
      bar.appendChild(h('button', { class: 'btn', text: '+ Generated question',
        title: 'Pick a kind of question and let the generator write the parts',
        onclick: function () {
          state.picking = true;
          buildAddBar();
          $('add-bar').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } }));
    }
  }

  function buildAll() {
    buildSettings();
    buildBlocks();
    updateStatus();
    schedulePreview(true);
    if (!$('tab-json').hidden) $('json-text').value = JSON.stringify(state.doc, null, 2);
  }

  // ---------- preview <-> editor linking ----------

  function flashPreview(i) {
    var f = document.querySelector('#pages .frag[data-block="' + i + '"]');
    if (!f) return;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    f.classList.remove('flash');
    void f.offsetWidth;
    f.classList.add('flash');
  }

  function onPreviewClick(ev) {
    var f = ev.target.closest('.frag[data-block]');
    if (!f) return;
    var i = +f.dataset.block;
    var b = state.doc.blocks[i];
    if (!b) return;
    showTab('edit');
    state.open.add(b);
    var card = document.querySelector('#blocks .card[data-index="' + i + '"]');
    if (card) {
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- markup insert bar ----------

  var INSERTS = {
    bold: ['**', '**', 'bold'],
    italic: ['*', '*', 'italic'],
    underline: ['__', '__', 'underlined'],
    math: ['$', '$', 'x^2'],
    display: ['\n$$', '$$\n', '\\frac{a}{b}'],
    frac: ['\\frac{', '}{b}', 'a', true],
    pow: ['^{', '}', 'n', true],
    times: ['\\times ', '', '', true],
    div: ['\\div ', '', '', true],
    box: ['[[box: ', ']]', ''],
    boxsup: ['[[box-sup: ', ']]', ''],
    line: ['[[line: ', ']]', ''],
    bullet: ['\n- ', '', 'item']
  };

  function insertMarkup(kind) {
    var e = state.lastField;
    if (!e || !document.body.contains(e)) return;
    var spec = INSERTS[kind];
    var start = e.selectionStart, end = e.selectionEnd;
    var sel = e.value.slice(start, end);
    var before = spec[0], after = spec[1];
    // Math commands outside $...$ get wrapped in $ automatically.
    if (spec[3] && !insideMath(e.value, start)) { before = '$' + before; after = after + '$'; }
    var middle = sel || spec[2];
    e.focus();
    e.setRangeText(before + middle + after, start, end, 'end');
    if (!sel && middle) {
      var s = start + before.length;
      e.setSelectionRange(s, s + middle.length);
    }
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insideMath(text, pos) {
    var count = 0;
    for (var i = 0; i < pos; i++) {
      if (text[i] === '\\') { i++; continue; }
      if (text[i] === '$') count++;
    }
    return count % 2 === 1;
  }

  // ---------- tabs ----------

  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    $('tab-edit').hidden = name !== 'edit';
    $('tab-json').hidden = name !== 'json';
    $('insert-bar').style.display = name === 'edit' ? '' : 'none';
    if (name === 'json') {
      $('json-text').value = JSON.stringify(state.doc, null, 2);
      $('json-error').textContent = '';
    }
  }

  function applyJson() {
    try {
      var doc = model.normalize(JSON.parse($('json-text').value));
      snapshot();
      state.doc = doc;
      state.dirty = true;
      $('json-error').textContent = '';
      buildAll();
      autosave();
      $('json-text').value = JSON.stringify(state.doc, null, 2);
    } catch (e) {
      $('json-error').textContent = e.message;
    }
  }

  // ---------- open / save ----------

  function confirmDiscard() {
    return !state.dirty || window.confirm('You have unsaved changes. Discard them?');
  }

  function loadDoc(doc, meta) {
    meta = meta || {};
    state.doc = model.normalize(doc);
    var problems = WS.generated ? WS.generated.fillEmpty(state.doc) : [];
    model.normalize(state.doc);
    state.fileHandle = meta.fileHandle || null;
    state.fileName = meta.fileName || '';
    state.dirty = !!meta.dirty;
    state.open = new WeakSet();
    state.undo = [];
    $('btn-undo').disabled = true;
    buildAll();
    autosave();
    if (problems.length) setTimeout(function () { alert('Some generated questions could not be made:\n' + problems.join('\n')); }, 0);
  }

  function parseFileText(text, name) {
    var doc;
    try { doc = JSON.parse(text); } catch (e) { throw new Error(name + ' is not valid JSON: ' + e.message); }
    return model.normalize(doc);
  }

  function openFile() {
    if (!confirmDiscard()) return;
    if (window.showOpenFilePicker) {
      window.showOpenFilePicker({
        types: [{ description: 'Worksheet / quiz', accept: { 'application/json': ['.json'] } }]
      }).then(function (handles) {
        var hd = handles[0];
        return hd.getFile().then(function (f) { return f.text(); }).then(function (text) {
          loadDoc(parseFileText(text, hd.name), { fileHandle: hd, fileName: hd.name });
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        alert(e.message || e);
      });
    } else {
      $('file-input').value = '';
      $('file-input').click();
    }
  }

  function openFromFileObject(f) {
    f.text().then(function (text) {
      loadDoc(parseFileText(text, f.name), { fileName: f.name });
    }).catch(function (e) { alert(e.message || e); });
  }

  function suggestedName() {
    var base = stripMarkup(state.doc.title || state.doc.type).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || state.doc.type;
    return state.fileName || base + '.json';
  }

  function save(as) {
    // Generated questions that still match their generator are saved as just the generator line.
    var json = JSON.stringify(WS.generated ? WS.generated.compact(state.doc) : state.doc, null, 2) + '\n';
    var useHandle = !!window.showSaveFilePicker;
    if (useHandle) {
      var getHandle = (!state.fileHandle || as)
        ? window.showSaveFilePicker({
          suggestedName: suggestedName(),
          types: [{ description: 'Worksheet / quiz', accept: { 'application/json': ['.json'] } }]
        })
        : Promise.resolve(state.fileHandle);
      return getHandle.then(function (hd) {
        state.fileHandle = hd;
        return hd.createWritable().then(function (w) {
          return w.write(json).then(function () { return w.close(); });
        }).then(function () {
          state.fileName = hd.name;
          state.dirty = false;
          updateStatus();
          autosave();
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('File System Access save failed, downloading instead', e);
        download(json);
      });
    }
    download(json);
    return Promise.resolve();
  }

  function download(json) {
    var name = suggestedName();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    state.fileName = name;
    state.dirty = false;
    updateStatus();
    autosave();
  }

  function loadExample(file) {
    if (!confirmDiscard()) return;
    fetch(file).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    }).then(function (doc) {
      loadDoc(doc, { fileName: file.split('/').pop() });
    }).catch(function (e) {
      alert('Could not load the example (' + e.message + ').\n' +
        'If you opened this page straight from your disk, use the online version or "Open…" instead.');
    });
  }

  function hasKey() { return !!state.doc && state.doc.answers.key !== 'none'; }

  // Print one document: the handout or the separate teacher key. Each print
  // job is its own PDF, so you can print 30 handouts and one key.
  function print(what) {
    var view = what === 'key' ? 'key' : 'handout';
    if (view === 'key' && !hasKey()) return;
    var previous = state.view;
    state.printing = true;
    setView(view, true).then(function () {
      document.title = stripMarkup(state.doc.title || state.doc.type) + (view === 'key' ? ' – teacher key' : '');
      window.print();
      state.printing = false;
      if (previous !== view) setView(previous); else schedulePreview(true);
    });
  }

  function setView(view, now) {
    state.view = view === 'key' && hasKey() ? 'key' : 'handout';
    $('sel-view').value = state.view;
    renderToken++;
    return now ? renderPreview() : (schedulePreview(true), Promise.resolve());
  }

  function updatePrintButtons() {
    var k = hasKey();
    $('btn-print-key').hidden = !k;
    $('sel-view').querySelector('option[value=key]').disabled = !k;
    if (!k && state.view === 'key') setView('handout');
  }

  // ---------- wiring ----------

  function init() {
    var exSel = $('sel-example');
    EXAMPLES.forEach(function (ex) { exSel.appendChild(h('option', { value: ex.file, text: ex.name })); });
    exSel.addEventListener('change', function () {
      var v = exSel.value; exSel.value = '';
      if (v) loadExample(v);
    });
    $('sel-new').addEventListener('change', function () {
      var v = $('sel-new').value; $('sel-new').value = '';
      if (v && confirmDiscard()) loadDoc(model.newDoc(v));
    });
    $('btn-open').addEventListener('click', openFile);
    $('file-input').addEventListener('change', function () {
      var f = $('file-input').files[0];
      if (f) openFromFileObject(f);
    });
    $('btn-save').addEventListener('click', function () { save(false); });
    $('btn-saveas').addEventListener('click', function () { save(true); });
    $('btn-undo').addEventListener('click', undo);
    $('btn-print').addEventListener('click', function () { print('handout'); });
    $('sel-view').addEventListener('change', function () { setView($('sel-view').value); });
    $('btn-print-key').addEventListener('click', function () { print('key'); });
    $('chk-answers').addEventListener('change', function () {
      state.showAnswers = $('chk-answers').checked;
      schedulePreview(true);
    });
    $('sel-zoom').addEventListener('change', function () {
      $('pages').style.zoom = $('sel-zoom').value;
    });
    $('preview-pane').addEventListener('click', onPreviewClick);
    if (WS.nudge) {
      WS.nudge.attach({
        pane: $('preview-pane'),
        getDoc: function () { return state.doc; },
        enabled: function () { return state.view === 'handout' && !state.printing; },
        commit: function (fn) { snapshot(); fn(); changed(true); },
        refresh: function () { schedulePreview(true); }
      });
    }
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
    $('btn-json-apply').addEventListener('click', applyJson);
    $('btn-json-reset').addEventListener('click', function () { showTab('json'); });
    $('insert-bar').addEventListener('mousedown', function (ev) {
      var b = ev.target.closest('button[data-ins]');
      if (!b) return;
      ev.preventDefault(); // keep focus in the text field
      if (b.dataset.ins === 'mathlive') { if (WS.mathInput) WS.mathInput.open(state.lastField); }
      else insertMarkup(b.dataset.ins);
    });

    document.addEventListener('keydown', function (ev) {
      var mod = ev.ctrlKey || ev.metaKey;
      if (!mod) return;
      var k = ev.key.toLowerCase();
      if (k === 's') { ev.preventDefault(); save(ev.shiftKey); }
      else if (k === 'o') { ev.preventDefault(); openFile(); }
      else if (k === 'p') { ev.preventDefault(); print(state.view); }
      else if (k === 'm' && WS.mathInput && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) &&
        document.activeElement.closest('#tab-edit')) {
        ev.preventDefault(); WS.mathInput.open(document.activeElement);
      }
      else if (k === 'z' && !ev.shiftKey && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        ev.preventDefault(); undo();
      }
    });
    window.addEventListener('beforeunload', function (ev) {
      if (state.dirty && !state.fileHandle) { /* autosaved; still warn */ }
      if (state.dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });

    // Drag and drop a .json file anywhere to open it.
    var hint = null;
    window.addEventListener('dragover', function (ev) {
      if (!ev.dataTransfer || [].indexOf.call(ev.dataTransfer.types, 'Files') < 0) return;
      ev.preventDefault();
      if (!hint) { hint = h('div', { class: 'drop-hint', text: 'Drop a worksheet / quiz .json file to open it' }); document.body.appendChild(hint); }
    });
    window.addEventListener('dragleave', function (ev) {
      if (ev.relatedTarget == null && hint) { hint.remove(); hint = null; }
    });
    window.addEventListener('drop', function (ev) {
      if (hint) { hint.remove(); hint = null; }
      var f = ev.dataTransfer && ev.dataTransfer.files[0];
      if (!f) return;
      ev.preventDefault();
      if (/\.json$/i.test(f.name) || f.type === 'application/json') {
        if (confirmDiscard()) openFromFileObject(f);
      }
    });

    buildAddBar();

    // Restore the last session, if any.
    var restored = false;
    try {
      var saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
      if (saved && saved.doc) {
        loadDoc(saved.doc, { fileName: saved.fileName, dirty: saved.dirty });
        restored = true;
      }
    } catch (e) { /* ignore broken autosave */ }
    if (!restored) loadDoc(model.newDoc('worksheet'));

    // Page size for printing follows the document.
    var applyPaper = function () {
      $('page-size').textContent = '@page { size: ' + (state.doc.paper === 'a4' ? 'A4' : 'letter') + '; margin: 0; }';
    };
    window.addEventListener('beforeprint', applyPaper);
    applyPaper();
  }

  WS.editor = { state: state, loadDoc: loadDoc, renderPreview: renderPreview };
  document.addEventListener('DOMContentLoaded', init);
})(window.WS = window.WS || {});
