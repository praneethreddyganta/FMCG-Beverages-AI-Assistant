# M6: Build & Code

## 1. GitHub Repository Link
*(You can paste your git repository link here, e.g., https://github.com/praneethreddyganta/FMCG-Beverages-AI-Assistant)*

## 2. Biggest Technical Issue Faced
- **SDK Class Name & Constructor Mismatch**: During the initial server boot, we encountered a `SyntaxError` stating that the `@google/generative-ai` package did not provide an export named `GoogleGenAI`. 
- Additionally, the constructor signatures differed from the newer unified SDK syntax (which accepts `{ apiKey: key }`), whereas the installed classic SDK required passing the API key string directly as a single argument.

## 3. Resolution Documentation
To resolve this issue, we took the following steps:
1. **Inspected Package Exports**: We reviewed the API surface of the installed `@google/generative-ai` package.
2. **Updated Import Named Exports**: We changed the import declaration in `server.js` from:
   ```javascript
   import { GoogleGenAI } from '@google/generative-ai';
   ```
   to:
   ```javascript
   import { GoogleGenerativeAI } from '@google/generative-ai';
   ```
3. **Modified Constructor Call**: We updated the client initialization code to pass the string parameter directly instead of an object config:
   ```javascript
   // OLD (Failing)
   return new GoogleGenAI({ apiKey: key });

   // NEW (Working)
   return new GoogleGenerativeAI(key);
   ```
4. **Verified Local Startup**: We ran `node server.js` and verified that the server started successfully without compilation errors and properly connected to `fmcg_beverages.db`.
