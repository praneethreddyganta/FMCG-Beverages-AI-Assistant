import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DB_PATH = path.join(PROJECT_ROOT, 'fmcg_beverages.db');

// Helper: Random helper functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function main() {
  // Delete database file if exists to start fresh
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new sqlite3.Database(DB_PATH);

  // Wrap db calls in a Promise helper
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log("Creating tables...");
  
  await run(`
    CREATE TABLE product_master (
        product_id TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        pack_size_ml INTEGER NOT NULL,
        unit_price REAL NOT NULL
    );
  `);

  await run(`
    CREATE TABLE store_master (
        store_id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        region TEXT NOT NULL,
        city TEXT NOT NULL,
        store_format TEXT NOT NULL
    );
  `);

  await run(`
    CREATE TABLE sales_promotions (
        week_start_date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        region TEXT NOT NULL,
        units_sold INTEGER NOT NULL,
        revenue REAL NOT NULL,
        promotion_flag INTEGER NOT NULL,
        promotion_type TEXT,
        discount_pct REAL NOT NULL,
        FOREIGN KEY (product_id) REFERENCES product_master(product_id),
        FOREIGN KEY (store_id) REFERENCES store_master(store_id)
    );
  `);

  await run(`
    CREATE TABLE inventory (
        week_start_date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        opening_stock INTEGER NOT NULL,
        units_received INTEGER NOT NULL,
        units_sold INTEGER NOT NULL,
        closing_stock INTEGER NOT NULL,
        stockout_flag INTEGER NOT NULL,
        FOREIGN KEY (product_id) REFERENCES product_master(product_id),
        FOREIGN KEY (store_id) REFERENCES store_master(store_id)
    );
  `);

  // Insert Products
  const products = [
    ["BEV-001", "Fizz Cola 500ml", "Fizz", "Carbonated", "Cola", 500, 1.50],
    ["BEV-002", "Fizz Orange 500ml", "Fizz", "Carbonated", "Fruit Flavoured", 500, 1.50],
    ["BEV-003", "Fizz Cola Zero 500ml", "Fizz", "Carbonated", "Cola", 500, 1.60],
    ["BEV-004", "Pure Orange Juice 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.50],
    ["BEV-005", "Pure Apple Juice 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.50],
    ["BEV-006", "Pure Mango Blend 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.80],
    ["BEV-007", "Spark Lemon Sparkling 500ml", "Spark", "Water", "Sparkling Water", 500, 1.20],
    ["BEV-008", "Spark Lime Sparkling 500ml", "Spark", "Water", "Sparkling Water", 500, 1.20],
    ["BEV-009", "Alpine Spring Water 1.5L", "Alpine", "Water", "Still Water", 1500, 1.00],
    ["BEV-010", "Alpine Spring Water 500ml", "Alpine", "Water", "Still Water", 500, 0.60],
    ["BEV-011", "Volt Energy Original 250ml", "Volt", "Energy", "Energy Drink", 250, 2.20],
    ["BEV-012", "Volt Energy Sugarfree 250ml", "Volt", "Energy", "Energy Drink", 250, 2.20],
    ["BEV-013", "Volt Energy Blue Ice 250ml", "Volt", "Energy", "Energy Drink", 250, 2.40],
    ["BEV-014", "Moo Chocolate Milk 250ml", "Moo", "Dairy", "Flavoured Milk", 250, 1.80],
    ["BEV-015", "Moo Strawberry Milk 250ml", "Moo", "Dairy", "Flavoured Milk", 250, 1.80],
  ];

  const prodStmt = db.prepare("INSERT INTO product_master VALUES (?,?,?,?,?,?,?)");
  products.forEach(p => prodStmt.run(p));
  prodStmt.finalize();

  // Insert Stores
  const regions = ["North", "South", "East", "West"];
  const cities = {
    "North": ["Delhi", "Chandigarh"],
    "South": ["Bangalore", "Chennai"],
    "East": ["Kolkata", "Guwahati"],
    "West": ["Mumbai", "Pune"]
  };
  const formats = ["Supermarket", "Hypermarket", "Convenience", "Wholesale"];

  const stores = [];
  let storeCounter = 1;
  for (const region of regions) {
    for (const city of cities[region]) {
      for (const fmt of formats) {
        const storeId = `STR-${String(storeCounter).padStart(3, '0')}`;
        const storeName = `${fmt} ${city} #${storeCounter}`;
        stores.push([storeId, storeName, region, city, fmt]);
        storeCounter++;
      }
    }
  }

  const storeStmt = db.prepare("INSERT INTO store_master VALUES (?,?,?,?,?)");
  stores.forEach(s => storeStmt.run(s));
  storeStmt.finalize();

  // Generate Weeks (16 weeks)
  const weeks = [];
  let currentDate = new Date(2024, 0, 1); // Monday, Jan 1, 2024
  for (let i = 0; i < 16; i++) {
    weeks.push(formatDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Populate Sales and Inventory
  console.log("Generating transaction logs...");
  const promoTypes = ["Price Cut", "BOGO", "Display Feature", "Bundle"];
  const promoDiscounts = {
    "Price Cut": 0.15,
    "BOGO": 0.50,
    "Display Feature": 0.10,
    "Bundle": 0.20
  };

  const currentInventoryStock = {}; // key: storeId_prodId -> closing_stock

  const salesStmt = db.prepare("INSERT INTO sales_promotions VALUES (?,?,?,?,?,?,?,?,?)");
  const invStmt = db.prepare("INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?)");

  db.serialize(() => {
    for (const week of weeks) {
      for (const store of stores) {
        const [storeId, , region, , storeFormat] = store;
        for (const prod of products) {
          const [prodId, , , , , , unitPrice] = prod;

          // Base sales by format
          let baseSales = 30;
          if (storeFormat === "Wholesale") baseSales = getRandomInt(150, 300);
          else if (storeFormat === "Hypermarket") baseSales = getRandomInt(80, 160);
          else if (storeFormat === "Supermarket") baseSales = getRandomInt(40, 90);
          else baseSales = getRandomInt(15, 40);

          // Promotion probability (15%)
          const isPromo = Math.random() < 0.15 ? 1 : 0;
          let promoType = null;
          let discountPct = 0.0;
          let salesUplift = 1.0;

          if (isPromo) {
            promoType = getRandomChoice(promoTypes);
            discountPct = promoDiscounts[promoType];
            if (promoType === "BOGO") salesUplift = getRandomFloat(4.0, 5.0);
            else if (promoType === "Price Cut") salesUplift = getRandomFloat(3.0, 4.0);
            else salesUplift = getRandomFloat(2.0, 3.0);
          }

          const noise = getRandomFloat(0.9, 1.1);
          let unitsSold = Math.floor(baseSales * salesUplift * noise);
          let discountedPrice = unitPrice * (1.0 - discountPct);
          let revenue = parseFloat((unitsSold * discountedPrice).toFixed(2));

          // Inventory calculation
          const invKey = `${storeId}_${prodId}`;
          let openingStock = 0;
          if (week === weeks[0]) {
            openingStock = Math.floor(baseSales * 2.5 * getRandomFloat(1.2, 1.5));
          } else {
            openingStock = currentInventoryStock[invKey];
          }

          // Replenish stock (8% delay chance triggers stockouts)
          let unitsReceived = 0;
          if (Math.random() >= 0.08) {
            unitsReceived = Math.floor(baseSales * getRandomFloat(1.0, 1.3));
          }

          const availableStock = openingStock + unitsReceived;
          let stockoutFlag = 0;
          let closingStock = 0;

          if (availableStock <= unitsSold) {
            unitsSold = availableStock;
            closingStock = 0;
            stockoutFlag = 1;
            revenue = parseFloat((unitsSold * discountedPrice).toFixed(2));
          } else {
            closingStock = availableStock - unitsSold;
          }

          currentInventoryStock[invKey] = closingStock;

          salesStmt.run(week, prodId, storeId, region, unitsSold, revenue, isPromo, promoType, discountPct);
          invStmt.run(week, prodId, storeId, openingStock, unitsReceived, unitsSold, closingStock, stockoutFlag);
        }
      }
    }

    salesStmt.finalize();
    invStmt.finalize();

    db.close((err) => {
      if (err) console.error("Error closing DB:", err);
      else console.log("Database built successfully via Javascript!");
    });
  });

  // Write CSV exports for portal confirmation
  // We can write a simple helper to export the first 100 records to CSV
  exportCSV("product_master", ["product_id", "product_name", "brand", "category", "sub_category", "pack_size_ml", "unit_price"], products);
  exportCSV("store_master", ["store_id", "store_name", "region", "city", "store_format"], stores);
}

function exportCSV(tableName, headers, data) {
  const csvPath = path.join(PROJECT_ROOT, `${tableName}_sample.csv`);
  const lines = [headers.join(',')];
  // Slice to max 100 rows for sample
  data.slice(0, 100).forEach(row => {
    lines.push(row.map(val => typeof val === 'string' && val.includes(',') ? `"${val}"` : val).join(','));
  });
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
  console.log(`Exported Javascript sample CSV: ${csvPath}`);
}

main().catch(err => console.error("Error running database creator:", err));
