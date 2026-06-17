# FMCG Beverages AI Assistant

An end-to-end, conversational Business Intelligence (BI) assistant built for FMCG category management. It enables non-technical business users (Brand Managers, Sales Directors) to query sales performance, inventory movements, and promotional campaign lifts conversationally.

The system translates natural language queries into valid SQLite statements, executes them against a simulated 16-week, 7,680-record beverage division database, and displays structured datagrids, auto-generated charts, and narrative business insights.

## Features

- **Category Dashboard**: High-level visual KPIs (total revenue, units sold, discount rate, stockout rate) and interactive horizontal bar charts tracking revenue contribution by region, category, and top products.
- **Conversational SQL Chat**: Ask analytical questions (e.g., *"Compare BOGO sales of Pure Orange Juice across convenience stores in West vs East"*).
  - **SQL Code Toggle**: Clear visibility of the executed SQL query for auditability.
  - **Data Spreadsheet**: Scrollable table preview of the direct database records.
  - **Automatic Charting**: Dynamically draws horizontal comparison charts from query outputs if they contain numeric data.
- **Database Explorer**: Direct tab/page interface to inspect raw schemas and tables (`product_master`, `store_master`, `sales_promotions`, `inventory`).

## Technology Stack

- **Frontend**: React (Vite) + CSS Variables (Glassmorphic dark aesthetic)
- **Backend**: Node.js Express API Server
- **Database**: SQLite3
- **LLM API**: Google Gemini 1.5 Flash (utilizing the official `@google/generative-ai` SDK)

---

## Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **Python 3** installed on your system.

### 2. Installation
Clone this repository and install the dependencies:
```bash
npm install
```

### 3. Generate Database
Populate the SQLite database and export sample CSV files:
```bash
python3 generate_data.py
```

### 4. Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=5001
```
*(Alternatively, you can paste your API key directly inside the settings panel in the frontend UI).*

### 5. Running the Application
```bash
# Start backend API (listening on port 5001)
node server.js

# In another terminal window, start Vite dev server (runs on port 3000)
npx vite
```
Open `http://localhost:3000` in your web browser.

## System & Model Architecture

The application uses an **Agentic NL-to-SQL Translation Loop** to query the database. The logic consists of two generative phases mediated by the backend server:

```mermaid
graph TD
    User([Business User]) -->|1. Conversational Query| Backend[Express Backend Server]
    Backend -->|2. Inject DB Schema + Prompt| GeminiSQL[Gemini 1.5 Flash - SQL Generator]
    GeminiSQL -->|3. Output JSON with SQL Query| Backend
    Backend -->|4. Strict 'SELECT' Check & Run| SQLite[(SQLite3 Database)]
    SQLite -->|5. Tabular Data Results| Backend
    Backend -->|6. Compile Data + Summary Prompt| GeminiText[Gemini 1.5 Flash - Narrative Agent]
    GeminiText -->|7. Markdown Insight Text| Backend
    Backend -->|8. Renders markdown, table grid, & bar chart| User
```

### 1. SQL Generation Phase
- The user query is packaged into a structured prompt containing the full database schema.
- **Strict Prompt Guidelines** instruct Gemini to only return a SELECT statement wrapped in a parseable JSON object:
  ```json
  {
    "sql": "SELECT ...",
    "explanation": "Brief query justification"
  }
  ```
- The backend parses this JSON and validates that the SQL query is a read-only `SELECT` statement before executing it against `fmcg_beverages.db`.

### 2. Business Narrative Phase
- The raw results returned by SQLite are passed back to Gemini with a separate formatting instruction.
- The model translates tabular cells into a concise, non-technical business report formatted in Markdown, highlighting key drivers (promotional lifts, inventory alerts).
- The React frontend parses the numeric cells to automatically draw visual charts side-by-side.

---

## Deployment on Render (Recommended)

Since the application requires a persistent Node.js background process to run the Express API server and execute write-independent local SQLite files, **Render** is much more suitable than Vercel. 
*(Vercel is serverless-based; its serverless functions are ephemeral, read-only, and will lose connections or reset local SQLite database changes).*

We have included a `render.yaml` blueprint. To deploy the app to Render:
1. Log in to your **Render Dashboard**.
2. Click **New** $\rightarrow$ **Blueprint**.
3. Select your repository `FMCG-Beverages-AI-Assistant`.
4. Render will automatically build the React frontend, generate the SQLite database via Python, and run the backend.
5. In the Render environment settings, configure the environment variable:
   * `GEMINI_API_KEY`: *your_gemini_api_key*
