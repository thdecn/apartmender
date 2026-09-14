# Apartmender

Apartmender is a frontend to Artmender, which turns a legally reusable two-staff keyboard score into reverse-order practice cards sized for an iPhone screen.

Each written measure becomes one card. The last measure appears alone; every earlier card contains its full measure plus the first sounding onset on each staff in the next measure, retaining any rests before those onsets. Cards preserve score annotations where the source format supports them, repeat notation context, and show the original measure number.

The verified built-in catalog currently contains:

- Carl Czerny, Op. 821 No. 2: 8 measures/cards
- J. F. F. Burgmüller, L'Arabesque, Op. 100 No. 2: 33 measures/cards
- J. S. Bach, Prelude No. 1 in C major, BWV 846: 35 measures/cards
- J. S. Bach, Invention No. 8, BWV 779: 34 measures/cards
- J. S. Bach, Invention No. 1, BWV 772: 22 measures/cards

## Practice web app

A phone landscape practice UI lives in `docs/` and is published with GitHub Pages:

https://thdecn.github.io/apartmender/

## Tests

Run the JavaScript practice-flow tests with Node.js:

```sh
npm test
```

## Supabase development

The account and data boundary uses a project-pinned Supabase CLI and a local
Docker-compatible stack. See [SUPABASE.md](SUPABASE.md) for setup, commands,
credential handling, hosted Auth configuration, and Free-plan recovery expectations.
