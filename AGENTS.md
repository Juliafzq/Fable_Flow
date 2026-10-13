# Project Focus — Agent Instructions

## Project Context
- **Project Name:** UNTO FLOW (repo: Juliafzq/Fable_Flow; formerly Project Focus / Fable / Flow)
- **Project Type:** To be decided
- **Visibility:** Private personal project. Never make the GitHub repository public or add collaborators unless the owner explicitly asks.
- **Workspace Root:** `/usr/local/google/home/zuqi/github/ProjectFocus`
- **GitHub Remote:** `git@github.com:Juliafzq/Fable_Flow.git` (private)

## User Profile & Communication Guidelines
- **Non-SWE Collaboration:** The project owner is not a software engineer.
- **Walk Through Every Step:** Always explain what you are doing and why in clear, plain English before or after making changes. Avoid unexplained technical jargon.
- **Handle Technical Operations Proactively:** Run terminal commands, install packages, start local preview servers, and manage files directly on behalf of the user rather than asking the user to run terminal commands manually.
- **Auto-Accept / No Code Review Needed:** Do not ask the user to review file changes, code diffs, or implementation plans. Apply all file changes directly and set `RequestFeedback: false` on any artifacts so the workflow never pauses for manual review.

## Development Guidelines
- Keep the folder structure clean, modular, and easy to navigate.
- Never hardcode sensitive keys or credentials in source code; use `.env` files (which are ignored by `.gitignore`).
- Update `README.md` whenever new features, pages, or setup steps are added.
- Commit only with the personal GitHub identity (`Juliafzq`, applied automatically for repos under `~/github/`); never use a work email in commits.

## Saving & Publishing to GitHub
- **Save automatically:** After each meaningful change (a new feature, fix, or content update), commit and push to GitHub without asking first, then tell the owner in one plain-English sentence what was saved.
- **Commands to use:**
  1. `git add -A`
  2. `git commit -m "<short, plain-English summary>"` (for example, "Add focus timer page")
  3. `git push`
- **Keep commands simple** so they match the owner's saved Jetski allow rules (`git add`, `git commit`, `git push`) and run without approval prompts: no `$(...)`, backticks, or flags before the subcommand (like `git -c ...`). Chaining with `&&` is fine.
- **Check before saving:** Run `git status` first and make sure no secrets (`.env` files, API keys, passwords) are included.
- **How pushing works:** Pushes go to `git@github.com:Juliafzq/Fable_Flow.git` using this machine's existing SSH key; no extra sign-in is needed.
- **Stay private:** Never change the repository's visibility. If the GitHub CLI is installed and signed in, `gh repo view Juliafzq/Fable_Flow --json visibility` should report `PRIVATE`.
