---
id: 10FF7FF8-B157-41F0-996A-9ABEB4FC5F79
created: 2026-09-10T05:41:23Z
modified: 2026-09-10T05:41:23Z
tags: [vault, index, moc]
---
# Knife Edge — Design Vault

Codename **Knife Edge**: a roguelike tower defense throwback (NES/SNES feel) whose signature is razor-thin balance between enemy power, tower power, and income.

This vault is **stratified**: each folder is a layer of narrowing. Nothing is deleted when we narrow; rejected directions stay in place so we can rewind.

| Stratum | Folder | What lives here | Mutability |
|---|---|---|---|
| 0 | `00-Brief` | The original ask, goals, hard constraints | Frozen after first commit; amend via decisions |
| 1 | `10-Research` | Prior art: TD mechanics, balancing tooling, engines, art pipeline | Append-only |
| 2 | `20-Concepts` | Divergent concepts (3+), each a full mechanics sketch | Append-only; status field tracks alive/parked |
| 3 | `30-Decisions` | ADR-style decision records with alternatives and rewind cost | Append-only; superseded ADRs are marked, never edited |
| 4 | `40-Branches` | The branch register: every fork in the road, its options, and its state | Living document |
| 5 | `50-Design` | The converged design, rewritten as decisions accumulate | Living documents |
| — | `90-Log` | Dated session log: what happened, what changed | Append-only |

## How to use it

- Start at [[Branch Register]] to see every open fork and what has been chosen.
- Each decision is `30-Decisions/ADR-NNNN-*.md`. An ADR names the branch it closes, the alternatives, and **Rewind** (what to redo if we reverse it).
- Concepts are `20-Concepts/Concept-X-*.md` with a `status:` line: `alive`, `parked`, `merged-into`, `rejected`.
- To rewind: open the ADR, read its Rewind section, write a new ADR that supersedes it (`supersedes: ADR-NNNN`), and flip the branch state in the register.

## Entry points

- [[Brief]] · [[Constraints]] · [[Open Questions]]
- [[Research - TD Mechanics Taxonomy]] · [[Research - Balancing Tooling]] · [[Research - Engines and Art Pipeline]]
- [[Concept A]] · [[Concept B]] · [[Concept C]]
- [[Branch Register]] · [[Decision Log]]
- [[Session Log]]
