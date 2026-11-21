# "My team" page (/team): API integration

The buyer of an enterprise plan hands its seats to colleagues. The buyer holds
one seat themselves (`isOwner: true`), which can't be replaced or removed here.

## Files

| File | What it is |
|---|---|
| `src/app/team/page.jsx` | The page |
| `src/store/slices/teamSlice.js` | All API calls |
| `src/components/team/PlanCard.jsx` | Dark plan card with the seat meter |
| `src/components/team/InviteForm.jsx` | Multi-email input |
| `src/components/team/SeatList.jsx` | Seat rows (Replace / Remove) |
| `src/components/team/ReplaceSeatModal.jsx` | Replace dialog |

## Endpoints used

| When | Call |
|---|---|
| Page opens, and after every change | `GET /my/subscriptions` (only `type: "enterprise"` plans are shown) |
| Add one email | `POST /my/subscriptions/:id/seats` `{ "email" }` |
| Add 2+ emails | `POST /my/subscriptions/:id/seats/bulk` `{ "emails": "a@x.io, b@x.io" }` |
| Replace | `PUT /my/subscriptions/:id/seats/:email` `{ "newEmail" }` |
| Remove | `DELETE /my/subscriptions/:id/seats/:email` (no body) |

Emails in the path are URL-encoded (`raj%40elred.io`).

## How responses are handled

- Bulk: `results[].ok` / `results[].error.message` per email. Refused emails stay
  in the input with the server's message. This works whether the API answers
  200 or an error status, as long as the body has `results`.
- Single add, replace and remove: only success/failure is read (`error.message`
  is shown on failure). The seat list always comes from the refetch.
- Plan `status` other than `active`: the add form and row actions are hidden.
- `isLifetime: true`: shows "Lifetime access" instead of dates.
- More than one enterprise plan: a plan picker appears above the card.

## Still open

- No "resend invite" endpoint, so there's no resend button.
- Responses for PUT (replace) and DELETE (remove) haven't been seen yet. If they
  return the updated subscription, the extra GET after them could be dropped.
- Error codes beyond `CONFLICT` (seat limit reached, invalid email, plan
  suspended/expired, not the owner) haven't been seen; their `message` is shown.
