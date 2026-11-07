# Worksheet & quiz file format

Worksheets and quizzes are the same kind of file: one `.json` file per document.
The formal definition is [`schema/worksheet.schema.json`](../schema/worksheet.schema.json);
this page explains it with examples. Full examples live in [`examples/`](../examples).

```json
{
  "schemaVersion": 1,
  "type": "quiz",
  "title": "(5+) Math 9  Powers Quiz",
  "header": {
    "fields": ["name"],
    "showGrade": true,
    "gradeLabel": "Quiz",
    "custom": [{ "label": "Group", "width": "s" }],
    "repeat": true
  },
  "footer": { "pageNumbers": true },
  "defaultMarks": 0.5,
  "answers": { "handout": "none", "key": "worked" },
  "paper": "letter",
  "blocks": [
    { "kind": "text", "content": "Each question is 0.5 mark. Good luck ☺" },
    { "kind": "question", "prompt": "Evaluate", "columns": 3, "space": 1,
      "parts": [
        { "prompt": "$5^{-1} =$", "answer": "$\\frac{1}{5}$" },
        { "prompt": "$2^{-3} =$", "answer": "$\\frac{1}{8}$" }
      ] }
  ]
}
```

## Document

| Property | Meaning |
|---|---|
| `type` | `"worksheet"` or `"quiz"`. Only changes defaults (grade label, repeating header). |
| `title` | Printed at the top of every page. |
| `header.fields` | Any of `name`, `date`, `period`, `block`, in that order. |
| `header.showGrade` | Adds `Quiz: ____ / 28`. The total is **calculated** from the marks. |
| `header.gradeLabel` | Text before the grade blank (default `Quiz` / `Mark`). |
| `header.gradeTotal` | Optional fixed total instead of the calculated one. |
| `header.custom` | Extra blanks: `{ "label": "Group", "width": "s" }` (`s`, `m`, `l`). |
| `header.repeat` | Repeat the blanks on every page (the title always repeats). |
| `footer.pageNumbers` | `1 out of 3` at the bottom of each page. |
| `defaultMarks` | Marks for any question / part that doesn't set its own. |
| `showMarks` | Print `[2 marks]` next to each question. |
| `answers.handout` | `"final"` adds an answers page at the end of the handout, counted in the page numbers (good for practice worksheets). Default `"none"`. |
| `answers.key` | A **separate teacher key**, printed as its own document with *Print key*: `"final"` (answers only, default for quizzes), `"worked"` (each question with its worked solution and answer) or `"none"` (default for worksheets). |
| `paper` | `"letter"` or `"a4"`. |

## Blocks

`blocks` is the ordered body. Each block has a `kind`:

| kind | Properties |
|---|---|
| `heading` | `text`, `size` (`s`/`m`/`l`), `align` |
| `text` | `content` (rich text, see below), `align` |
| `question` | `prompt`, `marks`, `space`, `answer`, `solution`, `parts`, `columns`, `boxed`, `table`, `label`, `numbered` |
| `example` | Same as a question, labelled EX1, EX2… and never marked. |
| `table` | `header`, `rows`, `rowLabels`, `widths`, `rowSpace` |
| `image` | `src` (embedded `data:` URL), `width` (% of page), `align`, `caption` |
| `pageBreak` | Starts a new page. |

### Questions

* Questions are numbered `1)`, `2)`… automatically. `label` overrides it, `"numbered": false` hides it.
* `space` is the work space in **lines** (≈ 8 mm each). With parts, it is the space under *each* part.
* `parts` are lettered a), b), c)… and laid out in a grid of `columns` (1–4).
  `"boxed": false` drops the boxes (good for word problems with sub-parts).
  Each part may set its own `answer`, `solution`, `marks`, `space` and `label`.
* `solution` (on a question or a part) holds worked steps, one per line. It only appears in a
  worked teacher key, never on the student handout.
* **Marks**: a question without parts is worth `marks`. With parts (or blank table cells),
  `marks` is the value of *each* part / blank cell. Anything unset uses `defaultMarks`.
* A question can carry a `table` (same shape as a table block) whose blank cells students fill in.
* Long question groups and tables continue on the next page, row by row.

### Tables

```json
{ "kind": "table", "rowLabels": true, "widths": [5, 3, 3],
  "header": ["Physical quantity", "Decimal notation", "Scientific notation"],
  "rows": [["Mass of an electron", { "blank": true, "answer": "0.000…92 g" }, "$9.2\\times10^{-28}$ g"]] }
```

A cell is either text, or `{ "blank": true, "answer": "…" }` for a cell students fill in.

## Rich text (every text field)

