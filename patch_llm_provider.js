const fs = require('fs');

let content = fs.readFileSync('server/llm_provider.ts', 'utf-8');

// Add import
content = content.replace(
  "import { credentialManager } from './credential_manager';",
  "import { credentialManager } from './credential_manager';\nimport { geminiProjectRouter } from './gemini_project_router';"
);

fs.writeFileSync('server/llm_provider.ts', content);
