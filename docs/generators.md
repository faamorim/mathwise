# Problem generators

Generators live in `generators/` as classic scripts (no build, work from `file://`).
Pages load just `generators/index.js`, which lists and loads `core.js` and every
generator file; they register on `window.Mathwise.generators`. To add a generator file,
add it to the list in `generators/index.js` (no page needs editing).

What pages may rely on, folder ownership and how the contract changes are in
[`generator-api.md`](generator-api.md) (Generator API v1).

## Using one

```js
const G = Mathwise.generators;
G.generate('powers.product-quotient', { bases: ['variable'] }, 'my-seed', { output: 'steps' });
// -> { prompt: '$p^{-7}\\div p^2 =$', answer: '$p^{-9}$', steps: ['$= p^{-7-2}$'], workSpace: 1.5 }
```

- `output`: `steps` (default), `answer`, or `none` (question only).
- The seed is always passed in. Same name + params + seed = same question.
- Math is LaTeX inside `$…$`. Steps are one line each, one rule per line.

## In a worksheet or quiz

A question block can carry a generator instead of hand-written parts:

```json
{ "kind": "question", "prompt": "Simplify",
  "generator": { "name": "powers.monomials", "params": { "terms": 2 }, "seed": "unit3/8", "count": 4 } }
```

The prompt is optional: each generator has default instructions ("Simplify", "Solve"…).
A whole recipe can be this short:

```json
{ "type": "quiz", "title": "Powers practice", "seed": "period-2",
  "blocks": [
    { "kind": "question", "generator": { "name": "powers.negative-exponent", "count": 9 } },
    { "kind": "question", "generator": { "name": "powers.solve-exponential", "count": 6 } }
  ] }
```

**In the editor:** open a file whose generated blocks have no parts (a short
"recipe") and they are filled in when it opens. Each generated question shows its
generator, its seed, how many parts, and a **New seed** button that rerolls just that
question (Undo brings the old one back). The document settings have a quiz seed and
a **New version** button that gives every generated question new numbers. Saving
writes a generated question as just its `generator` line while it still matches what
the generator makes; a question changed by hand is saved with all its text and is
never overwritten without asking.

**Seeds:** a block's own `generator.seed` wins; without one, the block uses the
document's `seed` plus its position (`"<seed>/<block number>"`), so one quiz seed can
drive the whole quiz. Moving a block without its own seed changes its numbers.

`node tools/generate.js recipe.json out.json` fills every such block (parts get
`prompt`, `answer` and the worked `solution`), keeping the `generator` field so the
block can be rebuilt. `--seed something-new` sets a new document seed (and clears block
seeds), giving a fresh version with new numbers.
Part *i* is built from seed `"<seed>:<i>"`; repeated prompts in a block are re-rolled.
Forms chosen in a `set` parameter are spread across the parts in the listed order.

Example: `examples/recipes/math9-powers-practice-quiz.json` ->
`examples/math9-powers-practice-quiz-generated.json`.

## Generators

