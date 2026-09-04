const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

const importStr = "import { geminiProjectRouter } from './server/gemini_project_router';\n";
if (!content.includes('geminiProjectRouter')) {
    content = content.replace("import { createApp }", importStr + "import { createApp }");
}

if (!content.includes('discoverAndValidateAll')) {
    content = content.replace(
        "app.listen(PORT, '0.0.0.0', () => {",
        "// Run initial discovery async without blocking server startup\n  geminiProjectRouter.discoverAndValidateAll().catch(console.error);\n\n  app.listen(PORT, '0.0.0.0', () => {"
    );
    fs.writeFileSync('server.ts', content);
}
