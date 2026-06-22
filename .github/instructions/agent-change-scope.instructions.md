---
applyTo: '**/*'
---

# Agent Change Scope — Preserve Existing Flow

Applies to every code change task in this repository. This is the single source of truth for flow-preservation policy (no separate Cursor rule file).

## Default behavior

When the task is to **implement, fix, refactor, or extend** existing code, treat the current structure and control flow as intentional unless the user says otherwise.

-   Make the **smallest change** that satisfies the request.
-   **Do not** refactor, rename, lift, split, or rewrite surrounding logic "while you're here."
-   **Do not** replace an existing function's shape, loop structure, or call chain unless the user asked for that redesign or a written plan explicitly requires it.
-   Match existing naming, types, imports, and patterns in the touched area.

## Before changing control flow

If completing the task requires a **material flow change** (new top-level helpers, splitting one pass into multiple passes, changed return shapes callers depend on, multi-file rewiring, or replacing an established loop/switch structure):

1. **Stop before coding** the flow change.
2. **Ask the user for approval** with a short, concrete description:
    - current behavior / structure
    - why a structural change seems required
    - proposed new flow (files, functions, call sites)
    - expected diff size / risk
    - minimal alternative that preserves the existing flow, if any
3. Implement the larger rewrite **only after explicit user approval**.

## Allowed without prior approval

-   User explicitly asks to rewrite, minimize, simplify, or restructure the flow.
-   An attached plan/spec **explicitly** authorizes the structural change.
-   A blocking build/test/lint failure needs a **local** fix in the same area — keep that fix as small as possible.

## If flow was changed without approval

Stop, summarize what changed, offer to revert to a minimal patch, and wait for user direction before continuing.
