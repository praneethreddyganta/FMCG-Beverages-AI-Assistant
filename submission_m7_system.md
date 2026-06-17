# M7: System & Deployment

## 1. Deployment Type
- **Selected**: Hybrid / Local Only
- **Explanation**: The frontend can be compiled as static html/js assets via `npm run build` and hosted on Vercel or Netlify. The backend API Express server runs on a Node.js runtime (e.g. Render, Fly.io, or run locally) accessing the `fmcg_beverages.db` SQLite database file.

## 2. Local Setup and Deployment Guide
To run this solution locally:
1. **Clone the Repository**:
   ```bash
   git clone <repo-url>
   cd Assignment
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Generate SQLite Database**:
   ```bash
   python3 generate_data.py
   ```
4. **Set Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   PORT=5001
   ```
5. **Start Dev Server**:
   ```bash
   # Start the backend API server (runs on port 5001)
   node server.js
   
   # In a separate terminal, start the Vite frontend server (runs on port 3000)
   npx vite
   ```
6. **Access Dashboard**: Open `http://localhost:3000` in the browser. You can enter your Gemini API key in the top header if not configured in the `.env` file.
