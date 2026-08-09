# Power BI Dashboards

<div align="center">

![Power BI](https://img.shields.io/badge/Power_BI-F2C811?style=for-the-badge&logo=powerbi&logoColor=black)
![DAX](https://img.shields.io/badge/DAX-Advanced-0078D4?style=for-the-badge&logo=microsoft&logoColor=white)
![Data Modeling](https://img.shields.io/badge/Data_Modeling-Star_Schema-00A4EF?style=for-the-badge)

**Central portfolio for Power BI reports, DAX patterns, and dashboard documentation.**

[Dashboard Index](#-dashboard-index) · [Structure](#-repository-structure) · [Getting Started](#-getting-started) · [Standards](#-documentation-standards)

</div>

---

## Overview

This repository is the **single source of truth** for Power BI work — course projects, practice dashboards, DAX experiments, and production-ready reports. Each dashboard lives in its own folder with a PBIX file, documentation, and supporting assets.

| Focus Area | Tools & Skills |
|------------|----------------|
| Data preparation | Power Query, data profiling, merges & appends |
| Modeling | Star schema, relationships, hierarchies |
| Analytics | DAX measures, time intelligence, filter context |
| Delivery | Dashboards, KPIs, bookmarks, navigation |

---

## Dashboard Index

| Dashboard | Folder | Type | Highlights |
|-----------|--------|------|------------|
| **Maven Market** | [`maven-market/`](maven-market/) | Course project | End-to-end retail analytics, Power Query, DAX, visuals |
| **Adventure Works Advanced** | [`adventure-works-advanced/`](adventure-works-advanced/) | Course project | Data cleaning, modeling, advanced DAX, interactivity |
| **DAX Depo — Advanced Calculations** | [`dax-depo-advanced/`](dax-depo-advanced/) | DAX portfolio | Matrix-only insights, time intelligence, filter context |
| **DAX Tutorials** | [`dax-tutorials/`](dax-tutorials/) | Learning | Notes and patterns (in progress) |

---

## Repository Structure

```
powerbi-dashboard/
├── README.md                          # This file — dashboard index
├── _templates/
│   └── dashboard-readme-template.md   # Copy for every new report
├── maven-market/
├── adventure-works-advanced/
├── dax-depo-advanced/
└── dax-tutorials/
```

Each dashboard folder follows this pattern:

```
<dashboard-name>/
├── *.pbix                 # Power BI Desktop file
├── README.md              # Purpose, data sources, key measures
├── data/                  # Source files (CSV, Excel, zip)
├── screenshots/           # Report visuals
└── measures/              # Optional DAX documentation
```

---

## Getting Started

### Prerequisites

- [Power BI Desktop](https://powerbi.microsoft.com/desktop/) (latest version)
- Access to required data sources
- Git (for cloning this repository)

### Open a dashboard

```bash
git clone https://github.com/rupendra-bukke/powerbi-dashboard.git
cd powerbi-dashboard/<dashboard-folder>
# Open the .pbix file in Power BI Desktop
```

1. Navigate to the dashboard folder from the index above.
2. Open the `.pbix` file in Power BI Desktop.
3. Update data source credentials if prompted.
4. Refresh data to load the latest model.

---

## Documentation Standards

Every new dashboard must include:

- [ ] `README.md` using the [template](_templates/dashboard-readme-template.md)
- [ ] Business purpose and target audience
- [ ] Data sources and refresh notes
- [ ] Key DAX measures or modeling decisions
- [ ] At least one screenshot in `screenshots/`

---

## Version Control Workflow

```bash
git checkout -b feature/<dashboard-name>-update
# Edit PBIX + README
git add .
git commit -m "feat(maven-market): add Q4 sales KPI page"
git push -u origin feature/<dashboard-name>-update
```

Use descriptive commit messages: `feat`, `fix`, `docs`, or `refactor` scoped to the dashboard folder.

---

## Related Repositories

| Repository | Purpose |
|------------|---------|
| [Google-Antigravity](https://github.com/rupendra-bukke/Google-Antigravity) | Active code projects, Python, KQL, web apps |
| [python-for-data-analysis](https://github.com/rupendra-bukke/python-for-data-analysis) | Python & Pandas learning |
| [data-science-projects](https://github.com/rupendra-bukke/data-science-projects) | Azure certification guides |

---

<div align="center">

**Maintained by [Rupendra Bukke](https://github.com/rupendra-bukke)** · BI & Analytics

*Last updated: August 2026*

</div>
