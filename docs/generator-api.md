# Generator API (v1)

This is the contract between the **generator library** (`generators/`) and everything
that uses it: the worksheet & quiz editor (`worksheets/`), the command-line tools, and
later the student practice page. Pages may rely on what is written here and on nothing
else; generators may change anything not written here.

`Mathwise.generators.apiVersion` is `1`. Checked by `node tests/check-contract.js`.

## Who owns what

| Path | Owner |
| --- | --- |
| `generators/` (every file), `tests/check-generators.js`, `tests/tex-check.js`, `tools/generate.js`, `examples/recipes/` | Generator work |
| `worksheets/` (including `js/generated.js`, the editor's only door into the library), `schema/` except the `generator` field, `docs/worksheet-format.md` | Editor work |
| This file, the `generator` field of `schema/worksheet.schema.json`, the functions listed below, `tests/check-contract.js` | Shared: change only with the owner's OK |

**Changing the contract.** Adding a generator, or adding an *optional* field that old
pages can ignore, is free and stays v1. Renaming or removing anything below, or changing
the seed rule, is a new version: it needs the owner's OK and lands together with the
matching change on the other side.

## Loading

Pages load one file, `generators/index.js`, which loads `core.js` and every generator
file, in order, before the next script tag (works from `file://` too). Node tools use
`tools/load-generators.js`, which reads the same list. A new generator file is added to
the list in `generators/index.js` and nowhere else.

## 1. Describe: `list()`, `get(name)`

Each returns generator descriptors (`get` throws on an unknown name). Pages may read:

| Field | Meaning |
| --- | --- |
| `name` | Stable id stored in files, `<topic>.<what>` (`powers.monomials`). Never renamed once used. |
| `title` | Shown to the teacher ("Evaluate powers with negative exponents"). |
| `topic` | Groups generators in a picker ("Powers", "Scientific notation"). |
| `prompt` | Default instruction for a block ("Simplify"). |
| `whole` | `true`: one generated item is the whole question (no parts). |
| `columns`, `workSpace` | Layout suggestions: parts per row, work lines per part. |
| `params` | The settings, below. |

Parameters show real values, never "easy/hard":

```
{ key, label, type: 'number', min, max, default }                 // whole numbers
{ key, label, type: 'choice', values: [{ value, label }], default }
{ key, label, type: 'set',    values: [{ value, label }], default: [...] }   // pick at least one
{ key, label, type: 'toggle', default: true }
```

A page builds its controls from these four types only. A new type is a contract change.
`defaults(gen)` gives the default values.

## 2. Check: `validate(gen, values)`

Returns a list of friendly messages (empty when the values are fine). Missing values take
their defaults.

## 3. Generate: `generate(name, values, seed, { output, index, count })`

Returns one item:

```json
{ "prompt": "$12t^4\\div 3t^{-3}$", "answer": "$4t^{7}$",
  "steps": ["$=\\frac{12}{3}t^{4-(-3)}$", "$=4t^{7}$"], "workSpace": 1.5 }
```

- `output`: `steps` (default), `answer` (no `steps`), `none` (no `answer` either).
- Text is worksheet markup: math is LaTeX inside `$…$`, `\$` is a literal dollar.
- `steps`: one line each, one rule applied per line (granular, for teaching the method).
- **Deterministic:** same name + values + seed = same item. No clock, no `Math.random`.
- `index` / `count`: the part's position in its block (lets a block spread its forms).
- Optional `methods`: when a question can be worked by more than one method, the item
  also carries `[{ method, label, steps }]`, one entry per method the settings ask for;
  `steps` is then all of them, each after a "Label:" line, ready to print. A practice
  page can offer the student the choice. Pages that do not know it print `steps`.
- Optional `followUps`: thinking follow-ups `[{ prompt, answer }]` (reasoning questions,
  `answer` = possible answers). They are already appended to `prompt` and `answer` as
  "*Think:* …" / "*Possible answers:* …" paragraphs, so pages need not handle them.
- Items may later carry extra optional fields (see *Planned*); pages ignore what they
  do not know.

## 4. Fill a block: `fillBlock(block, { docSeed, blockNumber, output })`, `fillDocument(doc)`

`fillBlock` turns a stored question block into a block with `parts` (each with `prompt`,
`answer`, `solution` = steps joined by new lines), or, for a `whole` generator, the
block's own `prompt`, `answer`, `solution`. It fills `prompt`, `columns` and `space` from
the descriptor when the block has none. It returns a new block; its `generator` field is
kept exactly as given. `fillDocument` does this for every generator block of a document.

**The seed rule** lives only in `blockSeed(generator, docSeed, blockNumber)`: the block's
own `generator.seed` wins; otherwise `"<doc seed>/<block number>"` (block numbers from 1,
`mathwise` when the document has no seed). Part *i* of a block uses `"<block seed>:<i>"`.
Changing any of this changes the numbers of every saved quiz.
A block with a `template` (section 6) instead of a `generator` is rendered from its vars.

## 5. Stored form (shared part of the worksheet schema)

```json
{ "kind": "question", "generator": { "name": "powers.monomials", "params": { "terms": 2 }, "seed": "unit3/8", "count": 4 } }
```

`params` hold real parameter values only (never slider positions, difficulty or aspect
names), so saved files keep working when presets are retuned. `seed` is optional.

## 6. Question templates: `variables`, `pick`, `render`

Every generator is also a **question template**: generating is split into a random
part and a fixed part, so a question can be *unlinked* from its seed and edited by hand
while its answer and steps keep up.

```
pick(values, rng, ctx) -> vars                      every random choice, as plain JSON
render(vars)           -> { prompt, answer, steps, slots? }   no randomness at all
generate               =  render(pick(...))         checked by tests/check-contract.js
```

`render` must be right for **any** vars that pass `checkVars`, not only for the ones
`pick` would choose, because a teacher can type their own (checked by
`tests/check-generators.js`, which nudges every number and re-checks the maths).

**Descriptor field `variables`** (pages build the fields of an unlinked question from it):

```
{ key, label, kind: 'int', min?, max?, nonzero? }       // whole number
{ key, label, kind: 'letter' }                          // one letter, like x
{ key, label, kind: 'int-or-letter' }                   // a base: 7, -5 or p
{ key, label, kind: 'digits' }                          // significant digits, like "37"
{ key, label, kind: 'choice', values: [{ value, label }] }
{ key, label, kind: 'toggle' }                          // true / false
{ key, label, kind: 'list', of: { kind, ... }, minLength?, maxLength? }
{ key, label, kind: 'vars', by: 'kind', templates: { trinomial: 'factoring.trinomial', ... } }
```

`vars` holds the vars of another template, chosen by the value of the variable named in
`by` (`varTemplate(d, vars)` gives the generator name). A page shows that template's own
variables inside (recursively). `checkVars` checks them too. Used by `factoring.full`
(common factor, then a trinomial / difference of squares / …) and `factoring.mixed`.

Any variable may have `when: { otherKey: [values] }`: it is used (and shown) only when
the other variable has one of those values (for example `k` only for the form
`coefficient`); `varApplies(d, vars)` tells. A page that meets a kind it does not know
shows the value as JSON text. A new kind is an optional addition (still v1).

**Functions** (pages use these, never `gen.pick` / `gen.render` directly):

| Function | Does |
| --- | --- |
| `isTemplate(gen)` | `true` when the generator has `variables`, `pick`, `render`. |
| `pick(name, values, seed, { index, count })` | The vars a seed chooses (same as `generate` uses). |
| `checkVars(gen or name, vars)` | Friendly messages ("Each division must come out whole: 6 ÷ 4 does not."); empty when fine. |
| `render(name, vars, { output, overrides, noThrow })` | One item, exactly like `generate`. Throws with the `checkVars` messages when the vars do not fit (or, with `noThrow`, returns `{ errors }`). |
| `placeholders(name, vars)` | Names a teacher may type as `%name%` (below). |
| `unlink(block, { docSeed, blockNumber })` | A generator block turned into a template block with the same questions (keeps part fields like `marks`). |

**Overrides and placeholders.** Text the teacher types over the rendered `prompt`,
`answer` or `steps` (the whole list) is kept as an override and wins over the rendered
text. Overrides may use `%name%`, which is replaced by that variable's value (numbers,
letters, digits, choices) or by a *slot*: a named value the template works out, like
`%result%` (the final exponent) or `%value%` (bⁿ written out). So a step typed as
`Add the exponents: %m% + %n% = %result%` stays right when `m` changes. `%%` is a literal
`%`; an unknown name is left as it is.