| Name | Makes | Main parameters |
| --- | --- | --- |
| `powers.negative-exponent` | Evaluate $2^{-3}$, $10^{-4}$, $(\frac14)^{-2}$, $\frac{3}{4^{-2}}$, $(0.5)^{-2}$ | forms, largest exponent, largest value |
| `powers.product-quotient` | $7^{-8}\div7^2$, $p^{-7}\div p^2$ | base (number / negative / variable), ×÷, exponent size, negatives |
| `powers.power-of-power` | $(y^4)^2\times(y^{-2})^3$ | base, ×÷, exponent size, negatives |
| `powers.monomials` | $12t^4\div3t^{-3}$, 3-term chains | terms, ×÷, coefficient size, negative coefficients, exponent size |
| `powers.evaluate-mixed` | $5^2+5^{-1}$, $(2\times3)^{-2}$, $3^{-1}+3^{-2}$, $(2^2-1)^{-2}$ | forms |
| `powers.positive-exponents` | $\frac{1}{100}$, $\frac{1}{-32}$, $0.125$ as powers | forms, largest denominator |
| `powers.order` | Write as powers of one base, put in order (whole question) | base, how many, largest denominator |
| `powers.solve-exponential` | $2^x=\frac12$, $x^{-3}=\frac1{125}$, $10^{2-x}=0.001$, $9^{1+x}=27$ | forms |
| `sci.to-scientific` | $3700000$, $0.0000001$ | large/small, digits, exponent size |
| `sci.normalize` | $247\times10^8$, $0.087\times10^3$ | too big/too small, digits, exponent size |
| `sci.find-exponent` | $0.0000563=5.63\times10^n$ | large/small, digits, exponent size |
| `sci.multiply-divide` | $(3\times10^4)(2\times10^5)$, $\dfrac{8\times10^{-3}}{2\times10^5}$; answers that need the decimal point moved ($20\times10^9$) | ×÷, significant digits, exponent size, negative exponents, answers that need fixing (some / none / all) |
| `algebra.substitution` | Evaluate $-a^{-1}$, $(a+b+c)^{-1}$, $a^b$, $\left(\frac{2a}{b+c}\right)^{-3}$ for $a=-2,\ b=3,\ c=-4$ (whole question) | expression types, how many, size of the values, negative values. Unlinked, the teacher can type any expression in a, b, c |
| `factoring.gcf` | $6x^5-16x^4+12x^2 = 2x^2(3x^3-8x^2+6)$ | terms, size of the common factor, variable in it, negatives |
| `factoring.difference-of-squares` | $16x^2-9$, $x^6-25$ | square coefficient, largest root, higher powers |
| `factoring.perfect-square` | $9x^2+24x+16$, $x^2-6x+9$ | square coefficient, largest root, negative middle |
| `factoring.trinomial` | $x^2-3x-10$, $7x^2+52x+21$, $6x^2+7x-3$ | leading coefficient (1 / prime / several factors), number size, negatives, **methods** (cross method, sum and product; tick both to print both) |
| `factoring.four-term` | $3x^3+18x^2+8x+48 = (x+6)(3x^2+8)$ | number size, coefficient, negatives |
| `factoring.full` | $-2x^4+8x^2 = -2x^2(x+2)(x-2)$, $2x^2+20x+50 = 2(x+5)^2$ | what is left (trinomial / difference of squares / perfect square / four terms), common factor size and variable, negative leading term, factor-twice ($x^4-16$), trinomial settings |
| `factoring.mixed` | Any of the above, shuffled; the key starts with how to recognise the type | question types, trinomial settings |
| `linear.graph-line` | Graph $y=-\frac23x+1$: empty grid for the student, the line and a table of points in the key | slopes (whole / fractions / zero), negative slopes, largest y-intercept, plane size, **worked steps by** (table of values, y-intercept and slope) |
| `linear.equation-from-graph` | A line on a grid, write $y=mx+b$ | slopes, negative slopes, largest y-intercept, plane size |
| `linear.match-graphs` | Matching cards: equations as parts, graphs as cards A, B, C, … made of lines that are easy to mix up (same slope, opposite slope, swapped slope and intercept); key gives the letter and how to tell | slopes, negative slopes, equations to match (3–6), extra cards that match nothing. Unlinked, the teacher can type the lines and the card order |
| `rates.typing-race` | Two people typing (seconds vs minutes): who is faster, difference in one hour, + thinking parts | thinking questions on/off |
| `rates.swim-laps` | Laps per hour, time for more laps, + why the rate could change | thinking questions on/off |
| `rates.hose` | Litres per hour, time to fill the tank, + why it could take longer | thinking questions on/off |
| `rates.heartbeat` | Beats per minute and per hour, + when the rate changes, why count longer | thinking questions on/off |
| `sci.planet-distance` | A planet's distance from the Sun (NASA data) in scientific notation, times as far as Earth, + why distances change | thinking questions on/off |
| `sci.light-travel` | Time for sunlight to reach a planet (seconds, minutes), + seeing the past, rover delays | thinking questions on/off |

