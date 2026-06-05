# STATE

> Single source of truth for the active work. Read at the start of every phase;
> each phase writes its artifact back. Keep this file small — durable detail lives
> in `plans/<phase>/` artifacts, not here.

## Project

- **Name:** <project name>
- **Mode:** <greenfield | brownfield>

## Current milestone

- <one-line description of the milestone in flight>

## Active phase

- **Phase:** <none | discuss | plan | review | execute | verify | ship>
- **Path:** <quick | standard | full>

## Phase status

| Phase   | Status      | Artifact                       | Last gate |
|---------|-------------|--------------------------------|-----------|
| discuss | not-started | plans/<phase>/DECISIONS.md      | —         |
| plan    | not-started | plans/<phase>/PLAN.md           | —         |
| review  | not-started | reviews/<phase>/REVIEWS.md      | —         |
| execute | not-started | (code + atomic commits)         | —         |
| verify  | not-started | plans/<phase>/VERIFY.md          | —         |
| ship    | not-started | (PR + archived state)           | —         |

## Decisions log (append-only)

> Never edit or delete prior entries. Append new ones at the bottom with a date.

- <YYYY-MM-DD> — <decision and one-line rationale>

## Open items

- <open question or task not yet scheduled>

## Blocked items

- <blocked item + what unblocks it>

## Next action

> Exactly one line. The single most useful thing to do next.

- <next action>
