# M9: Reflection

## 1. Version 2.0 Improvements
If building a second version, we would focus on these three enhancements:
- **Semantic Caching Layer**: Add a Redis cache that maps semantic queries to previously executed SQL results. If a user asks the same question (or close variants), we skip LLM call overhead entirely, decreasing user response latency to <100ms and reducing token costs.
- **Dynamic File Exports**: Integrate visual download capabilities where tables can be exported directly to CSV or Excel spreadsheet formats, and narrative summaries are exportable as formatted PDF briefs.
- **Multi-Agent Orchestration**: Separate the assistant into a multi-agent team: a *Data Finder Agent* that handles SQL generation, a *Visualization Agent* that selects optimal chart configurations (e.g. line, bar, pie), and a *Copywriter Agent* that checks the business summary for mathematical accuracy.

## 2. Core Learnings
- **Prompt Constraint Rigorousness**: We learned that SQLite syntax requires strict constraints in the prompt (e.g., date formats, using standard aggregation syntax, avoiding advanced operations like recursive CTEs). Explicitly writing rules in system prompts prevents LLM syntax errors.
- **Interactive UI Trust**: Non-technical business users are highly skeptical of AI responses. By introducing an expandable SQL viewer and raw data tables alongside the narrative answer, we drastically increase transparency and allow developers to verify the reasoning step-by-step.
- **Vibe Coding with strict schema definitions**: Setting up a clean, single-point schema string (`SCHEMA_DESC`) makes it easy to integrate both backend SQL validation and prompt generation from one single source of truth.

## 3. System Failure Points
Our current system theoretically breaks or fails in the following areas:
- **Ambiguity & Subjectivity**: If a user asks *"Is Volt Energy selling well?"*, the assistant will struggle because "selling well" is subjective. Without specific logic (like "revenue > $10,000" or "volume growth > 5% week-over-week"), the LLM might hallucinate a query or return syntax errors.
- **SQL Locking & Concurrency Limits**: Since the application uses SQLite, it is file-locked. If dozens of users query the assistant simultaneously, SQLite will encounter database lock exceptions (`SQLITE_BUSY`).
- **Token Limits on High Volume Data**: If a query returns hundreds of thousands of rows of transactional data, passing all raw records back to the Gemini summary model would exceed the context window size or consume huge amounts of tokens. (A pagination or aggregation cap is required).
