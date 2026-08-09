# GitHub Account Setup

Professional organization scripts and templates for the [rupendra-bukke](https://github.com/rupendra-bukke) GitHub account.

## What This Does

| Step | Action |
|------|--------|
| 1 | Push organized **powerbi-dashboard** with all PBIX projects |
| 2 | Add professional READMEs to learning repos |
| 3 | Create **profile README** (`rupendra-bukke/rupendra-bukke`) |
| 4 | Update repository descriptions |
| 5 | Optionally delete redundant empty repos |

## Prerequisites

```bash
# Install GitHub CLI and authenticate with full account access
gh auth login
gh auth status   # Must show your user, not a bot/integration
```

## Quick Deploy

```bash
cd github-account-setup
chmod +x deploy.sh
./deploy.sh
```

### Options

```bash
./deploy.sh                  # Deploy all repos + profile + descriptions
./deploy.sh --skip-cleanup   # Deploy without deleting empty repos
./deploy.sh --cleanup-only   # Only delete redundant repos (after review)
```

## Repository Layout

```
github-account-setup/
├── deploy.sh                          # Main deployment script
├── profile/README.md                  # GitHub profile README
└── repos/
    ├── powerbi-dashboard/             # Full Power BI portfolio (PBIX + docs)
    ├── python-for-data-analysis/    # README only (content already in repo)
    ├── data-science-projects/       # README only
    ├── databricks-learning/         # README only
    └── html-css/                    # README only
```

## Repos to Delete (Phase 2 — after powerbi-dashboard is deployed)

| Repo | Reason |
|------|--------|
| `powerbi-files` | Empty duplicate of powerbi-dashboard |
| `dax-powerbi-tutorials` | Replaced by `powerbi-dashboard/dax-tutorials/` |
| `git-hub` | Unclear purpose, never used |
| `grafana-kql` | Content lives in `Google-Antigravity/kql-learning/` |
| `Maven-Market-Power-BI` | Migrated to `powerbi-dashboard/maven-market/` |
| `udemy_advw` | Migrated to `powerbi-dashboard/adventure-works-advanced/` |
| `DAX_Depo_Advanced_Calculations_Using_DAX_PowerBI` | Migrated to `powerbi-dashboard/dax-depo-advanced/` |

## Pin These Repos on Your Profile

1. Go to https://github.com/rupendra-bukke?tab=repositories
2. Click **Customize your pins**
3. Select: **Google-Antigravity** and **powerbi-dashboard**

## Repo Descriptions (auto-applied by deploy.sh)

| Repo | Description |
|------|-------------|
| `Google-Antigravity` | Active dev workspace — web apps, Python, KQL, BI projects |
| `powerbi-dashboard` | Power BI portfolio — dashboards, DAX patterns, PBIX reports |
| `python-for-data-analysis` | Python, NumPy, Pandas learning guides (Jupyter + Markdown) |
| `data-science-projects` | Azure certification study guides — DP-900, DP-600, DP-700 |
| `databricks-learning` | Databricks & Spark learning roadmap |
| `html-css` | HTML/CSS practice for Grafana dashboard customization |
