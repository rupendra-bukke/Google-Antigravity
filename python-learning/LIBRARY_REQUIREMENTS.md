# Library Requirements

## Goal
Establish a standardized process for managing Python dependencies to ensure consistent and reproducible environments across all development machines.

## User Review Required
> [!IMPORTANT]
> **Virtual Environment**
> Always activate your virtual environment before running any pip commands to avoid polluting your global Python installation.
> Command: `.\venv\Scripts\Activate.ps1`

## Library Standards

### configuration
- **Environment**: Use a local `.venv` directory.
- **Exclusion**: Ensure `.venv` is added to `.gitignore`.

### Dependencies
When adding new libraries, follow this workflow to keep the project in sync:

1. **Install Package**: `pip install <package_name>`
2. **Verify List**: `pip list`
3. **Freeze Dependencies**: `pip freeze > requirements.txt`

## Verification Plan

### Automated Tests
Run this command to check for broken dependencies or conflicts:
```powershell
pip check
```

### Manual Verification
Use these commands to verify your environment matches the project requirements:

| Command | Description | Expected Outcome |
| :--- | :--- | :--- |
| `pip list` | List installed packages | Matches `requirements.txt` content |
| `Get-Command python` | Check Python path | Points to `.../venv/Scripts/python.exe` |
