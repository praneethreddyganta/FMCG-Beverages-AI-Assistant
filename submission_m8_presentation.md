# M8: Communication — Slide Deck Structure

Below is the structured layout and content of the presentation slide deck:

---

### Slide 1: Title Slide
- **Title**: Conversational Business Intelligence for FMCG Category Management
- **Subtitle**: AI-Powered SQL Assistant for Beverage Sales & Inventory Analytics
- **Author**: Ganta Praneeth Reddy
- **Core Message**: Eliminating reporting bottlenecks by putting live SQL database access in the hands of non-technical business users.

---

### Slide 2: The Business Challenge
- **Problem**: Business users (Brand Managers, Sales Directors) request promotional analyses, regional sales comparisons, and inventory stockout data daily.
- **Pain Points**: These requests require manual reporting by data analysts, leading to delayed decisions (often taking days) and repetitive query writing.
- **Goal**: Enable self-service category discovery through an intuitive, conversational chat assistant.

---

### Slide 3: Solution Architecture
- **Tech Stack**: React + Tailwind/CSS frontend, Node.js/Express API server, SQLite local database, Google Gemini 1.5 Flash.
- **Core Workflow**:
  - User Question (Natural Language) $\rightarrow$ Prompt Injection (with DB Schema) $\rightarrow$ Gemini (SQL Translation) $\rightarrow$ SQLite Query Runner $\rightarrow$ Raw Data Output $\rightarrow$ Gemini Summary Generator $\rightarrow$ Interactive UI (Charts, Tables, Markdown).

---

### Slide 4: Data Pipeline & Simulation
- **Scale**: 15 products (categories: Carbonated, Juice, Water, Energy, Dairy), 24 stores, 4 regions, 16 weeks of records (7,680 sales & inventory entries).
- **Reality Features**: 
  - Simulates BOGO and Price Cut promotion multipliers (3x to 5x uplift) to verify AI analysis.
  - Models realistic supply delays (units received = 0) to trigger stockout events.

---

### Slide 5: Conversational AI Demo & Visuals
- **Chat Features**:
  - **SQL Toggle**: Transparent query visibility (fosters trust and aids debuggability).
  - **Spreadsheet Tables**: Scrollable datagrid reviews for exact records.
  - **Auto-Charting**: Dynamic horizontal charts computed from numeric columns (instantly shows top items visually).

---

### Slide 6: Risk Management & Roadmap (Version 2.0)
- **Mitigating Hallucination**: Strict database schema prompts, read-only SELECT command filters, and clean database syntax error catching.
- **Roadmap**:
  1. Multi-user role permissions (Sales vs. Executive view levels).
  2. PDF Executive Brief and slide exports.
  3. LLM SQL-caching to accelerate duplicate queries and reduce API costs.