Parameters show real values and accepted values (`params` on each generator;
`G.validate(gen, values)` returns friendly messages). Difficulty presets and
aspect bands (see the generator design doc) are the next layer on top.

Factoring questions are built answer first (pick the factors, expand them). The
trinomial `methods` setting only changes the worked steps, never the numbers; with
both methods ticked the key shows each one under its own heading, and the item
carries them separately in `methods` (contract section 3). Example recipe:
`examples/recipes/math10-factoring-practice.json`.

## Substitution

`algebra.substitution` keeps its expressions as text a teacher can type
(`(2a/(b+c))^-3`, `-a^-1`, `3a^2b`), so an unlinked question takes any expression in
$a$, $b$, $c$. The worked steps come from the expression: substitute (negatives in
brackets), then one layer per line (everything whose inputs are already numbers), with
$x^{-n}=\frac{1}{x^n}$ and small powers written out ($(-2)^3=(-2)(-2)(-2)$) as their
own lines. Example recipe: `examples/recipes/math9-substitution-and-sci-practice.json`.

## Graphs

Generators can give a `graph` with an item: the plane, and what is on it, in the
format of `docs/graph-format.md`. `generators/graph.js` checks a graph and turns its
functions into points, so pages draw without reading any maths. Lines are picked so
they pass through at least three whole-number points on the plane; the tests check that
the line drawn is the answer's equation and that every marked point is on it. Example
recipe: `examples/recipes/math10-linear-graphs.json`.

## Story questions and the library

Story questions are one story followed by parts a), b), c) … Some parts are
**calculations** (worked steps, one answer); others are **thinking** parts with no single
right answer (the key gives possible answers: any reasonable, backed-up argument is good
enough). The *Thinking questions* setting turns those parts on or off without changing
any numbers.

The library is separate from the code. `generators/data/` holds the content:
`planets.js` (NASA Planetary Fact Sheet, source recorded), `stories-rates.js` and
`stories-space.js` (the stories; their format is described at the top of
`stories-rates.js`). `generators/stories.js` is the engine: it turns every story into a
template named `<topic>.<id>`, so adding a story never means touching code.

In a story every value is marked: a **name**, a number that **varies** (a range or a list
to choose from), or a **fact** (real data: which planet varies, its distance never does).
Only names and varying numbers become editable variables; facts stay fixed.

Rule, checked by `tests/check-generators.js`: a part may repeat the givens, never a
result from an earlier part (no "Would Amira really swim 10 laps?" after asking for 10).

## Writing a generator (template form)

Every generator is a question template (contract section 6):

- `pick(values, rng, ctx)` makes **every** random choice and returns them as plain JSON
  vars (`{ base: 7, m: -8, op: 'divide', n: 2 }`). Use `ctx.spread(key, rng)` for a
  `set` parameter. Keep the order of `rng` calls when you change a generator, or saved
  quizzes get new numbers.
- `render(vars)` writes `prompt`, `answer`, `steps` (and optional `slots`, named values
  for `%name%` placeholders). No `rng` here. It must be right for any vars that pass
  `checkVars`, so handle the cases `pick` avoids (an exponent of 0 or 1, a divisor that
  is not a factor) or reject them in `checkVars` with a friendly message.
- `variables` describes each var (kind, label, limits, `when`), so a page can show it.

`register()` builds `generate` as `render(pick(...))`.
`node tools/generate.js recipe.json out.json --unlink` writes the unlinked form.

## Checks

`node tests/check-contract.js` checks every generator against the Generator API v1
(descriptor fields, parameter types, output shape, seed rule, and the template rules:
variable kinds, `render(pick()) = generate`, unlink gives the same questions, overrides
and placeholders).

`node tests/check-generators.js` runs every generator for many seeds: deterministic,
valid KaTeX, and every worked step and answer checked numerically against the
prompt (equations are checked by substituting the answer). The example quizzes get
the same numeric check. It also nudges every number of picked vars, as a teacher
editing an unlinked question would, and checks each accepted edit the same way.
