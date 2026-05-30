# Spec & plan writing rules (optional)

- **Delivery slices.** When splitting an epic into deliverable chunks, name them `Slice 1` /
  `Slice 2`. Avoid `Branch` (git-overloaded) and `Part` (vaguer).
- **Status terms distinguish PoC from delivered.** Reserve `Implemented` / `Shipped` / `Delivered`
  for behavior merged to production and available to users. For prototypes use
  `PoC implemented (not delivered)`, `Placeholder (not delivered)`, or `Fail-fast stub (not
  delivered)`. Include a one-line legend when first used.
- **No bare acronyms.** Expand on first use or add a glossary. Prefer canonical API names over
  invented shorthand. Spell out algorithm terms (e.g. "depth-first search (DFS)") on first use.
- **"What is this file" header.** Open every spec/plan with a blockquote stating file purpose,
  audience, owner, and its relationship to companion files.
- **Unsourced roadmap/availability claims** must be linked to a source or marked
  `(assumption — confirmed with <name>, <YYYY-MM-DD>)`.
