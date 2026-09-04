const fs = require('fs');
let content = fs.readFileSync('src/components/workspaces/SettingsWorkspace.tsx', 'utf-8');

const stateStr = `  const [routerCatalog, setRouterCatalog] = useState<any[]>([]);
  const [routerLogs, setRouterLogs] = useState<any[]>([]);
  const [geminiProjects, setGeminiProjects] = useState<any[]>([]);
  const [geminiRouterLogs, setGeminiRouterLogs] = useState<any[]>([]);`;

content = content.replace(
  /const \[routerCatalog, setRouterCatalog\] = useState<any\[\]>\(\[\]\);\s*const \[routerLogs, setRouterLogs\] = useState<any\[\]>\(\[\]\);/,
  stateStr
);

const fetchStr = `      const [catalogRes, logsRes, geminiRes] = await Promise.all([
        fetch('/api/router/catalog'),
        fetch('/api/router/logs'),
        fetch('/api/router/gemini-projects').catch(() => ({ json: () => ({ projects: [], logs: [] }) } as any))
      ]);
      const catalogData = await catalogRes.json();
      const logsData = await logsRes.json();
      const geminiData = await geminiRes.json();
      setRouterCatalog(catalogData.models || []);
      setRouterLogs(logsData.logs || []);
      setGeminiProjects(geminiData.projects || []);
      setGeminiRouterLogs(geminiData.logs || []);`;

content = content.replace(
  /const \[catalogRes, logsRes\] = await Promise\.all\(\[\s*fetch\('\/api\/router\/catalog'\),\s*fetch\('\/api\/router\/logs'\)\s*\]\);\s*const catalogData = await catalogRes\.json\(\);\s*const logsData = await logsRes\.json\(\);\s*setRouterCatalog\(catalogData\.models \|\| \[\]\);\s*setRouterLogs\(logsData\.logs \|\| \[\]\);/,
  fetchStr
);

const dashboardUI = `
        {/* Gemini Project Credential Router Dashboard */}
        <div className="mt-8 border-t border-white/10 pt-8">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-emerald-400" />
            Gemini Project Credential Router
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {geminiProjects.map((p: any) => (
              <div key={p.project_id} className={\`p-4 rounded-xl border \${p.health.status === 'healthy' ? 'bg-zinc-800/50 border-white/5' : p.health.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}\`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-zinc-100 font-mono">{p.project_id}</span>
                  <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase \${p.health.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' : p.health.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}\`}>
                    {p.health.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex justify-between">
                    <span>RPM Usage:</span>
                    <span className={p.quota.rpm > 0 && p.usage.rpm_used / p.quota.rpm > 0.8 ? 'text-yellow-400' : ''}>
                      {p.usage.rpm_used} / {p.quota.rpm || '∞'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Requests Today:</span>
                    <span className={p.quota.rpd > 0 && p.usage.requests_today / p.quota.rpd > 0.8 ? 'text-yellow-400' : ''}>
                      {p.usage.requests_today} / {p.quota.rpd || '∞'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tokens Used:</span>
                    <span>{p.usage.tokens_used.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Error Rate / Latency:</span>
                    <span>{p.health.error_rate}% / {Math.round(p.health.latency)}ms</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 mt-2">
                     <span className="text-[10px]">Models: {p.models_available.join(', ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-zinc-400 font-mono max-h-40 overflow-y-auto p-2 bg-black/40 rounded border border-white/5">
            Gemini Router Decision Log:
            {(geminiRouterLogs || []).slice(-10).map((log: any, i: number) => (
              <div key={i} className={\`text-[10px] \${log.status === 'success' ? 'text-zinc-500' : 'text-red-400'}\`}>
                [{new Date(log.time).toLocaleTimeString()}] {log.task} | {log.project_used} | {log.model} | {log.latency}ms | {log.status.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
`;

content = content.replace(
  /\{ \/\* Linter & System \*\/ \}/,
  dashboardUI + '\n        { /* Linter & System */ }'
);

fs.writeFileSync('src/components/workspaces/SettingsWorkspace.tsx', content);
