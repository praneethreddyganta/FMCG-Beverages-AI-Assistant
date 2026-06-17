# M5: Data Pipeline

## 1. Core Datasets Used
Our solution runs on four synchronized tables in SQLite:
- `product_master`: Dimensions of 15 beverages under brands like Fizz, PureLife, Spark, Alpine, Volt, and Moo.
- `store_master`: Dimensions of 24 store locations across 4 formats (Supermarket, Hypermarket, Convenience, Wholesale) and 4 regions (North, South, East, West).
- `sales_promotions`: Weekly transaction records tracking `units_sold`, `revenue`, `promotion_flag`, `promotion_type`, and `discount_pct`.
- `inventory`: Weekly inventory logs tracking `opening_stock`, `units_received`, `units_sold`, `closing_stock`, and `stockout_flag`.

## 2. Dataset Rationale
- **Dimensional Separations**: Keeping store and product attributes separate from transactional databases ensures normal form compliance, reducing redundancy when executing SQL join operations.
- **Granular Promos**: By modeling promotion types (BOGO, Price Cut, Display Feature, Bundle) as explicit columns, the AI can query direct questions like: *"What is the revenue increase for BOGO vs Price Cut?"*.
- **Stockout Integration**: The inventory table includes `stockout_flag` and matches `units_sold` with the sales table to ensure transaction consistency, enabling cross-table analytical insights.

## 3. Generation Method
- **Method Selected**: Synthetic
- **Method Explanation**: A custom Python script (`generate_data.py`) was written to populate a SQLite database dynamically. The generator models specific brand baseline sales, region-level noise, and distinct promotional lifts (e.g. 4.5x sales spikes on BOGO weeks) to provide clear patterns for the AI to reason over.

## 4. Challenges
- **Coherence between Sales & Inventory**: The biggest challenge was ensuring that inventory values (opening_stock, units_received, units_sold, closing_stock) remained logically coherent across weeks without dipping below zero. 
- **Resolution**: The generation script calculates a weekly state for each product-store combination:
  `closing_stock = (opening_stock + units_received) - units_sold`
  If a random baseline sale exceeded available stock, the script capped `units_sold` to `opening_stock + units_received`, calculated `closing_stock = 0`, and set `stockout_flag = 1`. This matched actual sales transactions to physical inventory limitations.
