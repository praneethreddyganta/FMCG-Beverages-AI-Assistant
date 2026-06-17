import sqlite3
import random
import csv
from datetime import datetime, timedelta

# Database path
DB_PATH = "/Users/gantapraneethreddy/Desktop/DEMO/Assignment/fmcg_beverages.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Drop existing tables
    cursor.execute("DROP TABLE IF EXISTS sales_promotions;")
    cursor.execute("DROP TABLE IF EXISTS inventory;")
    cursor.execute("DROP TABLE IF EXISTS product_master;")
    cursor.execute("DROP TABLE IF EXISTS store_master;")

    # 1. Create Tables
    cursor.execute("""
    CREATE TABLE product_master (
        product_id TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        pack_size_ml INTEGER NOT NULL,
        unit_price REAL NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE store_master (
        store_id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        region TEXT NOT NULL,
        city TEXT NOT NULL,
        store_format TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE sales_promotions (
        week_start_date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        region TEXT NOT NULL,
        units_sold INTEGER NOT NULL,
        revenue REAL NOT NULL,
        promotion_flag INTEGER NOT NULL, -- 0 or 1
        promotion_type TEXT,
        discount_pct REAL NOT NULL,
        FOREIGN KEY (product_id) REFERENCES product_master(product_id),
        FOREIGN KEY (store_id) REFERENCES store_master(store_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE inventory (
        week_start_date TEXT NOT NULL,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        opening_stock INTEGER NOT NULL,
        units_received INTEGER NOT NULL,
        units_sold INTEGER NOT NULL,
        closing_stock INTEGER NOT NULL,
        stockout_flag INTEGER NOT NULL, -- 0 or 1
        FOREIGN KEY (product_id) REFERENCES product_master(product_id),
        FOREIGN KEY (store_id) REFERENCES store_master(store_id)
    );
    """)

    # 2. Insert Products (15 products, 5 categories)
    products = [
        # (product_id, name, brand, category, sub_category, pack_size, unit_price)
        ("BEV-001", "Fizz Cola 500ml", "Fizz", "Carbonated", "Cola", 500, 1.50),
        ("BEV-002", "Fizz Orange 500ml", "Fizz", "Carbonated", "Fruit Flavoured", 500, 1.50),
        ("BEV-003", "Fizz Cola Zero 500ml", "Fizz", "Carbonated", "Cola", 500, 1.60),
        
        ("BEV-004", "Pure Orange Juice 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.50),
        ("BEV-005", "Pure Apple Juice 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.50),
        ("BEV-006", "Pure Mango Blend 1L", "PureLife", "Juice", "Fruit Juice", 1000, 3.80),
        
        ("BEV-007", "Spark Lemon Sparkling 500ml", "Spark", "Water", "Sparkling Water", 500, 1.20),
        ("BEV-008", "Spark Lime Sparkling 500ml", "Spark", "Water", "Sparkling Water", 500, 1.20),
        ("BEV-009", "Alpine Spring Water 1.5L", "Alpine", "Water", "Still Water", 1500, 1.00),
        ("BEV-010", "Alpine Spring Water 500ml", "Alpine", "Water", "Still Water", 500, 0.60),
        
        ("BEV-011", "Volt Energy Original 250ml", "Volt", "Energy", "Energy Drink", 250, 2.20),
        ("BEV-012", "Volt Energy Sugarfree 250ml", "Volt", "Energy", "Energy Drink", 250, 2.20),
        ("BEV-013", "Volt Energy Blue Ice 250ml", "Volt", "Energy", "Energy Drink", 250, 2.40),
        
        ("BEV-014", "Moo Chocolate Milk 250ml", "Moo", "Dairy", "Flavoured Milk", 250, 1.80),
        ("BEV-015", "Moo Strawberry Milk 250ml", "Moo", "Dairy", "Flavoured Milk", 250, 1.80),
    ]
    cursor.executemany("INSERT INTO product_master VALUES (?,?,?,?,?,?,?)", products)

    # 3. Insert Stores (24 stores across 4 regions)
    regions = ["North", "South", "East", "West"]
    cities = {
        "North": ["Delhi", "Chandigarh"],
        "South": ["Bangalore", "Chennai"],
        "East": ["Kolkata", "Guwahati"],
        "West": ["Mumbai", "Pune"]
    }
    formats = ["Supermarket", "Hypermarket", "Convenience", "Wholesale"]

    stores = []
    store_counter = 1
    # Create 24 stores evenly spread
    for region in regions:
        for city in cities[region]:
            for fmt in formats:
                store_id = f"STR-{store_counter:03d}"
                store_name = f"{fmt} {city} #{store_counter}"
                stores.append((store_id, store_name, region, city, fmt))
                store_counter += 1
                
    cursor.executemany("INSERT INTO store_master VALUES (?,?,?,?,?)", stores)

    # 4. Generate Weeks (16 weeks)
    start_date = datetime(2024, 1, 1) # Monday
    weeks = [(start_date + timedelta(weeks=i)).strftime("%Y-%m-%d") for i in range(16)]

    # 5. Insert Sales & Promotions + Inventory
    # Keep random generation deterministic for reproducibility
    random.seed(42)

    sales_data = []
    inventory_data = []

    # Keep track of running inventory closing stock for each store-product combo
    # Key: (store_id, product_id), Value: closing_stock
    current_inventory_stock = {}

    promo_types = ["Price Cut", "BOGO", "Display Feature", "Bundle"]
    promo_discounts = {
        "Price Cut": 0.15,
        "BOGO": 0.50,
        "Display Feature": 0.10,
        "Bundle": 0.20
    }

    for week in weeks:
        for store in stores:
            store_id, _, region, _, store_format = store
            for prod in products:
                prod_id, _, _, category, _, _, unit_price = prod
                
                # Determine baseline units sold depending on store format and product
                if store_format == "Wholesale":
                    base_sales = random.randint(150, 300)
                elif store_format == "Hypermarket":
                    base_sales = random.randint(80, 160)
                elif store_format == "Supermarket":
                    base_sales = random.randint(40, 90)
                else: # Convenience
                    base_sales = random.randint(15, 40)
                
                # Introduce promotional flag (approx 15% probability)
                is_promo = 1 if random.random() < 0.15 else 0
                promo_type = None
                discount_pct = 0.0
                sales_uplift = 1.0

                if is_promo:
                    promo_type = random.choice(promo_types)
                    discount_pct = promo_discounts[promo_type]
                    # Uplifts: BOGO (4x to 5x), Price Cut (3x to 4x), others (2x to 3x)
                    if promo_type == "BOGO":
                        sales_uplift = random.uniform(4.0, 5.0)
                    elif promo_type == "Price Cut":
                        sales_uplift = random.uniform(3.0, 4.0)
                    else:
                        sales_uplift = random.uniform(2.0, 3.0)

                # Calculate units sold with uplift & random noise
                noise = random.uniform(0.9, 1.1)
                units_sold = int(base_sales * sales_uplift * noise)
                
                # Calculate revenue
                discounted_price = unit_price * (1.0 - discount_pct)
                revenue = round(units_sold * discounted_price, 2)

                # Inventory logic
                # Get last week's closing stock, default to a high starting value for week 1
                inv_key = (store_id, prod_id)
                if week == weeks[0]:
                    # Initialize opening stock (generous amount)
                    opening_stock = int(base_sales * 2.5 * random.uniform(1.2, 1.5))
                else:
                    opening_stock = current_inventory_stock[inv_key]

                # Determine units received (replenish what was sold last week + some buffer, but occasionally delay replenishment to trigger stockouts)
                if random.random() < 0.08: # 8% chance of delivery delay (causes stockouts!)
                    units_received = 0
                else:
                    # Replenish standard baseline + variance
                    units_received = int(base_sales * random.uniform(1.0, 1.3))

                # Compute available stock
                available_stock = opening_stock + units_received

                # Check if we stock out
                stockout_flag = 0
                if available_stock <= units_sold:
                    # Stockout happened! Capping units sold to available stock
                    units_sold = available_stock
                    closing_stock = 0
                    stockout_flag = 1
                    # Re-calculate revenue based on actual sales
                    revenue = round(units_sold * discounted_price, 2)
                else:
                    closing_stock = available_stock - units_sold

                # Store closing stock for next week
                current_inventory_stock[inv_key] = closing_stock

                # Append to datasets
                sales_data.append((
                    week, prod_id, store_id, region, units_sold, revenue, is_promo, promo_type, discount_pct
                ))
                
                inventory_data.append((
                    week, prod_id, store_id, opening_stock, units_received, units_sold, closing_stock, stockout_flag
                ))

    # Insert data
    cursor.executemany("INSERT INTO sales_promotions VALUES (?,?,?,?,?,?,?,?,?)", sales_data)
    cursor.executemany("INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?)", inventory_data)

    conn.commit()
    print("Database built successfully!")
    print(f"Generated {len(sales_data)} sales records.")
    print(f"Generated {len(inventory_data)} inventory records.")

    # 6. Export Samples to CSV
    export_csv("product_master", cursor)
    export_csv("store_master", cursor)
    export_csv("sales_promotions", cursor)
    export_csv("inventory", cursor)

    conn.close()

def export_csv(table_name, cursor):
    cursor.execute(f"SELECT * FROM {table_name} LIMIT 100;")
    rows = cursor.fetchall()
    cursor.execute(f"PRAGMA table_info({table_name});")
    headers = [col[1] for col in cursor.fetchall()]

    csv_path = f"/Users/gantapraneethreddy/Desktop/DEMO/Assignment/{table_name}_sample.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"Exported sample CSV: {csv_path}")

if __name__ == "__main__":
    main()
