# Glyphfern specification

The spec is the source of truth. Code that differs from it is a bug in the code. A spec changes only when the owner explicitly decides to change the design, and the decision is recorded in `_decisions.md`.

| File | Scope |
| --- | --- |
| `web-reader-ui.md` | Screens, components, visual design (Glyphfern), interaction rules of `apps/web` |
| `web-reader-logic.md` | Data model, pagination, word states, review, bookmarks, search, language switching, page-turn engine, persistence |
| `_decisions.md` | Owner decisions with date and reason |

Reference prototype: `docs/glyphfern-ui.html`, generated from `docs/lexmoth-ui.html` (file name kept from the earlier working title). The prototype is a single-file demo with in-memory sample books. It demonstrates the behaviour described here and is not production code. Where the prototype takes a shortcut that the product must not take, the spec marks it with **Target** and the shortcut with **Prototype**.

Conventions used in all spec files:

- MUST, MUST NOT, SHOULD follow RFC 2119.
- Values (pixels, durations, colours, ratios) are requirements, not suggestions.
- UI text shown to users is Vietnamese. Everything else in the repository is English.
- Code has no comments. Explanations live in the folder README.
