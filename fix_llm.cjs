const fs = require('fs');

let content = fs.readFileSync('server/llm_provider.ts', 'utf-8');

const targetStr = `        let activeProject;
        try {
           activeProject = geminiProjectRouter.getBestProject(taskStr, modelId);
        } catch(e) {
           throw e; // No project available
        }`;

const replaceStr = `        let activeProject;
        
        if (currentApiKey && activeCandidate.label === 'Explicit Request Key') {
          activeProject = { project_id: 'explicit-request', api_key: currentApiKey };
        } else {
          try {
             activeProject = geminiProjectRouter.getBestProject(taskStr, modelId);
          } catch(e) {
             throw e; // No project available
          }
        }`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('server/llm_provider.ts', content);
