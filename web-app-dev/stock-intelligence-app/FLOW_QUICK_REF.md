# Flow Quick Reference

Project path:
`d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app`

## Environment URLs

- Dev (Vercel Preview): `https://trade-craft-app-git-dev-rupendra-bukkes-projects.vercel.app/`
- Prod (Vercel Production): `https://trade-craft-rb.vercel.app/`
- Current prod release: `v2026.03.12-01` (`main` merge commit: `c28e35f`)

## Daily Dev (build + preview)

```powershell
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

git checkout dev            # switch to development branch
git pull origin dev         # get latest dev changes
git status -sb              # verify clean state

# edit files

git add <changed-files>     # stage only your edits
git commit -m "dev: <message>"   # save checkpoint
git push origin dev         # publish -> triggers Vercel preview
```

Memory trick: `D-P-S-A-C-P` = Dev, Pull, Status, Add, Commit, Push.

## Preview Check

- Open latest Vercel Preview URL.
- Validate changed feature and basic smoke tests.

Memory trick: `Preview before Public`.

## Release to Prod

```powershell
cd /d d:\GitHub\Google-Antigravity\web-app-dev\stock-intelligence-app

# 0) Mandatory docs update before release
# - Update CHANGELOG.md
# - Create releases/vYYYY.MM.DD-NN.md from releases/RELEASE_NOTE_TEMPLATE.md

git checkout main           # switch to production branch
git pull origin main        # sync main
git merge dev               # bring tested dev changes
git push origin main        # publish -> triggers Vercel production

git checkout dev            # return to dev for next work
```

Memory trick: `Build in dev, ship in main`.

## If confused

```powershell
git branch --show-current   # where am I?
git status -sb              # what changed?
git log --oneline main..dev # what is pending for release?
```

Memory trick: `Branch, Status, Log`.

## Confirm you are back on dev

```powershell
git branch --show-current   # expected output: dev
git status -sb              # first line should show: ## dev
git branch                  # * dev means current branch
```

Memory trick: `Show current, then trust`.

## Golden Rules

- Do feature work in `dev`.
- Test on Preview URL.
- Promote only tested changes to `main`.
- Keep Preview env pointing to dev backend, Production env to prod backend.
