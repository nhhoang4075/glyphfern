# Language packs

Purpose: typed, side-effect-free data for each language pack (`es`, `ko`). Each pack is a `LanguagePack` from `@glyphfern/core`.

Layout: `es/` and `ko/` each hold `book.ts` (raw chapters), `notes.ts` (sentence notes), `dictionary.ts` (raw dictionary tuples), `starter.ts` (known and learning lemmas) and `index.ts` (the pack). `buildBook.ts` turns raw data into `Book` and `DictEntry` values.

Flow: `buildBook` walks chapters in order. Each chapter gets a title sentence (`kind: "title"`, id assigned first), then body sentences in paragraph order (`kind: "body"`). Ids are global and consecutive from 0. Body sentence `n` takes `notes[n]`; a missing or extra notes entry throws.

Token string: a sentence `text` is space-separated tokens of the form `surface|lemma|group|analysis`.
- `surface` may carry leading and trailing non-letters (quotes, punctuation). These become `lead` and `trail`.
- `lemma` may be empty, in which case the lowercase surface is used.
- `group` is optional (Spanish multi-token units such as `se fue`).
- `analysis` is optional (Korean). It is `form=gloss` parts joined by `+`, with `_` standing for a space in glosses.

Dictionary: `expandPos` expands Spanish part-of-speech abbreviations (`dt`, `đg`, `tt`, `gt`, `đt`, `số`) to the spelled-out Vietnamese labels. Korean labels are already spelled out and are not passed through it.

Data files hold the prototype text unchanged, including its Vietnamese meanings, notes and the Spanish and Korean sentences.
