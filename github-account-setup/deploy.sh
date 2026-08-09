#!/usr/bin/env bash
# Deploy professional GitHub organization for rupendra-bukke
set -euo pipefail

GITHUB_USER="rupendra-bukke"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$SCRIPT_DIR/repos"
WORK_DIR="$(mktemp -d)"
SKIP_CLEANUP=false
CLEANUP_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-cleanup) SKIP_CLEANUP=true ;;
    --cleanup-only) CLEANUP_ONLY=true ;;
    -h|--help)
      echo "Usage: ./deploy.sh [--skip-cleanup] [--cleanup-only]"
      exit 0
      ;;
  esac
done

log() { echo "▸ $*"; }
ok()  { echo "✓ $*"; }
warn(){ echo "⚠ $*"; }
err() { echo "✗ $*"; }

require_gh() {
  if ! gh auth status &>/dev/null; then
    err "GitHub CLI is not logged in."
    echo "Run: unset GITHUB_TOKEN && gh auth login -h github.com -p https -w"
    exit 1
  fi

  local login
  login=$(gh api user --jq .login 2>/dev/null || echo "")
  if [[ "$login" != "$GITHUB_USER" ]]; then
    warn "Authenticated as '${login:-unknown}', expected '$GITHUB_USER'."
    warn "Continue anyway? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi

  # Codespaces default GITHUB_TOKEN can only write to the current repo.
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo ""
    warn "GITHUB_TOKEN is set (common in Codespaces)."
    warn "That token usually cannot push to your OTHER repos."
    echo ""
    echo "Fix (run these in Codespaces, then re-run this script):"
    echo "  unset GITHUB_TOKEN"
    echo "  gh auth login -h github.com -p https -w"
    echo ""
    warn "Continue with current token anyway? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi
}

copy_tree() {
  local src="$1" dest="$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude='.git' "$src/" "$dest/"
  else
    # Fallback when rsync is unavailable
    (cd "$src" && tar cf - --exclude='.git' .) | (cd "$dest" && tar xf -)
  fi
}

update_description() {
  local repo="$1" desc="$2"
  if gh api "repos/$GITHUB_USER/$repo" --method PATCH -f description="$desc" --silent 2>/dev/null; then
    ok "Description updated: $repo"
  else
    warn "Could not update description: $repo"
  fi
}

push_branch() {
  local repo="$1"
  local push_out
  if push_out=$(git push -u origin HEAD 2>&1); then
    ok "Pushed $repo"
    return 0
  fi

  err "Push failed for $repo"
  echo "$push_out" | sed 's/^/    /'
  echo ""
  warn "Most common cause in Codespaces: limited GITHUB_TOKEN."
  echo "    Run:"
  echo "      unset GITHUB_TOKEN"
  echo "      gh auth login -h github.com -p https -w"
  echo "      ./deploy.sh --skip-cleanup"
  return 1
}

deploy_readme_repo() {
  local repo="$1"
  local src="$REPOS_DIR/$repo"
  if [[ ! -d "$src" ]]; then
    warn "Source not found: $src — skipping $repo"
    return
  fi

  log "Deploying $repo..."
  local clone_dir="$WORK_DIR/$repo"
  if ! gh repo clone "$GITHUB_USER/$repo" "$clone_dir" -- --quiet; then
    warn "Could not clone $repo"
    return
  fi

  cd "$clone_dir"
  # Prefer pushing directly to main for simpler first-time setup
  git checkout main 2>/dev/null || git checkout master 2>/dev/null || true

  if [[ "$repo" == "powerbi-dashboard" ]]; then
    copy_tree "$src" "$clone_dir"
    git add -A
    if git diff --cached --quiet; then
      ok "$repo — no changes"
      return
    fi
    git commit -m "feat: organize Power BI portfolio with professional structure

- Consolidate Maven Market, Adventure Works, and DAX Depo projects
- Add dashboard README template and index with badges
- Migrate PBIX files, data, and screenshots into structured folders
- Add dax-tutorials section for future learning content"
  else
    if [[ -f "$src/README.md" ]]; then
      cp "$src/README.md" "$clone_dir/README.md"
      git add README.md
      if git diff --cached --quiet; then
        ok "$repo — README already up to date"
        return
      fi
      git commit -m "docs: add professional README with badges and structure"
    fi
  fi

  push_branch "$repo" || true
  cd "$SCRIPT_DIR"
}

deploy_powerbi_dashboard() {
  deploy_readme_repo "powerbi-dashboard"
}

