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
