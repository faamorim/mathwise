# Story ideas (not a roadmap)

Things that would be nice to have for variety. Nothing here is planned or promised;
pick from it when a unit needs more stories. The design these would plug into is in
the story bank design doc: context rows (a person, an activity, a planet …), relation
stories (give two, ask the third) and shared thinking ideas with ids like
`rates.not-constant`.

## Rates without time

A rate is "so much of one thing per one of another". Time is only one of the "per"s.

| Context | Rate | Give two, ask the third |
| --- | --- | --- |
| Baking | eggs per batch of muffins | eggs, batches, eggs per batch |
| Painting a room | litres of paint per square metre | paint, wall area, coverage |
| Road trip | litres of fuel per 100 km | fuel, distance, consumption |
| Garden | seeds per row, rows per bed | seeds, rows, seeds per row |
| Fundraiser | dollars raised per ticket | total, tickets sold, price |
| Printing | sheets per booklet | sheets, booklets, sheets per booklet |
| Recipe scaling | cups of flour per loaf | flour, loaves, flour per loaf |

Thinking ideas that fit all of them (one id each, worded from the context):

- `rates.not-constant`: the real rate varies (some walls soak up more paint, highway vs
  city driving, a batch with big eggs).
- `rates.estimate`: the rate is an average, so the answer is an estimate; should you
  round up or down? (buy 3 cans, not 2.4).
- `rates.extra`: in real life you plan for extra (spills, a broken egg, a misprint).

## Ratios and percentages

The same "big idea" as rates, without units on both sides: a part out of a whole.

| Context | Ratio | Give two, ask the third |
| --- | --- | --- |
| Class survey | 3 of every 8 students walk to school | walkers, class size, the ratio |
| Sports | a player scores on 40% of shots | goals, shots, the percent |
| Recycling | 2 of every 5 bins are sorted correctly | sorted, bins, the ratio |
| Library | 15% of books are checked out | checked out, total books, percent |
| Mixing paint or juice | 1 part concentrate to 4 parts water | concentrate, water, total |
| Census-style data (real, sourced) | share of a population in a group | group, population, percent |

Thinking ideas:

- `ratios.sample`: a ratio from one group may not hold for another group (one class
  is not the whole school; a small group can be far from the average).
- `ratios.not-exact`: "3 of every 8" does not mean every group of 8 has exactly 3.
- `ratios.where`: a ratio says how many, not which ones or where they are.

## Context rows these would need

- `activities` (rates over time): verb, what is counted, where, reasons the rate changes.
- `recipes` / `projects` (rates without time): the two things, units, typical amounts.
- `surveys` (ratios): the group, the question, a sensible range for the ratio, and
  whether the data is made up or real (real data records its source, like planets).
