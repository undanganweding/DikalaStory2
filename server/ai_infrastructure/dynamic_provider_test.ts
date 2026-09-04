process.env.FORCE_LOCAL_DB = 'true';

delete process.env.FIREBASE_PROJECT_ID;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;

import request from 'supertest';
import { createApp } from '../app';

async function run(): Promise<void> {
  process.env.AI_SECRET_MASTER_KEY ||= 'dynamic-provider-test-secret-key';
  const app = createApp();

  const gemini = await request(app).post('/api/ai/credentials').send({
    providerName: 'My Gemini',
    name: 'My Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    protocol: 'google-generative-ai',
    apiKey: 'test',
  });
  if (gemini.status !== 201) throw new Error(`My Gemini failed: ${gemini.status} ${JSON.stringify(gemini.body)}`);

  const openRouter = await request(app).post('/api/ai/providers').send({
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'openai-compatible',
  });
  if (openRouter.status !== 201) throw new Error(`OpenRouter provider failed: ${openRouter.status} ${JSON.stringify(openRouter.body)}`);

  const openRouterCredential = await request(app).post('/api/ai/credentials').send({
    providerId: openRouter.body.id,
    name: 'OpenRouter',
    apiKey: 'test',
  });
  if (openRouterCredential.status !== 201) throw new Error(`OpenRouter credential failed: ${openRouterCredential.status} ${JSON.stringify(openRouterCredential.body)}`);

  const providers = await request(app).get('/api/ai/providers');
  if (providers.status !== 200 || !providers.body.some((p: any) => p.name === 'My Gemini') || !providers.body.some((p: any) => p.name === 'OpenRouter')) {
    throw new Error(`Dynamic providers were not persisted: ${JSON.stringify(providers.body)}`);
  }

  console.log('Dynamic provider tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
