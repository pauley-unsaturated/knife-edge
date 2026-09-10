---
id: FC9AF8C7-9FF3-4667-8C7E-689128FA4A91
created: 2026-09-10T05:41:56Z
modified: 2026-09-10T05:41:56Z
tags: [adr, decision, stratum-3]
---
# ADR-0001 Work lives in a dedicated repo with this vault at its root

- **Status:** accepted (2026-09-10)
- **Closes branch:** [[Branch Register]] B0 (project home)
- **Context:** The session started inside PunkRecords, an unrelated notes app. The game needs its own history, CI, and issue tracker.
- **Decision:** New private repo `pauley-unsaturated/knife-edge`. `vault/` holds design notes as a PunkRecords-compatible vault (YAML frontmatter, wikilinks). Code lands beside it later (`sim/`, `game/`, `tools/`).
- **Alternatives:** (a) `docs/` folder on the PunkRecords branch: pollutes an unrelated project. (b) Artifact page only: no history, no rewind.
- **Consequences:** The GitHub connector in this session could not create the repo (403); the user creates it, then the agent pushes.
- **Rewind:** Trivial. `git remote set-url` to any other home; the vault is plain files.
