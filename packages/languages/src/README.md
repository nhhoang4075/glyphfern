# Language packs

Purpose: typed, side-effect-free data for each language pack (currently `es`). Each pack is a `LanguagePack` from `@glyphfern/core`.

Layout: `es/dictionary.ts` holds the raw dictionary tuples, `es/expand-pos.ts` expands part-of-speech labels and `es/index.ts` builds the pack. `build-dictionary.ts` turns raw tuples into `DictEntry` values.

Books: a pack ships no book. `pack.book` is `EMPTY_BOOK` from `@glyphfern/core`; the app replaces it with the imported book that is open.

Dictionary: a raw tuple is `[pos, pronunciation, meaning, note]`; an empty note is omitted from the entry. `expandPos` expands Spanish part-of-speech abbreviations (`dt`, `đg`, `tt`, `gt`, `đt`, `số`) to the spelled-out Vietnamese labels.

Data files hold the prototype text unchanged, including its Vietnamese meanings and notes.
