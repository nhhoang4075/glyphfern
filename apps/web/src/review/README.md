# Review

Purpose: the review screen. It shows one card at a time from a queue built when the user enters the review route, and sends every rating to the store.

## Flow

1. Entering the review route calls `actions.startReview()` once. The effect depends on the route being active and on the stable `startReview` action, never on `state.cards`.
2. The answer becomes a `ReviewSession` (`startSession`): the queue of lemmas and the total used for the progress dots.
3. Each rating calls `actions.rateCard(queue, rating)`. The store schedules and logs the card and returns the next queue; `sessionWithQueue` keeps the total.
4. Rating a card changes `state.cards`, but the queue is not rebuilt: a lemma that left the queue never returns inside the same session. Only `again` and `hard` put the head back.
5. An empty queue shows the rest screen.

## Contracts

- `startOfLocalDay(time)` is local midnight of the calendar day of `time`. The daily limit of new cards counts from it, not from the last 24 hours.
- A result of `startReview` that arrives after the route was left is ignored.

## Testing

`apps/web/test/review/review-queue.test.ts` covers the pure session helpers; the scheduling and daily limit are covered in `apps/web/test/app/review.test.ts`.
