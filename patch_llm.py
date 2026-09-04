import re

with open('server/llm_provider.ts', 'r') as f:
    content = f.read()

# Define the start and end of the block
start_str = "    if (providerType === 'google') {"
end_str = "    } else {"

start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx)

if start_idx != -1 and end_idx != -1:
    new_google_block = """    if (providerType === 'google') {
      const stageTag = `[${options.stage || 'S1'}]`;
      const GOOGLE_CONTENT_TIMEOUT_MS = 35000;
      let lastAttemptError: any = null;
      const taskProfile = DEFAULT_TASK_PROFILES[options.stage || 'S1'] || { task: 'general', tier: 'general_reasoning' };
      const taskStr = taskProfile.task as GTaskType;
      
      // Get best model first
      const { modelId, provider } = await modelRouter.getBestModel(taskProfile.task as import('./model_router').TaskType, 'MEDIUM', 1);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let activeProject;
        try {
           activeProject = geminiProjectRouter.getBestProject(taskStr, modelId);
        } catch(e) {
           throw e; // No project available
        }
        
        const ai = getGeminiAI(activeProject.api_key);
        const attemptStart = Date.now();
        
        try {
          const requestStart = Date.now();
          console.log(`${stageTag} AI REQUEST model=${modelId} project="${activeProject.project_id}" attempt=${attempt} stage=${options.stage || 'S1'}`);
          if (options.onProgress) {
            options.onProgress(`${options.entityId ? `${options.entityId}: ` : ''}Menghubungi AI Model ${modelId} (Project ${activeProject.project_id.split('-').pop()})...`);
          }

          let response;
          // Request Queue & Gemini Project Router
          response = await geminiProjectRouter.queueRequest(() => withTimeout(
            ai.models.generateContent({
              model: modelId,
              contents: options.prompt,
              config: {
                systemInstruction: options.systemInstruction,
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxOutputTokens,
                responseMimeType: options.responseSchema ? 'application/json' : undefined,
                responseSchema: options.responseSchema,
              },
            }),
            GOOGLE_CONTENT_TIMEOUT_MS,
            `Google Gemini request timed out after ${GOOGLE_CONTENT_TIMEOUT_MS}ms (model ${modelId})`
          ));
          
          const requestElapsed = Date.now() - requestStart;
          console.log(`${stageTag} AI RESPONSE model=${modelId} project="${activeProject.project_id}" attempt=${attempt} elapsedMs=${requestElapsed} stage=${options.stage || 'S1'}`);
          
          if (!response.text) {
            throw new Error('Google Gemini returned an empty response.');
          }

          // Log success usage
          const estimatedTokens = Math.floor(response.text.length / 4); // rough estimate
          geminiProjectRouter.recordUsageAndLog(activeProject.project_id, taskStr, modelId, estimatedTokens, requestElapsed, 'success');

          if (options.onProgress) {
            options.onProgress(`${options.entityId ? `${options.entityId}: ` : ''}Respons AI (${modelId}) berhasil diterima dalam ${requestElapsed}ms!`);
          }

          // Return result immediately (bypassing loop)
          return { text: cleanJsonResponse(response.text) };
        } catch (err: any) {
          lastAttemptError = err;
          lastCredentialError = err;
          const attemptElapsed = Date.now() - attemptStart;
          console.warn(`${stageTag} AI ERROR model=${modelId} project="${activeProject.project_id}" attempt=${attempt} elapsedMs=${attemptElapsed} error="${err?.message || err}" stage=${options.stage || 'S1'}`);

          const isQuota = isRateLimitOrQuotaError(err);
          const isAuth = classifyError(err) === 'auth_error';

          geminiProjectRouter.recordUsageAndLog(activeProject.project_id, taskStr, modelId, 0, attemptElapsed, 'fail', err);

          if (isFatalNonRecoverableError(err) && !isQuota) {
            if (isAuth && attempt < MAX_ATTEMPTS) {
              console.warn(`[GeminiRouter] Project "${activeProject.project_id}" auth failed. Switch project...`);
              continue;
            }
            throw err;
          }

          if (isQuota && attempt < MAX_ATTEMPTS) {
            console.warn(`[GeminiRouter] Project "${activeProject.project_id}" hit quota/rate limit. Failover...`);
            continue;
          }

          const isRetryable = isRetryableError(err);
          if (isRetryable && attempt < MAX_ATTEMPTS) {
            const delayMs = attempt * 2000;
            console.warn(`${stageTag} Transient error. Retrying in ${delayMs}ms...`);
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          if (attempt === MAX_ATTEMPTS) {
            throw err;
          }
        }
      }
      throw lastAttemptError || new Error('Max attempts reached for Google provider');
"""
    new_content = content[:start_idx] + new_google_block + content[end_idx:]
    with open('server/llm_provider.ts', 'w') as f:
        f.write(new_content)
    print("Patched successfully")
else:
    print("Could not find blocks")
