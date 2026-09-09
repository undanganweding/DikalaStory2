import { isDailyQuotaExhaustedError } from './ai_gateway';

const wrappedDailyQuota = new Error(
  'OpenAI-compatible provider error (503): Upstream Provider Service Failure [429] Quota exceeded GenerateRequestsPerDay RESOURCE_EXHAUSTED'
);
const genuineTransient = new Error('OpenAI-compatible provider error (503): temporary upstream unavailable');

if (!isDailyQuotaExhaustedError(wrappedDailyQuota)) {
  throw new Error('Expected wrapped daily quota 503 to classify as daily quota');
}
if (isDailyQuotaExhaustedError(genuineTransient)) {
  throw new Error('Expected genuine transient 503 to remain retryable');
}
console.log('QUOTA_CLASSIFICATION_REGRESSION_OK');