deploy_learning_repos() {
  for repo in python-for-data-analysis data-science-projects databricks-learning html-css; do
    deploy_readme_repo "$repo"
  done
}

deploy_profile_readme() {
  log "Setting up profile README..."
  local profile_repo="$GITHUB_USER"
  local clone_dir="$WORK_DIR/profile"

  if gh repo view "$GITHUB_USER/$profile_repo" &>/dev/null; then
    gh repo clone "$GITHUB_USER/$profile_repo" "$clone_dir" -- --quiet
  else
    # Create repo first, then clone into a known path
    # (gh --clone does not accept a custom path argument)
    if ! gh repo create "$GITHUB_USER/$profile_repo" --public --description "GitHub profile README"; then
      err "Could not create profile repo $GITHUB_USER/$profile_repo"
      return 1
    fi
    gh repo clone "$GITHUB_USER/$profile_repo" "$clone_dir" -- --quiet
  fi

  cd "$clone_dir"
  git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
  cp "$SCRIPT_DIR/profile/README.md" "$clone_dir/README.md"
  git add README.md
  if git diff --cached --quiet; then
    ok "Profile README already up to date"
  else
    git commit -m "docs: add professional GitHub profile README"
    push_branch "profile ($profile_repo)" || true
  fi
  cd "$SCRIPT_DIR"
}

update_descriptions() {
  log "Updating repository descriptions..."
  update_description "Google-Antigravity" "Active dev workspace — web apps, Python, KQL, BI projects"
  update_description "powerbi-dashboard" "Power BI portfolio — dashboards, DAX patterns, PBIX reports"
  update_description "python-for-data-analysis" "Python, NumPy, Pandas learning guides (Jupyter + Markdown)"
  update_description "data-science-projects" "Azure certification study guides — DP-900, DP-600, DP-700"
  update_description "databricks-learning" "Databricks & Spark learning roadmap"
  update_description "html-css" "HTML/CSS practice for Grafana dashboard customization"
}

cleanup_repos() {
  log "Cleaning up redundant repositories..."
  local to_delete=(
    powerbi-files
    dax-powerbi-tutorials
    git-hub
    grafana-kql
    Maven-Market-Power-BI
    udemy_advw
    DAX_Depo_Advanced_Calculations_Using_DAX_PowerBI
  )

  echo ""
  echo "The following repos will be DELETED:"
  for repo in "${to_delete[@]}"; do
    echo "  - $repo"
  done
  echo ""
  warn "This is irreversible. Type 'yes' to confirm:"
  read -r confirm
  if [[ "$confirm" != "yes" ]]; then
    warn "Cleanup skipped."
    return
  fi

  for repo in "${to_delete[@]}"; do
    if gh repo view "$GITHUB_USER/$repo" &>/dev/null; then
      gh repo delete "$GITHUB_USER/$repo" --yes && ok "Deleted $repo" || warn "Could not delete $repo"
    else
      ok "$repo — already gone"
    fi
  done
}

delete_reference_forks() {
  log "Optional: delete reference-only forks (bookmarks)..."
  local forks=(cs-video-courses llm-course LLM-Engineers-Handbook)
  echo "Delete reference forks? Star the originals instead. [y/N]"
  read -r confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then return; fi
  for repo in "${forks[@]}"; do
    gh repo delete "$GITHUB_USER/$repo" --yes 2>/dev/null && ok "Deleted fork $repo" || true
  done
}

main() {
  require_gh
  trap 'rm -rf "$WORK_DIR"' EXIT

  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║  GitHub Account Setup — $GITHUB_USER"
  echo "╚══════════════════════════════════════════════╝"
  echo ""

  if $CLEANUP_ONLY; then
    cleanup_repos
    delete_reference_forks
    exit 0
  fi

  deploy_powerbi_dashboard
  deploy_learning_repos
  deploy_profile_readme
  update_descriptions

  if ! $SKIP_CLEANUP; then
    echo ""
    warn "Phase 2 cleanup: delete migrated/empty repos?"
    echo "Run with --cleanup-only later, or continue now. [y/N]"
    read -r confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      cleanup_repos
      delete_reference_forks
    fi
  fi

  echo ""
  echo "══════════════════════════════════════════════"
  ok "Deployment finished (check warnings above)."
  echo ""
  echo "Next steps:"
  echo "  1. Open https://github.com/$GITHUB_USER/powerbi-dashboard"
  echo "  2. Open https://github.com/$GITHUB_USER (profile README)"
  echo "  3. Pin Google-Antigravity + powerbi-dashboard"
  echo "══════════════════════════════════════════════"
}

main "$@"
