const fs = require('fs');

let content = fs.readFileSync('server/routes.ts', 'utf-8');

const importStr = "import { geminiProjectRouter } from './gemini_project_router';\n";
if (!content.includes('geminiProjectRouter')) {
    content = content.replace("import { modelRouter }", importStr + "import { modelRouter }");
}

const apiStr = `
// Gemini Project Router Dashboard
apiRouter.get('/router/gemini-projects', (req: Request, res: Response) => {
  try {
    const projects = geminiProjectRouter.listProjects();
    const logs = geminiProjectRouter.getLogs();
    res.json({ projects, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (!content.includes('/router/gemini-projects')) {
    content = content.replace(
        "apiRouter.get('/router/logs', (req: Request, res: Response) => {",
        apiStr + "\napiRouter.get('/router/logs', (req: Request, res: Response) => {"
    );
    fs.writeFileSync('server/routes.ts', content);
}
