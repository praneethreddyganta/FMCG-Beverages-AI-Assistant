import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend in production
const PROJECT_ROOT = path.resolve(__dirname, '..');
app.use(express.static(path.join(PROJECT_ROOT, 'dist')));

const DB_PATH = path.join(PROJECT_ROOT, 'fmcg_beverages.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to FMCG Beverages database.');
  }
});

// Initialize Gemini API helper
const getAiClient = (req) => {
  const key = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
};

const SCHEMA_DESC = `
CREATE TABLE product_master (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    pack_size_ml INTEGER NOT NULL,
    unit_price REAL NOT NULL
);
CREATE TABLE store_master (
    store_id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    region TEXT NOT NULL,
    city TEXT NOT NULL,
    store_format TEXT NOT NULL
);
CREATE TABLE sales_promotions (
    week_start_date TEXT NOT NULL, -- Format YYYY-MM-DD
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    region TEXT NOT NULL, -- e.g. North, South, East, West
    units_sold INTEGER NOT NULL,
    revenue REAL NOT NULL,
    promotion_flag INTEGER NOT NULL, -- 0 for false, 1 for true
    promotion_type TEXT, -- 'Price Cut', 'BOGO', 'Display Feature', 'Bundle', or NULL
    discount_pct REAL NOT NULL, -- Decimal between 0.0 and 0.50
    FOREIGN KEY (product_id) REFERENCES product_master(product_id),
    FOREIGN KEY (store_id) REFERENCES store_master(store_id)
);
CREATE TABLE inventory (
    week_start_date TEXT NOT NULL, -- Format YYYY-MM-DD
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    opening_stock INTEGER NOT NULL,
    units_received INTEGER NOT NULL,
    units_sold INTEGER NOT NULL,
    closing_stock INTEGER NOT NULL,
    stockout_flag INTEGER NOT NULL, -- 0 for false, 1 for true
    FOREIGN KEY (product_id) REFERENCES product_master(product_id),
    FOREIGN KEY (store_id) REFERENCES store_master(store_id)
);
`;

// Helper: Run SQLite Query
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// API: Get schema info
app.get('/api/schema', (req, res) => {
  res.json({ schema: SCHEMA_DESC });
});

