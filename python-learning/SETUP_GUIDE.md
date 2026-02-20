# Python Environment Setup Guide

This guide explains the step-by-step process used to set up a robust Python development environment for this project.

## 1. Create a Virtual Environment

**Why?**
Python installs packages globally by default. A virtual environment creates an isolated space for this project, preventing conflicts between different projects' dependencies (e.g., if one project needs `pandas` version 1.0 and another needs version 2.0).

**Command:**
```powershell
python -m venv venv
```
- `python -m venv`: Runs the standard `venv` module.
- `venv`: The name of the directory where the environment will be created.

---

## 2. Activate the Virtual Environment

**Why?**
Activation updates your shell's path to use the Python interpreter and tools inside the `venv` folder instead of the global system Python.

**Command (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```
*(On Windows, you might need to enable script execution first with `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`)*

---

## 3. Upgrade pip (Package Installer)

**Why?**
`pip` is the tool used to install Python packages. Upgrading it ensures you have the latest features and security patches.

**Command:**
```powershell
python -m pip install --upgrade pip
```

---

## 4. Install Required Libraries

**Why do we need these?**
- **`pandas`**: Powerful data manipulation and analysis (DataFrames).
- **`numpy`**: Fundamental package for scientific computing with Python (arrays, math).
- **`matplotlib`**: Comprehensive library for creating static, animated, and interactive visualizations.
- **`plotly`**: Interactive graphing library for making publication-quality graphs.
- **`notebook`**: Web-based interactive computing platform (Jupyter Notebooks).

**Command:**
```powershell
pip install notebook pandas numpy matplotlib plotly
```

---


---

## Cheat Sheet: Common Commands

Here is a quick reference for the most important commands you'll use daily.

### 1. Check Python Version
Verify which version of Python is currently active.
```powershell
python --version
```

### 2. Virtual Environment Management

**Create a new virtual environment** (run once per project):
```powershell
python -m venv venv
```

**Activate the environment** (run every time you open a new terminal):
```powershell
.\venv\Scripts\Activate.ps1
```

**Deactivate the environment** (return to global Python):
```powershell
deactivate
```

### 3. Package Management (pip)

**List installed packages**:
See what libraries are currently installed in your environment.
```powershell
pip list
```
*Or to save the list to a file (requirements.txt):*
```powershell
pip freeze > requirements.txt
```

**Install a new package**:
```powershell
pip install package_name
# Example: pip install requests
```

**Install from a requirements file**:
```powershell
pip install -r requirements.txt
```

**Uninstall a package**:
```powershell
pip uninstall package_name
```

**Show details about a package**:
```powershell
pip show pandas
```

### 4. Navigation & Directory Commands

**Check current directory** (Where am I?):
```powershell
pwd
```

**Change directory** (Go to a folder):
```powershell
cd path\to\folder
# Example: cd d:\GitHub\Google-Antigravity\python-learning
```

**Go back one level**:
```powershell
cd ..
```

**List files in current directory**:
```powershell
ls
# or
dir
```

**Clear terminal screen**:

### 5. Jupyter Notebook Commands

**Start Jupyter Notebook**:
Launches the Jupyter interface in your browser.
```powershell
jupyter notebook
```

**Install Kernel Support**:
Before registering a kernel, ensure `ipykernel` is installed.
```powershell
pip install ipykernel
```

**Register a New Kernel**:
This makes your virtual environment available as a kernel in Jupyter.
*(Replace `myenv` with your environment name)*
```powershell
python -m ipykernel install --user --name=venv --display-name "Python (venv)"
```
- `--name=venv`: internal identifier for the kernel.
- `--display-name "Python (venv)"`: what you see in the Jupyter menu.

**List Installed Kernels**:
See which kernels are available to Jupyter.
```powershell
jupyter kernelspec list
```

**Remove a Kernel**:
If you delete an environment, remove its kernel reference.


---

### 6. Quick Reference Table

| Command | Usage |
| :--- | :--- |
| `python --version` | Check current Python version |
| `python -m venv venv` | Create a new virtual environment named 'venv' |
| `.\venv\Scripts\Activate.ps1` | Activate the virtual environment (Windows) |
| `deactivate` | Deactivate the current environment |
| `pip list` | List all installed packages |
| `pip install <package>` | Install a specific package (e.g., `pandas`) |
| `pip install -r requirements.txt` | Install all packages listed in a file |
| `pip uninstall <package>` | Remove a specific package |
| `pip show <package>` | Display details about an installed package |
| `pip freeze > requirements.txt` | Save current environment packages to a file |
| `pwd` | Show current directory path |
| `cd <path>` | Change directory to the specified path |
| `cd ..` | Move up one directory level |
| `ls` or `dir` | List files and folders in current directory |
| `cls` | Clear the terminal screen |
| `jupyter notebook` | Launch Jupyter Notebook in the browser |
| `pip install ipykernel` | Install kernel support for Jupyter |
| `python -m ipykernel install ...` | Register environment as a Jupyter kernel |
| `jupyter kernelspec list` | List available Jupyter kernels |
| `jupyter kernelspec uninstall <name>` | Remove a Jupyter kernel |
