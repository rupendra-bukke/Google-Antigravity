# Google Antigravity

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)
![KQL](https://img.shields.io/badge/KQL-Data_Explorer-5C2D91?style=for-the-badge)

**Personal development workspace — BI projects, web apps, Python learning, and KQL analytics.**

[Projects](#-projects) · [Structure](#-repository-structure) · [Getting Started](#-getting-started) · [Related Repos](#-related-repositories)

</div>

---

## Overview

This is the **active development hub** for data and analytics work — combining Power BI thinking with modern engineering: Python notebooks, KQL queries, Next.js applications, and CI/CD workflows.

Built for a BI Analyst / Data Engineer learning path spanning **Power BI → Azure → Python → Web Apps**.

---

## Projects

| Project | Folder | Stack | Description |
|---------|--------|-------|-------------|
| **Dhanya Diaries** | [`web-app-dev/dhanya-diaries-app/`](web-app-dev/dhanya-diaries-app/) | Next.js, TypeScript | Full-stack web application |
| **Stock Intelligence** | [`web-app-dev/stock-intelligence-app/`](web-app-dev/stock-intelligence-app/) | Python, CI/CD | Stock analytics with automated workflows |
| **Stock Intelligence Mobile** | [`web-app-dev/stock-intelligence-mobile/`](web-app-dev/stock-intelligence-mobile/) | Mobile | Companion mobile experience |
| **Python Learning** | [`python-learning/`](python-learning/) | Jupyter, NumPy, Pandas | Hands-on Python practice notebooks |
| **KQL Learning** | [`kql-learning/`](kql-learning/) | KQL, Grafana | Azure Data Explorer queries |

---

## Repository Structure

```
Google-Antigravity/
├── web-app-dev/              # Web applications (Next.js, APIs)
│   ├── dhanya-diaries-app/
│   ├── stock-intelligence-app/
│   └── stock-intelligence-mobile/
├── python-learning/          # Python notebooks & setup guides
├── kql-learning/             # KQL queries for Grafana / ADX
├── github-account-setup/     # GitHub org scripts & repo templates
├── .agent/                   # AI assistant rules & context
└── .github/workflows/        # CI/CD pipelines
```

---

## Getting Started

### Python / Jupyter

```bash
git clone https://github.com/rupendra-bukke/Google-Antigravity.git
cd Google-Antigravity
python -m venv .venv && source .venv/bin/activate
pip install -r python-learning/requirements.txt
jupyter notebook python-learning/
```

### Web Apps (Next.js)

```bash
cd web-app-dev/dhanya-diaries-app/frontend
npm install && npm run dev
```

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases |
| `dev` | Active development |

---

## Related Repositories

| Repository | Purpose |
|------------|---------|
| [**powerbi-dashboard**](https://github.com/rupendra-bukke/powerbi-dashboard) | Power BI reports & DAX portfolio |
| [**data-science-projects**](https://github.com/rupendra-bukke/data-science-projects) | Azure certification guides |
| [**python-for-data-analysis**](https://github.com/rupendra-bukke/python-for-data-analysis) | Python study materials |
| [**databricks-learning**](https://github.com/rupendra-bukke/databricks-learning) | Databricks roadmap |

---

## Professional GitHub Setup

This repo includes [`github-account-setup/`](github-account-setup/) — scripts and templates to maintain all repositories with consistent branding, READMEs, and structure. See the [setup guide](github-account-setup/README.md).

---

<div align="center">

**Maintained by [Rupendra Bukke](https://github.com/rupendra-bukke)** · Bengaluru, India

</div>
