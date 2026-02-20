# Python Library Management Guide

This guide focuses on how to manage your project's dependencies to ensure your code runs responsibly on any machine.

## Freezing Libraries (Sharing Your Environment)

**What does "freezing" mean?**
Imagine your Python project is a dish you cooked. The libraries are the ingredients. "Freezing" your libraries is like writing down the exact recipe with specific brands (versions) and quantities.

**Why do we need it?**
If you send your code to a friend (or to a server), they need to know exactly which ingredients you used. If you used `pandas` version 2.0 but they install version 1.0, your code might "taste" wrong (crash).
By "freezing" your environment into a file (usually called `requirements.txt`), you guarantee that anyone else can recreate your exact setup.

## Workflow: How to Freeze

### 1. Check your ingredients (List)
Before you save the list, just look at what you have installed to make sure it looks right.
```powershell
pip list
```

### 2. Save your recipe (Freeze)
This takes that list and writes it to a file called `requirements.txt`.
```powershell
pip freeze > requirements.txt
```

### 3. Cook from the recipe (Install)
If you (or a friend) want to install these exact libraries on a new computer:
```powershell
pip install -r requirements.txt
```

## detailed commands

| Command | Description |
| :--- | :--- |
| `pip list` | Show all installed packages and versions |
| `pip freeze` | Output installed packages in requirements format |
| `pip freeze > requirements.txt` | Save the output to a file |
| `pip install -r requirements.txt` | Install packages listed in a file |
| `pip show <package>` | Show details (location, version, license) of a package |






----------------------------------------




## Quick Recap: Freezing & Sharing (Terminal Workflow)

**1. Go to your folder:**
```powershell
cd d:\GitHub\Google-Antigravity\python-learning
```

**2. Activate the Environment (Required):**
This "selects" the environment for this terminal session.
```powershell
.\venv\Scripts\Activate.ps1
```

**3. Check what you have:**
```powershell
pip list
```

**4. Freeze (Save the list):**
```powershell
pip freeze > requirements.txt
```


-------------------------------------------------------------------------
 



 # ==============================
# 🔹 Built-in (Standard) Libraries
# ==============================

import sys              # System & interpreter info
import os               # File & directory operations
import math             # Mathematical functions
import random           # Random number generation
import json             # JSON handling
import datetime         # Date & time operations
from datetime import datetime, timedelta

# ==============================
# 🔹 Data Handling Libraries
# ==============================

#import numpy as np      # Numerical operations
#import pandas as pd     # Data manipulation

# ==============================
# 🔹 Visualization Libraries
# ==============================

#import matplotlib.pyplot as plt
#import plotly.express as px
#import plotly.graph_objects as go

# ==============================
# 🔹 Check Environment
# ==============================

print("Python Executable:", sys.executable)
print("Current Working Directory:", os.getcwd())





------------------------------------------------------------------------------------------