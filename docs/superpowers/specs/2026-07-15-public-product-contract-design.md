# KStage Public Product Contract Design

**Date:** 2026-07-15

**Status:** Proposed for implementation

**Scope:** First beta-critical vertical slice

## Context

KStage currently presents two public promises that do not match the implemented product:

1. The home hero uses `Notify me` / `Notify is on` for an action that only follows a group. It does not verify browser permission, create a push subscription, or prove that notifications are enabled.
2. Public copy and preferences still present live events as a supported category, although the current launch scope is releases, music videos, music shows, birthdays, and debut anniversaries.

This mismatch weakens user trust before acquisition begins. The first implementation slice therefore aligns the interface, public positioning, and tested behavior with what KStage actually delivers. It does not remove internal compatibility needed by existing data.

## Objective

Make the public product contract truthful and consistent before the private beta:

- following a group is clearly presented as following, not as enabling notifications;
- push notifications remain a separate account-level capability;
- live events disappear from the launch-facing product surface;
- existing internal `live` data remains readable and does not require a risky schema migration.

## User experience

### Hero follow action

The CTA in the `NEXT UP` card represents exactly one stateful action: following or unfollowing the event's group.

| User state               | Control          | Label                    | Behavior                                                               |
| ------------------------ | ---------------- | ------------------------ | ---------------------------------------------------------------------- |
| Signed out               | Link to `/login` | `Follow`                 | Starts the existing authentication path; no local mutation is implied. |
| Signed in, not following | Button           | `Follow`                 | Optimistically follows the group.                                      |
| Signed in, following     | Button           | `Following`              | Optimistically unfollows the group.                                    |
| Mutation pending         | Disabled button  | Current optimistic label | Prevents duplicate submissions while preserving visible state.         |

The control uses a follow/check visual rather than a bell. Bell language and icons are reserved for actual notification settings.

The signed-in action is optimistic because follow state is low-risk and should feel immediate. If the server action fails, the UI returns to the confirmed state and displays the project's existing error-toast pattern. The server remains authoritative.

Notification configuration remains accessible through the existing Account entry points. This slice does not add a second notification CTA beside the follow action.

### Accessibility contract

- A state-changing control is a semantic `button`; the signed-out authentication route remains a semantic link.
- The signed-in button exposes `aria-pressed` to communicate follow state.
- Decorative icons use `aria-hidden`.
- The existing visible focus treatment is retained or improved.
- The pending state disables repeated activation without replacing the readable label with an icon-only loader.
- Failure feedback is visible through the existing toast system, while rollback ensures the control does not retain a false state.

## Public launch scope

The launch-facing event categories are:

- releases;
- music videos;
- music shows;
- birthdays and debut anniversaries.

Live events are removed from:

- README and active product documentation claims;
- global metadata and social descriptions;
- the About page;
- notification preference rows;
- home-hero eligibility.

This cleanup applies to user-facing event-category claims. It must not remove legitimate uses of the word “live” that describe a deployed site, realtime behavior, a live search, or another unrelated technical concept.

## Internal compatibility

The database event-type enum, generated database types, historical rows, query compatibility, scraper internals, and styles that can handle `live` remain unchanged in this slice.

Keeping internal support avoids a destructive migration and lets historical or manually entered data render safely. It does not authorize new public promises or new live-event ingestion. A later, separately designed cleanup may remove the type after production data and dependencies are audited.

## Components and data flow

### Follow mutation

1. The server-rendered home page determines authentication and current follow state.
2. `NextDropCard` passes the group identifier, authentication state, and confirmed follow state to the client CTA.
3. The CTA applies an optimistic local state and invokes the existing authenticated `toggleFollow` server action.
4. The action validates the session and performs the authorized database mutation.
5. On success, the optimistic state becomes the visible state. On failure, the CTA restores the last confirmed state and emits an error toast.

No notification permission, push subscription, or notification preference is inferred from follow state.

### Public category cleanup

The home hero chooses only `mv`, `release`, and `music_show` database events. Birthdays and debut anniversaries continue to appear in their existing calendar/queue surfaces rather than becoming primary comeback hero items.

The Account notification preference list exposes only `mv`, `release`, `music_show`, and `anniversary`.

## Security and privacy

- Authentication and authorization stay inside the existing server action and Supabase RLS boundaries.
- Client-provided group identifiers are never treated as proof of access or identity.
- No secret, service-role credential, or notification subscription is moved to the client.
- No database policy or schema change is required.
- Error feedback remains generic and does not expose database or account details.

## Test strategy

Implementation follows a test-first cycle for changed behavior.

### Component behavior

Tests cover, at minimum:

- signed-out users see a `Follow` link to `/login`;
- signed-in non-followers see a non-pressed `Follow` button;
- signed-in followers see a pressed `Following` button;
- clicking either signed-in state calls the existing action with the correct current-state argument (`false` to create a follow, `true` to remove one);
- the optimistic label changes immediately and duplicate activation is prevented while pending;
- a rejected mutation rolls the state back and reports an error;
- no follow CTA claims that notifications are enabled.

### Product-scope regressions

Tests or focused assertions verify that:

- live events are not eligible for the home hero;
- notification preferences no longer expose a Lives row;
- active public copy and metadata no longer list lives as a supported KStage feature;
- unrelated technical uses of “live” remain untouched.

### Verification gate

Before the slice is considered complete:

- targeted unit/component tests pass;
- the broader Vitest suite passes;
- type checking and linting pass;
- formatting is verified;
- the production build passes;
- affected Playwright assertions are updated and the relevant golden path passes when its isolated test environment is available.

## Documentation impact

Active documentation must describe the same launch scope as the product. Historical audit documents and dated plans are evidence, not public promises, and are not rewritten merely to erase references to earlier scope decisions.

The project journal and backlog are updated at the normal integration point defined by the repository workflow.

## Non-goals

This slice does not:

- redesign or guarantee the push-notification pipeline;
- add timezone-aware notification scheduling or digests;
- change temporal precision or event-confidence modeling;
- modify scraper sources, cadence, or monitoring;
- add groups, debut automation, subscriptions, or paid plans;
- remove the internal `live` enum or historical data;
- redesign the full home page or Account experience.

Those areas remain later, independently testable roadmap slices.

## Rollout and rollback

The change is application-only and backward compatible with the current database. It can ship behind the normal deployment process without data migration or backfill.

If a regression is discovered, reverting the application commit restores the previous controls and copy; no database rollback is needed. Follow records created or removed through the corrected CTA use the existing domain behavior and require no cleanup.

## Acceptance criteria

The slice is accepted when all of the following are true:

1. No public control equates following a group with enabled notifications.
2. The hero CTA accurately supports signed-out, followed, unfollowed, pending, success, and failure states.
3. The CTA meets the accessibility contract above.
4. Lives are absent from current public feature claims, notification preferences, and home-hero eligibility.
5. Existing internal `live` compatibility is preserved.
6. The tests and verification gate pass with no unrelated user changes included in the implementation commit.
