# Project rules

These rules apply to this project only. Where they conflict with the global `~/CLAUDE.md`, these win. In particular, the global rule "code comments are written in English" is replaced by: there are no code comments.

## No comments in code files

- Code files contain no comments of any kind: no `//`, `/* */`, `#`, JSDoc, Python docstrings, SQL `--`, CSS `/* */`, HTML `<!-- -->`.
- Make the code explain itself through names, types, small functions and explicit data shapes. If a comment feels necessary, first try a better name or a smaller function.
- The only tolerated exceptions are directives that exist solely as comments and that a tool requires: the shebang line, `biome-ignore`, `@ts-expect-error`. Avoid them; when one is unavoidable, explain why in the folder README.
- Every sub-agent brief must state this rule.

## Explanations live in the folder README

- Explanations that would have been comments go into the `README.md` of the folder that holds the code.
- Not every folder needs a README, and a README is not an exhaustive description. Write one only where logic, a flow or a contract is not obvious from the code.
- A README describes the current design. It explains logic and flow, not history. Never write "previously X, now Y" or "decided to change". History belongs to git and `spec/_decisions.md`.
- Suggested structure, drop the sections that do not apply:
  1. Purpose: what this folder is responsible for, in two or three sentences.
  2. Flow: how the main operation runs, step by step or as a small diagram.
  3. Contracts: key types, inputs and outputs, invariants that must hold.
  4. Extension points: how to add an adapter, a language pack, a job.
  5. Failure modes: what can go wrong and how the code reacts.
  6. Testing: how this folder is verified.
- Update the README in the same commit as the code change that makes it stale.

## English everywhere in the repository

- English for: identifiers, file and folder names, database tables and columns, JSON fields, API paths, environment variables, test names, commit messages and pull request titles, `README.md` files.
- Commit messages follow Conventional Commits: `type(scope): subject`, body and merge commits included.
- `spec/` is written in English.
- `docs/` is exempt from these language and comment rules: it holds reports and explainers for the owner, written in Vietnamese, and is not treated as source code. It is listed in `.gitignore` and is never pushed to GitHub.
- The product language (Vietnamese) is used only for text shown to the end user in the UI and for generated learner-facing text. LLM prompt templates are written in English and instruct the model which language to answer in.
- Every sub-agent brief must state this rule.

## Everything else

The global `~/CLAUDE.md` applies: spec fidelity, delegation briefs, verification, git rules (no AI co-author trailer, no "Generated with" line).
