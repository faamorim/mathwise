# Graph format (v1)

A **graph** is a plain JSON object that describes a Cartesian plane and what is drawn on
it. Generators and hand-made files write graphs; pages (the worksheet editor, later the
practice page) draw them. This file is a shared contract, like `docs/generator-api.md`:
adding an optional field is free; renaming or removing one needs Francisco's OK.

Who does what:

| Part | Owner |
| --- | --- |
| This format, `generators/graph.js` (checking a graph, turning a function into points) | Shared (generator library) |
| Drawing (SVG at print size), placing a graph beside or below text, editing graphs by hand | Editor |

`generators/graph.js` is there so no page has to parse maths: a page calls
`Mathwise.graph.sample(graph)` and draws the lines, dots and labels it returns.

## Where a graph goes

- `graph` on a question block, on a part, or on an item from `generate`/`render`: shown
  with that prompt.
- Anything that belongs only in the teacher key has `"key": true` (a single item, or the
  whole graph). So "Graph $y=2x+1$" carries an empty plane for the student and the line
  as a `key` item: the handout shows the empty grid, the key shows the answer on it.
- `place` (optional): `"below"` (default), `"right"` or `"left"` of the text. A hint; the
  page decides the final layout (for example a row of small graphs A–D for matching).

## The object

```json
{
  "size": [6, 6],
  "x": { "min": -6, "max": 6, "grid": 1, "numbers": 2, "label": "x" },
  "y": { "min": -6, "max": 6, "grid": 1, "numbers": 2, "label": "y" },
  "title": "Distance from home",
  "items": [
    { "type": "function", "expr": "2x+1", "label": "$y=2x+1$", "key": true },
    { "type": "points", "points": [[0, 1], [1, 3]], "key": true }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `size` | `[width, height]` of the plotting area in cm (default `[6, 6]`). |
| `x`, `y` | Axes, below. Required: `min` < `max`. |
| `grid` (top level) | `false` hides the grid lines (default shown). |
| `axes` | `"zero"` (default): axes cross at 0, or at the edge when 0 is out of range. `"edge"`: axes along the bottom and left (first-quadrant style). `"none"`: no axes (qualitative sketches). |
| `arrows` | Arrow heads on the axis ends (default `true` for `"zero"`, `false` for `"edge"`). |
| `title` | Text above the graph (worksheet markup, may contain `$…$`). |
| `key` | `true`: the whole graph is teacher-key only. |
| `place` | `"below"`, `"right"`, `"left"` (hint). |
| `items` | What is drawn, in order (later items on top). |

**Axis** `{ min, max, grid, numbers, label, title, start, ticks }`:

| Field | Meaning |
| --- | --- |
| `min`, `max` | Range shown. |
| `grid` | Grid line every this many units (default 1). |
| `numbers` | Number every this many units, `false` for none (default: same as `grid`). Numbers are multiples of it. |
| `label` | Short name at the axis end: `"x"`, `"y"`, `"$t$"`, `"d"`. |
| `title` | Longer title along the axis, with units: `"Time (h)"`, `"Mass (g)"` (the y title is drawn rotated). |
| `break` | `true`: draw a zigzag break near the origin (the axis does not start at 0). |
| `ticks` | Custom tick texts instead of numbers: `[{ "at": 0, "text": "8:00" }, …]`. |

## Items

All items may have `key: true` (teacher key only) and `label` (text near the item;
worksheet markup).

**function** `{ type: "function", expr, domain?, ends?, style? }`

- `expr`: the right side of `y = …`, in the small expression language below: `"2x+1"`,
  `"-1/2x+3"`, `"x^2-4"`, `"sqrt(x+2)"`, `"abs(x)-3"`.
- `domain`: `[from, to]`; default the whole x range.
- `ends`: `[left, right]`, each `"arrow"`, `"closed"` (filled dot), `"open"` (hollow dot)
  or `"none"`. Default `["arrow", "arrow"]` when the domain is the whole range, otherwise
  `["closed", "closed"]`.
- `style`: `"solid"` (default) or `"dashed"`.

**points** `{ type: "points", points: [[x, y], [x, y, "A"], …], join?, dots? }`

- A third entry is the point's name, written beside it.
- `join`: `"none"` (default), `"segments"` (straight lines in order: distance–time,
  piecewise), `"smooth"` (a smooth curve through them).
- `dots`: `"closed"` (default), `"open"`, `"none"`.

**segment** `{ type: "segment", from: [x, y], to: [x, y], ends? }`: one line piece;
`ends` as for functions (default `["none", "none"]`). Step functions are several
segments with open/closed ends.

**text** `{ type: "text", at: [x, y], text }`: free text on the plane.

## Expression language

Numbers (`3`, `0.5`), the variable `x`, `+ - * / ^`, brackets, and `sqrt`, `abs`.
A number or bracket right before `x` or a bracket multiplies (`2x`, `3(x-1)`).
`-1/2x` means $-\frac12 x$ (a fraction coefficient: `/` before `x` binds to the number,
like on the board). Anything else is an error from `Mathwise.graph.check`.

## Library helpers (`generators/graph.js`)

| Function | Gives |
| --- | --- |
| `Mathwise.graph.check(graph)` | Friendly messages (empty list when the graph is fine). |
| `Mathwise.graph.compile(expr)` | A function `x -> y` (throws on a bad expression). |
| `Mathwise.graph.sample(graph, { key })` | What to draw, in graph units, with key items left out unless `key` is true: `{ lines: [{ points: [[x,y],…], style, ends, label, key }], dots: [{ at, open, label, key }], texts: [{ at, text, key }] }`. Function curves are cut where they leave the plane or are undefined. |
| `Mathwise.graph.ticks(axis)` | The numbered tick positions (and texts) of an axis. |
