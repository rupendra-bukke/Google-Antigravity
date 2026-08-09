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

require_gh() {
  if ! gh auth status &>/dev/null; then
    echo "Error: Run 'gh auth login' with your personal GitHub account first."
    exit 1
  fi
  local login
  login=$(gh api user --jq .login 2>/dev/null || echo "")
  if [[ "$login" != "$GITHUB_USER" ]]; then
    warn "Authenticated as '${login:-unknown}', expected '$GITHUB_USER'."
    warn "Deploy may fail if you lack write access. Continue? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi
}

update_description() {
  local repo="$1" desc="$2"
  gh api "repos/$GITHUB_USER/$repo" \
    --method PATCH \
    -f description="$desc" \
    --silent 2>/dev/null && ok "Description updated: $repo" || warn "Could not update description: $repo"
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
  gh repo clone "$GITHUB_USER/$repo" "$clone_dir" -- --quiet 2>/dev/null || {
    warn "Could not clone $repo"
    return
  }

  cd "$clone_dir"
  git checkout -b "chore/professional-readme-$(date +%Y%m%d)" 2>/dev/null || git checkout -b "chore/professional-readme"

  if [[ "$repo" == "powerbi-dashboard" ]]; then
    # Full portfolio deploy — copy everything except .git
    rsync -a --exclude='.git' "$src/" "$clone_dir/"
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
    # README-only update for learning repos
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

  git push -u origin HEAD 2>/dev/null && ok "Pushed $repo" || warn "Push failed for $repo — create PR manually"
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
    gh repo create "$profile_repo" --public --description "GitHub profile README" --clone "$clone_dir"
  fi

  cd "$clone_dir"
  git checkout -b "chore/profile-readme-$(date +%Y%m%d)" 2>/dev/null || git checkout -b "chore/profile-readme"
  cp "$SCRIPT_DIR/profile/README.md" "$clone_dir/README.md"
  git add README.md
  git commit -m "docs: add professional GitHub profile README" || true
  git push -u origin HEAD 2>/dev/null || git push origin main 2>/dev/null || git push origin master 2>/dev/null || warn "Profile README push failed"
  ok "Profile README deployed"
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
  ok "Deployment complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Pin Google-Antigravity + powerbi-dashboard on your profile"
  echo "  2. Review PRs if branches were pushed (merge to main)"
  echo "  3. Visit https://github.com/$GITHUB_USER"
  echo "══════════════════════════════════════════════"
}

main "$@"
