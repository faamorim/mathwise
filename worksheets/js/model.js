/*
 * Document model helpers: defaults, normalisation, numbering, marks and the
 * answer key. See docs/worksheet-format.md for the format itself.
 */
(function (WS) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var STANDARD_FIELDS = ['name', 'date', 'period', 'block'];
  var HANDOUT_ANSWERS = ['none', 'final'];
  var KEY_MODES = ['none', 'final', 'worked', 'both'];
  var BLOCK_KINDS = ['heading', 'text', 'example', 'question', 'table', 'image', 'notes', 'pageBreak'];

  function letter(i) {
    // a, b, ..., z, aa, ab, ...
    var s = '';
    i += 1;
    while (i > 0) {
      var r = (i - 1) % 26;
      s = String.fromCharCode(97 + r) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function newDoc(type) {
    type = type === 'quiz' ? 'quiz' : 'worksheet';
    return normalize({
      schemaVersion: SCHEMA_VERSION,
      type: type,
      title: type === 'quiz' ? 'New quiz' : 'New worksheet',
      header: {
        fields: ['name', 'date'],
        showGrade: type === 'quiz',
        custom: []
      },
      blocks: [
        { kind: 'question', prompt: 'Simplify', columns: 2, parts: [
          { prompt: '$2^3 \\times 2^4 =$', answer: '$2^7$' },
          { prompt: '$5^6 \\div 5^2 =$', answer: '$5^4$' }
        ] }
      ]
    });
  }

  function newBlock(kind) {
    switch (kind) {
      case 'heading': return { kind: 'heading', text: 'Heading', align: 'left' };
      case 'text': return { kind: 'text', content: '' };
      case 'example': return { kind: 'example', prompt: '', space: 4 };
      case 'question': return { kind: 'question', prompt: '', space: 3 };
      case 'table': return {
        kind: 'table',
        header: ['', ''],
        rows: [['', ''], ['', '']]
      };
      case 'image': return { kind: 'image', src: '', width: 50, align: 'center', caption: '' };
      case 'notes': return { kind: 'notes', title: 'In my own words', prompt: 'Write (or sketch) what you learned today, as if explaining it to a friend.', lines: 6 };
      case 'pageBreak': return { kind: 'pageBreak' };
    }
    throw new Error('Unknown block kind: ' + kind);
  }

  // Fill in defaults so the rest of the code can rely on the shape. Unknown
  // properties are kept untouched (forward compatibility, generator metadata).
  function normalize(doc) {
    if (!doc || typeof doc !== 'object') throw new Error('Not a worksheet/quiz document.');
    doc.schemaVersion = doc.schemaVersion || SCHEMA_VERSION;
    doc.type = doc.type === 'quiz' ? 'quiz' : 'worksheet';
    if (typeof doc.title !== 'string') doc.title = '';
    var h = doc.header = doc.header || {};
    if (!Array.isArray(h.fields)) h.fields = [];
    h.fields = h.fields.filter(function (f) { return STANDARD_FIELDS.indexOf(f) >= 0; });
    if (typeof h.showGrade !== 'boolean') h.showGrade = doc.type === 'quiz';
    if (!Array.isArray(h.custom)) h.custom = [];
    h.custom.forEach(function (c) {
      if (typeof c.label !== 'string') c.label = '';
      if (['s', 'm', 'l'].indexOf(c.width) < 0) c.width = 'm';
    });
    if (typeof h.repeat !== 'boolean') h.repeat = doc.type === 'quiz';
    var f = doc.footer = doc.footer || {};
    if (typeof f.pageNumbers !== 'boolean') f.pageNumbers = true;
    if (!isNum(doc.defaultMarks)) doc.defaultMarks = 1;
    // answers.handout: 'none' | 'final'  (an answers page inside the handout)
    // answers.key:     'none' | 'final' | 'worked' | 'both'  (separate key; both = answers page, then worked)
    // answers.keyTitle: 'teacher' (default, "Teacher key") | 'solutions' ("Solutions", to hand to students)
    var a = doc.answers && typeof doc.answers === 'object' ? doc.answers : {};
    if (!a.handout && !a.key && doc.answerKey != null) {
      // Older drafts used a single answerKey setting.
      if (doc.answerKey === 'included') a.handout = 'final';
      if (doc.answerKey === true || doc.answerKey === 'separate') a.key = 'final';
    }
    delete doc.answerKey;
    if (HANDOUT_ANSWERS.indexOf(a.handout) < 0) a.handout = 'none';
    if (KEY_MODES.indexOf(a.key) < 0) a.key = doc.type === 'quiz' ? 'final' : 'none';
    if (a.keyTitle !== 'solutions') delete a.keyTitle;
    doc.answers = a;
    if (doc.paper !== 'a4') doc.paper = 'letter';
    if (doc.theme != null && (typeof doc.theme !== 'object' || Array.isArray(doc.theme))) delete doc.theme;
    if (!Array.isArray(doc.blocks)) doc.blocks = [];
    doc.blocks = doc.blocks.filter(function (b) {
      return b && BLOCK_KINDS.indexOf(b.kind) >= 0;
    });
    doc.blocks.forEach(normalizeBlock);
    return doc;
  }

  function normalizeTable(t) {
    if (!Array.isArray(t.rows)) t.rows = [];
    if (t.header != null && !Array.isArray(t.header)) t.header = null;
    var cols = Math.max(t.header ? t.header.length : 0, 1);
    t.rows.forEach(function (r) { cols = Math.max(cols, r.length); });
    if (t.header) while (t.header.length < cols) t.header.push('');
    t.rows.forEach(function (r) { while (r.length < cols) r.push(''); });
    return t;
  }

  function normalizeBlock(b) {
    if (b.kind === 'question' || b.kind === 'example') {
      if (typeof b.prompt !== 'string') b.prompt = '';
      if (b.parts != null && !Array.isArray(b.parts)) b.parts = null;
      if (b.parts) b.parts.forEach(function (p) { if (typeof p.prompt !== 'string') p.prompt = ''; });
      if (b.table) normalizeTable(b.table);
    }
    if (b.kind === 'table') normalizeTable(b);
    if (b.kind === 'text' && typeof b.content !== 'string') b.content = '';
    if (b.kind === 'heading' && typeof b.text !== 'string') b.text = '';
    if (b.kind === 'notes') {
      if (typeof b.title !== 'string') b.title = '';
      if (typeof b.prompt !== 'string') b.prompt = '';
      if (!isNum(b.lines) || b.lines < 0) b.lines = 6;
    }
  }

  function hasParts(q) { return Array.isArray(q.parts) && q.parts.length > 0; }

  function isBlankCell(c) { return c && typeof c === 'object' && c.blank; }

  function tableBlanks(t) {
    var out = [];
    if (!t || !t.rows) return out;
    t.rows.forEach(function (r, ri) {
      r.forEach(function (c, ci) { if (isBlankCell(c)) out.push({ row: ri, col: ci, cell: c }); });
    });
    return out;
  }

  // Marks: a question's `marks` is the per-part value when it has parts or a
  // table with blank cells; otherwise it is the question's own value.
  function partMarks(p, q, doc) {
    if (isNum(p.marks)) return p.marks;
    if (isNum(q.marks)) return q.marks;
    return doc.defaultMarks;
  }

  function questionMarks(q, doc) {
    if (q.kind !== 'question') return 0;
    var per = isNum(q.marks) ? q.marks : doc.defaultMarks;
    var parts = hasParts(q);
    var blanks = tableBlanks(q.table).length;
    if (!parts && !blanks) return per;
    var total = 0;
    if (parts) q.parts.forEach(function (p) { total += partMarks(p, q, doc); });
    total += blanks * per;
    return total;
  }

  function round(n) { return Math.round(n * 1000) / 1000; }

  function totalMarks(doc) {
    var t = 0;
    doc.blocks.forEach(function (b) { t += questionMarks(b, doc); });
    return round(t);
  }

  function gradeTotal(doc) {
    return isNum(doc.header.gradeTotal) ? doc.header.gradeTotal : totalMarks(doc);
  }

  // Labels like "1)", "EX2". Questions/examples with `label` keep it; others
  // are numbered in order. `numbered: false` hides the label.
  function labels(doc) {
    var q = 0, ex = 0;
    return doc.blocks.map(function (b) {
      if (b.kind === 'question') {
        if (b.numbered === false) return '';
        q++;
        return b.label != null && b.label !== '' ? b.label : q + ')';
      }
      if (b.kind === 'example') {
        if (b.numbered === false) return '';
        ex++;
        return b.label != null && b.label !== '' ? b.label : 'EX' + ex;
      }
      return '';
    });
  }

  function partLabel(i, p) {
    return p && p.label ? p.label : letter(i) + ')';
  }

  function rowLabel(i) { return letter(i) + ')'; }

  function answerOf(item) {
    if (item.answer != null && String(item.answer).trim() !== '') return String(item.answer);
    var inl = WS.markup.blankAnswers(item.prompt);
    return inl.length ? inl.join(', ') : '';
  }

  // [{label: "1)", items: [{label: "a)", answer: "..."}]}]
  function answerKey(doc) {
    var labs = labels(doc);
    var out = [];
    doc.blocks.forEach(function (b, i) {
      if (b.kind !== 'question') return;
      var items = [];
      var own = answerOf(b);
      var sol = function (x) { return x.solution && String(x.solution).trim() ? String(x.solution) : ''; };
      if (own || sol(b)) items.push({ label: '', answer: own, solution: sol(b), prompt: '' });
      if (hasParts(b)) {
        b.parts.forEach(function (p, pi) {
          var a = answerOf(p);
          if (a || sol(p)) items.push({ label: partLabel(pi, p), answer: a, solution: sol(p), prompt: p.prompt });
        });
      }
      if (b.table) {
        var byRow = {};
        tableBlanks(b.table).forEach(function (bl) {
          if (!bl.cell.answer) return;
          (byRow[bl.row] = byRow[bl.row] || []).push(bl.cell.answer);
        });
        Object.keys(byRow).forEach(function (r) {
          items.push({
            label: b.table.rowLabels ? rowLabel(+r) : 'row ' + (+r + 1) + ':',
            answer: byRow[r].join('; ')
          });
        });
      }
      if (items.length) out.push({ label: labs[i] || '•', blockIndex: i, prompt: b.prompt, items: items });
    });
    return out;
  }

  WS.model = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    STANDARD_FIELDS: STANDARD_FIELDS,
    BLOCK_KINDS: BLOCK_KINDS,
    HANDOUT_ANSWERS: HANDOUT_ANSWERS,
    KEY_MODES: KEY_MODES,
    newDoc: newDoc,
    newBlock: newBlock,
    normalize: normalize,
    normalizeBlock: normalizeBlock,
    normalizeTable: normalizeTable,
    hasParts: hasParts,
    isBlankCell: isBlankCell,
    tableBlanks: tableBlanks,
    questionMarks: questionMarks,
    totalMarks: totalMarks,
    gradeTotal: gradeTotal,
    labels: labels,
    partLabel: partLabel,
    rowLabel: rowLabel,
    answerKey: answerKey,
    letter: letter
  };
})(window.WS = window.WS || {});
