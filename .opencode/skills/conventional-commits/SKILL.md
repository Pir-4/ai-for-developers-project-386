---
name: Conventional Commits
description: Commit message format (feat:, fix:, ...) — use for every commit and PR title in this repository; messages are written in English; release-please builds the changelog and version from them
---

# Conventional Commits

Format: `<type>(<optional scope>): <description>`

## Types and version impact

- `feat:` — new functionality → minor
- `fix:` — bug fix → patch
- `docs:` — documentation only
- `refactor:` — code changes without behavior change
- `test:` — tests
- `ci:` — GitHub Actions and other CI
- `chore:` — routine (configs, dependencies), not listed in the changelog

Breaking change: `!` after the type (`feat!: ...`) or a `BREAKING CHANGE: ...` footer → major.

## Rules

- Commit messages and PR titles are written in English (description and body).
- Description — lowercase, no trailing period, imperative mood, up to ~72 chars.
- One commit — one logical change.
- The agent makes all commits and only in this format: release-please reads the history of main
  and builds the changelog and semver version from it; a non-conforming message won't make it into the changelog.
- PR titles also follow the format: on squash-merge the PR title becomes the commit message on main.
- If needed — a body after a blank line (what and why, not how).

## Examples for this project

- `feat(api): endpoint for listing slots of the day`
- `fix(frontend): show slots in the local timezone`
- `ci: run tests and linter on every push`
- `docs: update API contract`
- `chore: bump dependencies`
