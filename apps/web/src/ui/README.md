# ui

## Purpose

Small reusable components with no feature knowledge: they never read the app store and never import from `reader/`, `library/`, `words/`, `review/` or `shell/`. Screens compose them and pass behaviour in through props. Styles live in `src/styles/ui.css` and use tokens from `tokens.css` only.

## Contracts

- Every component is typed, accepts `className` and appends it after its own base class. Class order is `base`, caller class, `on`.
- Atoms: `Button` (defaults `type="button"`), `IconButton` (requires `label`, rendered as `aria-label`; no visible text), `Chip`, `Badge`, `Switch`, `Slider`, `Segmented`.
- Molecules: `Popover` (`.pop`, hidden attribute plus `aria-hidden`), `Sheet` (`variant="side"` renders the `.drawer` aside toggled by the `on` class, `variant="dock"` renders the `.panel` toggled by `hidden`), `Scrim`, `ConfirmDialog` (a native `dialog` opened with `showModal`; Escape calls `onCancel`), `ListRow` (`as="button"` default or `as="div"`), `Section` (labelled div).
- `IconButton` variants map to base classes: `ib`, `sm`, `st`, `hit`, `pin`, `add`, `dk`; `variant={null}` renders no base class.
- `Segmented` has two semantics: `pressed` (`aria-pressed` buttons, optional `fieldset` container) and `tab` (`role="tablist"` with `role="tab"` and `aria-selected`). `activeClassName` is added to the selected option.

## Adding a component

1. Create `kebab-case.tsx` in this folder, typed props, `className` passthrough, no store access.
2. Put its base styles in `src/styles/ui.css` using tokens.
3. Export it from `index.ts` and list it here.
4. Add a test under `apps/web/test/ui/` only for pure logic.