**Stored form of an unlinked question** (shared part of the worksheet schema). Each part
carries its own vars, so moving, deleting or copying a part takes them along:

```json
{ "kind": "question", "prompt": "Simplify",
  "template": { "name": "powers.product-quotient", "params": { "bases": ["number"] } },
  "parts": [
    { "prompt": "$7^{-8}\\div 7^2 =$", "answer": "$7^{-10}$", "solution": "…", "marks": 1,
      "template": { "vars": { "base": 7, "m": -8, "op": "divide", "n": 2 },
                    "overrides": { "steps": ["$= 7^{%m%-%n%}$", "$= 7^{%result%}$"] } } } ] }
```

- `block.template.params`: the generator settings when it was unlinked, so a page can
  `pick(name, params, newSeed)` one more part like these.
- A part without `template` is a hand-made part in the same block and is left alone.
- A `whole` template has `vars` (and `overrides`) on `block.template` itself, no parts.
- The block has no `generator` and no seed. `fillBlock` re-renders every part that has
  `template` and keeps the fields it does not own (`marks`, `space`, `label`, …); it does
  the same for a generator block's parts. The filled text stays on the block, so a page
  that does not know templates still shows it as a hand-made question.
- `render(name, vars, { noThrow: true })` returns `{ errors: [...] }` instead of throwing.

## Planned (not built yet, agreed 2026-11-07)

These will be added to this contract when they are built:

- **Difficulty presets:** `presets` on the heat scale (mild, medium, spicy, extra spicy),
  each a set of parameter values; aspects and `sliceOrder` for thin slicing.
- **Graphs:** an optional `graph` object on items, in the format of a shared
  `docs/graph-format.md`. Generators only describe graphs; pages draw them.
- **Practice:** optional `check(item, studentAnswer)` and per-step `hints`, and a
  `method` setting for guided steps (e.g. cross method for factoring).

