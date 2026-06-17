# M4: Thinking — System Design & Discovery

## 1. Key Design Decisions
- **Database Choice (SQLite)**: We selected a local SQLite database file for the prototype database layer. It is self-contained, does not require hosting configuration, and supports standard SQL joins.
- **LLM Translation Architecture**: Instead of trying to write complex natural language parsers or training custom intent models, we used an agentic prompt translation pattern:
  1. The user asks a question in natural language.
  2. The schema definitions are injected into a prompt for Gemini.
  3. Gemini is instructed to translate the question into a valid SQLite query and return it in a structured JSON schema: `{"sql": "...", "explanation": "..."}`.
  4. The backend Express server executes the SQL, gets the raw data rows, and sends the raw rows back to Gemini with a separate summarization prompt to write a natural language business summary.
- **Dynamic API Key Client**: Instead of hardcoding API keys on the server or letting API calls fail when keys aren't set, we added settings in the frontend UI to allow users to input their own Gemini API Key dynamically, which is sent via custom request headers.

## 2. Pivots & Approach Changes
- **Live Database execution over Mock API**: Initially, we considered using client-side mock responses for common questions. We pivoted to executing true, live SQL against the SQLite database. This guarantees that *any* logical question (even if unstructured) evaluates to exact metrics rather than approximations.
- **Auto-Generating Charts**: We initially considered integrating visual packages like Recharts, but pivoted to dynamic pure HTML/CSS bar visualization. This eliminates dependency overhead and automatically scales bar widths based on database return column data types (label and values).

## 3. Initial Design Brief / Scratchpad
```markdown
# FMCG Beverage AI Assistant Design Brief

## Goal
Build a natural-language-to-SQL dashboard app that analyzes Sales and Inventory metrics across stores and regions.

## Tech Stack
- Frontend: React (Vite) + CSS Variables / Flexbox
- Backend: Node.js Express Server
- Database: SQLite
- LLM API: Google Gemini 1.5 Flash (via @google/generative-ai)

## Core Tasks
1. Generate synthetic data for 15 beverage products, 24 stores, 16 weeks.
2. Build /api/chat Express backend.
3. Build /api/overview dashboard statistics compiler.
4. Design the React chat assistant and Explorer grid.
```

## 4. Thinking Transcript (Representative Developer Conversation)
```text
Developer: "We need to build a natural language interface for FMCG beverage analytics. What is the best database schema?"
AI assistant: "A standard dimensional model works best here:
- store_master (store_id, store_name, region, city, store_format)
- product_master (product_id, product_name, brand, category, sub_category, pack_size_ml, unit_price)
- sales_promotions (week_start_date, product_id, store_id, units_sold, revenue, promotion_flag, promotion_type, discount_pct)
- inventory (week_start_date, product_id, store_id, opening_stock, units_received, units_sold, closing_stock, stockout_flag)"

Developer: "How do we ensure Gemini does not execute harmful SQL commands?"
AI assistant: "We will restrict execution on the backend: only execute queries starting with 'SELECT'. We will instruct the LLM specifically to only write 'SELECT' queries and enforce JSON validation before execution."
```