| Write | Get |
|---|---|
| `**bold**`, `*italic*`, `__underline__` | formatting |
| `$x^2$` | inline math (LaTeX, rendered with KaTeX) |
| `$$\frac{a}{b}$$` | math on its own line |
| `- item` / `1. item` | bullet / numbered list |
| blank line | new paragraph (a single newline is a line break) |
| `[[box]]`, `[[box: 1.2]]` | fill-in box, optionally storing its answer |
| `[[box-sup: 11]]` | small raised box, for an exponent |
| `[[line]]`, `[[line-s]]`, `[[line-l]]`, `[[line: answer]]` | answer line (medium / short / long) |
| `\$` | a literal dollar sign |

Answers stored in blanks go into the answer key, and appear in red when
"Show answers" is ticked (teacher copy). If a part has an `answer` and its prompt
has an empty blank, the answer is shown in that blank.

## Typing math

Math is LaTeX between `$…$` (or `$$…$$` on its own line). In the editor, **√ Math** in the
Insert bar (or Ctrl+M in a text box) opens a visual math editor (MathLive): type `/` for a
fraction, `^` for a power, `*` for ×, or use its on-screen math keyboard. With the cursor
inside existing math it edits that math; otherwise it inserts new `$…$`. The file still
stores plain LaTeX.

## Thinking and reflection blocks

- Work space is blank by default, so students can write, draw or sketch. `"lined": true`
  on a question (or one part) draws ruled lines instead, one per line of `space`.
- A `notes` block is a box for the student's own words (notes, a summary, a note to their
  future self): `{ "kind": "notes", "title": "In my own words", "prompt": "…", "lines": 6 }`
  (`lines` is its height; add `"lined": true` for ruled lines). Not numbered or marked.
- The editor's **Add block** has ready-made ones: **Thinking question** (an open question
  with room to answer), **Make your own question** (a part to write the question and a part
  to solve it) and **My notes**.
- `"compact": true` on the document leaves out all work space under questions and parts,
  for a short sheet where students work on separate paper (fill-in blanks and notes boxes
  stay). The handout also drops a trailing `=` from prompts, leaves out part boxes, puts
  short parts three or four to a row and tightens the gaps; the teacher key is unchanged.
  In the editor: Document › *Compact*.

## Look (themes)

How the pages look is kept apart from what they say. A document may have
`"theme": { "name": "rounded", "corners": 4 }`: a built-in theme (`classic`, `rounded`,
`soft`, `serif`, `bold`) plus any setting changed from it: `font` (`sans`, `serif`,
`rounded`, `friendly`, `mono`), `fontSize` (pt), `ink`, `accent` (titles, headings and
question labels), `rule` (lines and boxes), `lineWidth` (px), `boxes` (`grid` = joined
part boxes, `cards` = a separate box per part), `corners` (pt, for cards and fill-in
boxes) and `shade` (box fill). No `theme` means Classic, the original look.

In the editor the **Look** panel picks the theme and changes its settings (a • marks a
changed setting). **Save theme…** writes the look to its own `.json` file
(`{ "mathwiseTheme": 1, … }`) and **Load theme…** applies one to another worksheet. Fonts
come from the computer that prints: when a font is not installed the next one in its list
is used. A theme can change how many pages a document takes (cards need a little more
room), so check the preview after switching.

The renderer only calls `WS.themes.apply(pages, doc.theme)`, which sets CSS variables
(`--font`, `--font-size`, `--ink`, `--accent`, `--rule`, `--lw`, `--radius`, `--shade`) and
the `boxes-cards` class; `css/sheet.css` reads them.

## Adjusting the layout from the preview

In the handout preview, hover a work area and drag the blue bar at its bottom edge to
change the work space (¼-line steps). On a part this sets the space of every part of the
question (`space`); hold **Shift** to set only that part (`parts[i].space`). In a table,
drag the bar on a column's right edge to change `widths`. Double-click a bar to go back to
the default. Each drag can be undone.

## Generated questions

A question block may carry a `generator` object
(`{ "name": "powers.monomials", "params": {…}, "seed": "unit3/8", "count": 4 }`) recording
how it was produced; its exact form and the seed rule are in
[generator-api.md](generator-api.md). Blocks may also carry an `id`. The editor keeps
unknown properties as they are.

In the editor:

- **+ Generated question** (Add block) opens a picker: choose the kind of question
  (grouped by topic), its settings and the number of parts, see a sample, then add it.
- A generated question's card shows **Settings** built from the generator's own
  parameters (numbers, choices, sets of forms, on/off). A change is checked first and
  explained if it is not allowed; otherwise the parts are made again.
  **Reset to defaults** removes the stored `params`.
- Only values that differ from the defaults are stored when a question is added; a
  setting changed later is stored as its real value.
- **✂ Unlink to edit numbers** keeps a generated question's parts but stops using the
  seed (stored as `template`, see generator-api.md §6). Each part then shows its values
  (base, exponents, operation, …): change one and the question, answer and worked steps
  follow. Text you type over by hand is kept as an override (marked "your text"; click it
  to go back to the template's text) and may use `%name%` placeholders that follow the
  values. **+ Add part like these** picks one more part with the same settings.
