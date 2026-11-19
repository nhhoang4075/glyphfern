# Glyphfern

Language-learning book reader (PWA). Spanish and Korean first.

- `spec/` is the source of truth for behaviour and design.
- `apps/web` is the reader app, `packages/core` holds pure logic, `packages/ui` holds the paginator and page-turn engine, `packages/languages` holds language packs.
- `docs/` holds Vietnamese reports and the HTML prototype. It is not pushed.
- `bun run check` runs lint, the no-comments rule, type check and tests.
