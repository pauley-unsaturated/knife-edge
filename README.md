# Knife Edge

Codename for a roguelike tower defense with an NES/SNES throwback presentation, whose signature is razor-thin balance between enemy power, tower power, and income.

- `vault/` — the design vault. Start at `vault/Index.md`. Notes are PunkRecords-compatible markdown (YAML frontmatter + `[[wikilinks]]`), stratified from brief → research → concepts → decisions → converged design.
- `Scripts/new-note.sh` — emits a frontmatter header for a new vault note.

Code (headless simulation core, balance CLI, renderer, platform shells) lands beside the vault once the design converges. See `vault/40-Branches/Branch Register.md` for what is decided and what is still open.
