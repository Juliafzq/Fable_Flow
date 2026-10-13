# Fable / Flow QA harness

Headless-Chrome interaction checks (mobile emulation, focus emulation, real CDP touch events).
Requires the local preview server serving this repo on `127.0.0.1:8091` (`./start.sh`).

```bash
cd qa
./run_qa.sh edit typing     # only the groups a change touches (runs in parallel)
./run_qa.sh all             # big changes / merges
```

Groups: `bars`, `flip`, `edit`, `typing`, `profile`, `timer`, `assign`, `twist`, `about`, `layout` — see the header of `run_qa.sh`.
Screenshots land in `qa/shots/` (git-ignored). See ENGINEERING_PLAYBOOK_AND_PREFERENCES.md Part 3.
