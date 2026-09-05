/**
 * Concurrency 2 + Async Queue + Rate Limiter for AI Pipeline Operations.
 * Protects production cinematic reasoning models (gemini-2.5-pro, gemini-2.5-flash)
 * from free-tier RPM quota exhaustion (RESOURCE_EXHAUSTED) while allowing safe
 * concurrent pipeline operations across multiple scenes.
 */

export interface QueueTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  addedAt: number;
}

export class RateLimiterQueue {
  private maxConcurrency: number;
  private minIntervalMs: number;
  private activeCount: number = 0;
  private queue: QueueTask<any>[] = [];
  private lastRequestTime: number = 0;
  private isPaused: boolean = false;
  private pauseUntil: number = 0;

  constructor(maxConcurrency: number = 2, minIntervalMs: number = 400) {
    this.maxConcurrency = maxConcurrency;
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Enqueues an async task, respecting maxConcurrency and rate limiting interval
   */
  async enqueue<T>(fn: () => Promise<T>, taskId?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: taskId || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fn,
        resolve,
        reject,
        addedAt: Date.now(),
      });
      this.processNext();
    });
  }

  /**
   * Pauses the queue for a specified backoff duration (e.g. on 429 / quota limit)
   */
  notifyRateLimitEncountered(backoffMs: number = 2500): void {
    const resumeTime = Date.now() + backoffMs;
    if (resumeTime > this.pauseUntil) {
      this.pauseUntil = resumeTime;
      this.isPaused = true;
      console.warn(`[RateLimiterQueue] 429 / RESOURCE_EXHAUSTED encountered. Pausing queue for ${backoffMs}ms to protect RPM quota...`);
      setTimeout(() => {
        if (Date.now() >= this.pauseUntil) {
          this.isPaused = false;
          this.processNext();
        }
      }, backoffMs);
    }
  }

  /**
   * Resets any active backoff pause immediately (e.g. after quota window resets or in testing)
   */
  resetPause(): void {
    this.isPaused = false;
    this.pauseUntil = 0;
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isPaused && Date.now() < this.pauseUntil) {
      return;
    }
    this.isPaused = false;

    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    // Rate limiter spacing check
    const now = Date.now();
    const elapsedSinceLast = now - this.lastRequestTime;
    if (elapsedSinceLast < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsedSinceLast;
      setTimeout(() => this.processNext(), waitTime);
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    this.lastRequestTime = Date.now();

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (err: any) {
      // Reject task and let caller (ai_gateway) handle rate limit classification
      task.reject(err);
    } finally {
      this.activeCount--;
      // Process next task in queue
      this.processNext();
    }
  }

  getStats() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      isPaused: this.isPaused,
    };
  }
}

// Global production rate limiter queue with Concurrency = 2
export const globalAIQueue = new RateLimiterQueue(2, 400);
