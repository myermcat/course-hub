# course-hub

One front page for four University of Ottawa courses in Fall 2026, with each course reachable
from it.

**Published at [myermcat.github.io/course-hub](https://myermcat.github.io/course-hub/).**

```
index.html          the front page, one card per course
shared/hub.css      the design system every hub imports
shared/tasks.js     the tick boxes, saved in the reader's own browser
gng2101/index.html  Engineering Design
ceg3155/index.html  Digital Systems II
elg3125/index.html  Signal and System Analysis, still to be moved in
.nojekyll           stops GitHub Pages running the files through Jekyll
```

**Philosophy keeps its own repository.** It is reached by a link out to
[myermcat.github.io/phi-reading-hub](https://myermcat.github.io/phi-reading-hub/), which is its
own repository. Its published address has been shared and the highlights readers save are tied
to that address, so those pages stay where they are.

## The design system

**One stylesheet serves every page.** `shared/hub.css` holds the colour tokens, the type scale, and every component: the course card,
the fact grid, the scrolling table, the task list, the detail toggle, the note block and the
site footer. A course page imports it and sets only its own accent colour, in all three theme
states.

| Course | Accent, light | Accent, dark |
|---|---|---|
| PHI2394 | `#1F6B57` | `#64BFA1` |
| ELG3125 | `#1C5D93` | `#6BB4E8` |
| CEG3155 | `#8A5A1E` | `#D9A957` |
| GNG2101 | `#5B3E8E` | `#A98BD6` |

Colours are defined three times: on bare `:root`, inside
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again
on `:root[data-theme="dark"]`. A page that forgets the bare `:root` definition renders with
missing colours in a browser that reports no preference.

## Favicons

**Each mark is a rounded square** in the course accent with a white glyph drawn from the subject:
a lightbulb for philosophy, a sine wave for signals, a square wave for digital systems, a pair
of dividers for design. The front page carries all four colours in a two by two grid. Every one
is inline SVG in a data URI, so a tab icon costs no file and no network request.

## Source material stays out of this repository

The course folders on disk hold the readings, the lecture decks, the solutions and the working
files. This repository holds only the pages. Nothing under copyright is published here.

## Prose

Pages follow the house rules in `~/.claude/skills/document-builder`. Run the linter to zero
errors before publishing:

```bash
node ~/.claude/skills/document-builder/references/prose-lint.mjs index.html gng2101/index.html ceg3155/index.html
```
