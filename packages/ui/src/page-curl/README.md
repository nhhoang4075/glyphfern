# page-curl

## Purpose

Page-turn engine for the `curl` turn style (spec `web-reader-logic.md` section 7, `web-reader-ui.md` section 4). In `slide` and `still` the app calls `disable()`: no corner handlers are bound and no GL context is created.

## Flow

1. `createPageCurl(options)` returns `enable`, `disable`, `turn`, `destroy`. `enable` binds pointer events on both corner elements.
2. Pointer down on a corner records the start; movement over 6 px latches `moved` and calls `begin`, which asks `getPageSurface(direction)` for the front and under canvases and uploads them as textures.
3. Each pointer move calls `fold`, which computes `foldParams` (halved vertical component, `solveA`) and draws.
4. Release goes through `decideRelease`: tap runs a 1250 ms automatic sweep, a drag beyond 30% of the book width sweeps for 760 ms, anything else (including `pointercancel` and `lostpointercapture`) animates back in 220 ms.
5. When a sweep ends, the `nort` class is added to the book for 120 ms and `onTurn(direction)` is called.

## Contracts

- `getPageSurface` is supplied by the app. `drawPage` and `collectSegments` draw a flow element (text, learning-word strips, new-word dots, selection boxes, icons, bookmark ribbon) into a canvas.
- `domFold` (optional) holds the elements used by the DOM clip-path fallback.
- `shader.ts` is the authoritative numeric detail for the GL look.

## Failure modes

- Any GL failure (context, compile, link, draw, texture upload) switches to the DOM fold for the rest of the session.
- An exception in a tween ends the tween and restores the static page.

## Testing

Pure modules (`solveA`, `foldParams`, `sweepPath`, `dragDecision`, `easing`, `tween`, `domFold` geometry) and the controller with fake elements are unit tested. Real GL rendering, `collectSegments`/`drawPage` and real pointer capture need a browser.
