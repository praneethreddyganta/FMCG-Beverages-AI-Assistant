import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  
  // Chat States
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'assistant',
      text: "Hello! I am your FMCG Beverage Analytics Assistant. You can ask me questions about sales, promotions, store locations, or inventory levels. For example:\n\n* *'Which region generates the highest revenue?'*\n* *'Show me top 5 products by units sold.'*\n* *'List weeks that had stockouts for Volt Energy drinks.'*\n\n*(Make sure to add your Gemini API Key in the top header if not set on the server!)*"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Database Explorer States
  const [explorerTab, setExplorerTab] = useState('product_master');
  const [explorerRows, setExplorerRows] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);

  const chatEndRef = useRef(null);

  // Load overview metrics
  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();
      if (res.ok) {
        setOverviewData(data);
      } else {
        console.error('Error fetching overview:', data.error);
      }
    } catch (err) {
      console.error('Network error loading overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  // Load explorer table data
  const loadExplorerTable = async (tableName) => {
    setExplorerLoading(true);
    try {
      // We can query table records by passing a simple SQL query to the chat API
      // to keep it unified and avoid adding special APIs!
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey
        },
        body: JSON.stringify({ message: `SELECT * FROM ${tableName} LIMIT 100` })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setExplorerRows(data.data);
      } else {
        // Fallback: if Gemini key isn't set, try running a direct query or set empty
        setExplorerRows([]);
      }
    } catch (err) {
      console.error('Error loading explorer table:', err);
      setExplorerRows([]);
    } finally {
      setExplorerLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'explorer') {
      loadExplorerTable(explorerTab);
    }
  }, [currentTab, explorerTab, apiKey]);

  // Handle Gemini API Key change
  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Submit chat query
  const handleChatSubmit = async (e, customMessage = null) => {
    if (e) e.preventDefault();
    const query = customMessage || chatInput;
    if (!query.trim()) return;

    if (!customMessage) setChatInput('');

    // Append user message
    setChatHistory(prev => [...prev, { sender: 'user', text: query }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey
        },
        body: JSON.stringify({ message: query })
      });
      const data = await res.json();

      if (res.ok) {
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: data.answer || 'No response returned.',
          sql: data.sql,
          explanation: data.explanation,
          data: data.data,
          error: data.error
        }]);
        // Proactively refresh dashboard if they asked a question (which might mean they changed data, or just to sync)
        loadOverview();
      } else {
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: `**Error:** ${data.error || 'Something went wrong.'}`
        }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, {
        sender: 'assistant',
        text: `**Network Error:** Failed to connect to backend server. Make sure the backend server is running on port 5001.`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Simple Markdown Renderer (Supports bold, bullet points, headers, inline code)
  const renderMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bullet points
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const content = line.trim().substring(2);
        return <li key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(content) }} />;
      }
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(4)) }} />;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} style={{ marginTop: '16px', marginBottom: '8px' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(3)) }} />;
      }
      // Paragraphs
      return <p key={idx} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />;
    });
  };

  const parseInlineMarkdown = (text) => {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #38bdf8;">$1</code>');
  };

  // Auto-chart logic: Inspect data rows and identify label/numeric fields
  const detectAndRenderChart = (data) => {
    if (!data || data.length === 0) return null;
    
    // Find first text/label column and first numeric column
    const keys = Object.keys(data[0]);
    let labelKey = null;
    let valueKey = null;

    for (const key of keys) {
      const sampleVal = data[0][key];
      if (typeof sampleVal === 'number' && !key.toLowerCase().includes('id') && key !== 'stockout_flag') {
        valueKey = key;
      } else if (typeof sampleVal === 'string' && !labelKey) {
        labelKey = key;
      }
    }

    // Fallback search
    if (!labelKey) labelKey = keys[0];
    if (!valueKey) {
      // Look for any number
      for (const key of keys) {
        if (typeof data[0][key] === 'number') {
          valueKey = key;
          break;
        }
      }
    }

    if (!valueKey || data.length < 2) return null;

    // Render horizontal bar chart
    const maxVal = Math.max(...data.map(r => r[valueKey] || 1));
    const labelTitle = labelKey.replace(/_/g, ' ').toUpperCase();
    const valueTitle = valueKey.replace(/_/g, ' ').toUpperCase();

    // Limit to top 8 items for visual sanity
    const sliceData = data.slice(0, 8);

    return (
      <div className="chart-card" style={{ marginTop: '16px', border: '1px dashed rgba(59, 130, 246, 0.3)' }}>
        <div className="chart-header">
          <span className="chart-title">Visual Comparison</span>
          <span className="chart-subtitle">{valueTitle} by {labelTitle}</span>
        </div>
        <div className="visual-bar-container">
          {sliceData.map((row, idx) => {
            const val = row[valueKey] || 0;
            const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const labelStr = row[labelKey] || 'N/A';
            return (
              <div className="bar-row" key={idx}>
                <div className="bar-label" title={labelStr}>{labelStr}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="bar-value">
                  {typeof val === 'number' && val % 1 !== 0 ? val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : val.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper: Format large numbers
  const formatNum = (val) => {
    if (val === null || val === undefined) return '0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">F</div>
          <span className="brand-name">Beverage AI</span>
        </div>

        <nav className="nav-links">
          <li 
            className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            Dashboard
          </li>
          <li 
            className={`nav-item ${currentTab === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentTab('chat')}
          >
            AI Analytics Chat
          </li>
          <li 
            className={`nav-item ${currentTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setCurrentTab('explorer')}
          >
            Database Explorer
          </li>
        </nav>

        <div className="sidebar-footer">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            FMCG Assessment v1.0
          </span>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-title">
            {currentTab === 'dashboard' && 'Category Executive Dashboard'}
            {currentTab === 'chat' && 'Conversational SQL Assistant'}
            {currentTab === 'explorer' && 'Beverage Division DB Schema'}
          </div>

          <div className="api-key-container">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gemini API Key:</span>
            <input 
              type="password" 
              className="api-key-input"
              placeholder="Paste GEMINI_API_KEY..."
              value={apiKey}
              onChange={handleApiKeyChange}
            />
          </div>
        </header>

        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && (
          <div className="panel-container">
            {overviewLoading ? (
              <div className="empty-chat-state">
                <div className="loading-dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
                <span>Computing live SQLite database metrics...</span>
              </div>
            ) : (
              <>
                {/* Stats cards */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-title">Total Division Revenue</div>
                    <div className="stat-value">{formatNum(overviewData?.metrics?.totalRevenue)}</div>
                    <div className="stat-desc">Accumulated 16-week sales volume</div>
                  </div>
                  <div className="stat-card success">
                    <div className="stat-title">Units Distributed</div>
                    <div className="stat-value">{(overviewData?.metrics?.totalUnits || 0).toLocaleString()}</div>
                    <div className="stat-desc">Total bottles/cans sold</div>
                  </div>
                  <div className="stat-card warning">
                    <div className="stat-title">Avg Promo Discount</div>
                    <div className="stat-value">{overviewData?.metrics?.avgDiscount?.toFixed(1)}%</div>
                    <div className="stat-desc">Weighted markdown rate</div>
                  </div>
                  <div className="stat-card danger">
                    <div className="stat-title">Operational Stockout Rate</div>
                    <div className="stat-value">{overviewData?.metrics?.stockoutRate?.toFixed(1)}%</div>
                    <div className="stat-desc">Inventory stock-out events</div>
                  </div>
                </div>

                {/* Dashboard charts */}
                <div className="dashboard-grid">
                  {/* Chart 1: Revenue by Region */}
                  <div className="chart-card">
                    <div className="chart-header">
                      <span className="chart-title">Revenue Contribution by Region</span>
                      <span className="chart-subtitle">Regional performance breakdown</span>
                    </div>
                    <div className="visual-bar-container">
                      {overviewData?.charts?.salesByRegion?.map((row, idx) => {
                        const maxVal = Math.max(...overviewData.charts.salesByRegion.map(r => r.value));
                        const pct = (row.value / maxVal) * 100;
                        return (
                          <div className="bar-row" key={idx}>
                            <div className="bar-label">{row.name}</div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="bar-value">{formatNum(row.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart 2: Top Selling Products */}
                  <div className="chart-card">
                    <div className="chart-header">
                      <span className="chart-title">Top 5 Products by Revenue</span>
                      <span className="chart-subtitle">Beverage product master leaders</span>
                    </div>
                    <div className="visual-bar-container">
                      {overviewData?.charts?.topProducts?.map((row, idx) => {
                        const maxVal = Math.max(...overviewData.charts.topProducts.map(r => r.value));
                        const pct = (row.value / maxVal) * 100;
                        return (
                          <div className="bar-row" key={idx}>
                            <div className="bar-label" title={row.name}>{row.name}</div>
                            <div className="bar-track">
                              <div className="bar-fill success" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="bar-value">{formatNum(row.value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Chart 3: Category Breakdowns */}
                <div className="chart-card" style={{ minHeight: 'auto', marginBottom: '32px' }}>
                  <div className="chart-header">
                    <span className="chart-title">Sales by Beverage Category</span>
                    <span className="chart-subtitle">Product group distribution</span>
                  </div>
                  <div className="visual-bar-container" style={{ gap: '16px', padding: '10px 0' }}>
                    {overviewData?.charts?.salesByCategory?.map((row, idx) => {
                      const maxVal = Math.max(...overviewData.charts.salesByCategory.map(r => r.value));
                      const pct = (row.value / maxVal) * 100;
                      return (
                        <div className="bar-row" key={idx}>
                          <div className="bar-label">{row.name}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
                          </div>
                          <div className="bar-value">{formatNum(row.value)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Chat Assistant Tab */}
        {currentTab === 'chat' && (
          <div className="chat-panel">
            <div className="chat-messages">
              {chatHistory.map((bubble, idx) => (
                <div className={`chat-bubble ${bubble.sender}`} key={idx}>
                  <div className="bubble-sender">
                    {bubble.sender === 'user' ? 'You' : 'Beverage AI Analyst'}
                  </div>
                  <div className="bubble-content">
                    {bubble.sender === 'user' ? (
                      <p>{bubble.text}</p>
                    ) : (
                      <div className="markdown-body">
                        {renderMarkdown(bubble.text)}
                        
                        {/* Display Database query error if any */}
                        {bubble.error && (
                          <div style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '6px', padding: '12px', marginTop: '12px', background: 'rgba(239, 68, 68, 0.05)' }}>
                            {bubble.error}
                          </div>
                        )}

                        {/* SQL block if query succeeded */}
                        {bubble.sql && (
                          <SQLViewer sql={bubble.sql} explanation={bubble.explanation} />
                        )}

                        {/* SQL query data table preview */}
                        {bubble.data && bubble.data.length > 0 && (
                          <DataTableView data={bubble.data} />
                        )}

                        {/* Visual Chart if dataset matches */}
                        {bubble.data && detectAndRenderChart(bubble.data)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="chat-bubble assistant">
                  <div className="bubble-sender">Beverage AI Analyst</div>
                  <div className="bubble-content">
                    <div className="loading-dots">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="chat-input-area">
              {chatHistory.length === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Suggested Queries:</span>
                  <div className="suggested-queries">
                    <button 
                      className="suggested-btn"
                      onClick={(e) => handleChatSubmit(e, "Which stores formats have the highest units sold?")}
                    >
                      🏬 Stores Format Performance
                    </button>
                    <button 
                      className="suggested-btn"
                      onClick={(e) => handleChatSubmit(e, "How did BOGO promotions impact Pure Orange Juice revenue?")}
                    >
                      🍊 BOGO Promotion Lift
                    </button>
                    <button 
                      className="suggested-btn"
                      onClick={(e) => handleChatSubmit(e, "Compare weekly opening stock versus closing stock for Fizz Cola in Delhi.")}
                    >
                      🥤 Inventory Stock Trends
                    </button>
                    <button 
                      className="suggested-btn"
                      onClick={(e) => handleChatSubmit(e, "Which product brands had the most stockout events?")}
                    >
                      ⚠️ Product Brands Stockouts
                    </button>
                  </div>
                </div>
              )}
              <form className="chat-input-form" onSubmit={handleChatSubmit}>
                <input 
                  type="text" 
                  className="chat-input"
                  placeholder="Ask a question (e.g. 'Compare sales revenue across all regions'...)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="chat-submit-btn" disabled={chatLoading || !chatInput.trim()}>
                  Submit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Database Explorer Tab */}
        {currentTab === 'explorer' && (
          <div className="panel-container">
            <div className="explorer-tabs">
              <button 
                className={`tab-btn ${explorerTab === 'product_master' ? 'active' : ''}`}
                onClick={() => setExplorerTab('product_master')}
              >
                product_master
              </button>
              <button 
                className={`tab-btn ${explorerTab === 'store_master' ? 'active' : ''}`}
                onClick={() => setExplorerTab('store_master')}
              >
                store_master
              </button>
              <button 
                className={`tab-btn ${explorerTab === 'sales_promotions' ? 'active' : ''}`}
                onClick={() => setExplorerTab('sales_promotions')}
              >
                sales_promotions
              </button>
              <button 
                className={`tab-btn ${explorerTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setExplorerTab('inventory')}
              >
                inventory
              </button>
            </div>

            <div className="explorer-card">
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Viewing top 100 rows from table: <strong>{explorerTab}</strong>
                </span>
                <button 
                  className="tab-btn" 
                  style={{ fontSize: '0.85rem' }} 
                  onClick={() => loadExplorerTable(explorerTab)}
                >
                  🔄 Refresh Data
                </button>
              </div>

              {explorerLoading ? (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="loading-dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              ) : (
                <div className="table-wrapper">
                  {explorerRows.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          {Object.keys(explorerRows[0]).map((col, idx) => (
                            <th key={idx}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {explorerRows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx}>{val === null ? 'NULL' : val.toString()}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No data loaded. Make sure your SQLite database exists and Gemini API key is configured.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// SQL Code Collapsible Viewer component
function SQLViewer({ sql, explanation }) {
  const [showSql, setShowSql] = useState(false);
  return (
    <div className="sql-query-viewer">
      <div className="sql-header">
        <span>{explanation || 'Generated SQLite Query'}</span>
        <button className="sql-toggle" onClick={() => setShowSql(!showSql)}>
          {showSql ? 'Hide SQL Code' : 'Show SQL Code'}
        </button>
      </div>
      {showSql && (
        <pre className="sql-code"><code>{sql}</code></pre>
      )}
    </div>
  );
}

// Spreadsheet Table Preview Component
function DataTableView({ data }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? data : data.slice(0, 5);

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Database Query Output ({data.length} records)</span>
        {data.length > 5 && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            {expanded ? 'Show Less' : `Show All ${data.length} Rows`}
          </button>
        )}
      </div>
      <div className="result-table-container">
        <table className="data-table">
          <thead>
            <tr>
              {Object.keys(data[0]).map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {Object.values(row).map((val, cIdx) => (
                  <td key={cIdx}>
                    {val === null ? 'NULL' : (typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : val.toString())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