// API: Get dashboard overview data
app.get('/api/overview', async (req, res) => {
  try {
    const totalRevenue = await runQuery('SELECT SUM(revenue) as val FROM sales_promotions');
    const totalUnits = await runQuery('SELECT SUM(units_sold) as val FROM sales_promotions');
    const avgDiscount = await runQuery('SELECT AVG(discount_pct) * 100 as val FROM sales_promotions WHERE promotion_flag = 1');
    const stockoutRate = await runQuery('SELECT (SUM(stockout_flag) * 100.0) / COUNT(*) as val FROM inventory');
    const topBrand = await runQuery('SELECT brand as val, SUM(revenue) as rev FROM sales_promotions JOIN product_master USING(product_id) GROUP BY brand ORDER BY rev DESC LIMIT 1');
    
    const salesByRegion = await runQuery('SELECT region as name, SUM(revenue) as value FROM sales_promotions GROUP BY region');
    const salesByCategory = await runQuery('SELECT category as name, SUM(revenue) as value FROM sales_promotions JOIN product_master USING(product_id) GROUP BY category');
    const topProducts = await runQuery('SELECT product_name as name, SUM(revenue) as value FROM sales_promotions JOIN product_master USING(product_id) GROUP BY product_name ORDER BY value DESC LIMIT 5');

    res.json({
      metrics: {
        totalRevenue: totalRevenue[0]?.val || 0,
        totalUnits: totalUnits[0]?.val || 0,
        avgDiscount: avgDiscount[0]?.val || 0,
        stockoutRate: stockoutRate[0]?.val || 0,
        topBrand: topBrand[0]?.val || 'N/A'
      },
      charts: {
        salesByRegion,
        salesByCategory,
        topProducts
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard overview:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Core Chat and SQL execution
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message query is required' });
  }

  const ai = getAiClient(req);
  if (!ai) {
    return res.status(400).json({ 
      error: 'Gemini API key is missing. Please set the GEMINI_API_KEY environment variable or pass X-Gemini-API-Key header in the UI Settings.' 
    });
  }

  try {
    // 1. Ask Gemini to generate the SQL query
    const sqlModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const sqlPrompt = `
You are a expert business analyst database assistant for an FMCG Beverages team.
Your task is to translate the user's natural language question into a single valid SQLite query.
Here is the SQLite schema:
${SCHEMA_DESC}

Rules for SQL generation:
- Write ONLY a valid SQLite SELECT query.
- Do NOT generate INSERT, UPDATE, DELETE, or DROP.
- Join tables where necessary (e.g. join sales_promotions and product_master on product_id, or store_master on store_id).
- Ensure column names and table names match the schema exactly.
- If the user asks for "top products", rank by SUM(revenue) or SUM(units_sold) descending.
- If the user asks about "stockouts", look at the inventory table's stockout_flag (where 1 means stockout).
- When filtering regions, note that store_master.region or sales_promotions.region can be used.
- Return the SQL query wrapped in a clean JSON object containing:
  "sql": "the SQL query string",
  "explanation": "one sentence explaining how this query answers the user request"

IMPORTANT: Output MUST be a raw JSON object only. Do NOT use markdown code blocks or backticks.
Example Output format:
{"sql": "SELECT ...", "explanation": "..."}

User Question: "${message}"
`;

    const sqlResult = await sqlModel.generateContent(sqlPrompt);
    const sqlResponseText = sqlResult.response.text().trim();
    
    // Parse JSON
    let sqlData;
    try {
      // Clean up markdown block indicators if Gemini returned them despite instructions
      const cleanedText = sqlResponseText
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      sqlData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini SQL JSON response:', sqlResponseText);
      throw new Error(`Failed to parse generated SQL JSON response. Output was: ${sqlResponseText}`);
    }

    const generatedSql = sqlData.sql;
    if (!generatedSql) {
      throw new Error('No SQL query generated by AI.');
    }

    console.log('Executing SQL:', generatedSql);

    // 2. Execute SQL against database
    let queryResults;
    try {
      queryResults = await runQuery(generatedSql);
    } catch (dbErr) {
      return res.json({
        question: message,
        sql: generatedSql,
        error: `Database Execution Error: ${dbErr.message}`,
        explanation: sqlData.explanation
      });
    }

    // 3. Generate natural language explanation/summary of query results
    const summaryModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const summaryPrompt = `
You are a business intelligence agent for an FMCG Beverages division.
A business user asked: "${message}"
To answer this, we executed the following SQLite query:
\`\`\`sql
${generatedSql}
\`\`\`
And obtained this raw database output (max 50 rows shown):
${JSON.stringify(queryResults.slice(0, 50), null, 2)}

Please write a highly professional, conversational response summarizing these results.
- Keep it concise and easy to understand for business users (e.g. Sales Directors or Brand Managers).
- Highlight key facts, numbers, percentage changes, or specific products/stores where relevant.
- Do not mention technical database terms like "rows", "columns", "null values", or "SQL" in your summary. Speak in terms of sales, inventory, and promotions.
- Format the response in beautiful clean Markdown (use bullet points, bolding, or simple tables if helpful).
`;

    const summaryResult = await summaryModel.generateContent(summaryPrompt);
    const narrativeSummary = summaryResult.response.text();

    // 4. Return result to frontend
    res.json({
      question: message,
      sql: generatedSql,
      data: queryResults,
      explanation: sqlData.explanation,
      answer: narrativeSummary
    });

  } catch (err) {
    console.error('Error handling chat request:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback to React app router in production
app.get('*', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
