import { AsyncLocalStorage } from 'async_hooks';

export interface BudgetState {
  callsUsed: number;
  limit: number;
  activeRun: boolean;
}

export class AIBudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIBudgetExhaustedError';
  }
}

class AIBudgetRegistry {
  private budgets = new Map<string, BudgetState>();
  private asyncLocalStorage = new AsyncLocalStorage<string>();

  getStore() {
    return this.asyncLocalStorage;
  }

  initializeBudget(projectId: string, limit: number = 15): void {
    this.budgets.set(projectId, {
      callsUsed: 0,
      limit,
      activeRun: true,
    });
    console.log(`[BUDGET MONITOR] Initialized budget for project ${projectId} with limit ${limit}`);
  }

  getBudget(projectId: string): BudgetState | undefined {
    return this.budgets.get(projectId);
  }

  getCurrentProjectId(): string | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Safe and atomic check and increment.
   * If callsUsed is already >= limit, throws AIBudgetExhaustedError.
   */
  checkAndIncrement(projectId: string, stage: string, model: string, credential: string): { callNumber: number; limit: number; remaining: number } {
    const budget = this.budgets.get(projectId);
    if (!budget) {
      // If no budget is active for this project (e.g. running outside of S1-S5 initialization),
      // we do not enforce any limits and return a dummy status.
      return { callNumber: 0, limit: 0, remaining: 0 };
    }

    if (budget.callsUsed >= budget.limit) {
      console.warn(`[BUDGET EXHAUSTED]\nprojectId=${projectId}\nstage=${stage}\ncalls_used=${budget.callsUsed}\nlimit=${budget.limit}`);
      throw new AIBudgetExhaustedError(`AI Provider Call Budget Exhausted (${budget.limit} requests maximum for this initialization run).`);
    }

    budget.callsUsed += 1;
    const callNumber = budget.callsUsed;
    const remaining = budget.limit - callNumber;

    console.log(
      `[BUDGET MONITOR]\nprojectId=${projectId}\nstage=${stage}\nattempt_model=${model}\ncredential=${credential}\ncall_number=${callNumber}\nlimit=${budget.limit}\nremaining=${remaining}`
    );

    return { callNumber, limit: budget.limit, remaining };
  }

  cleanupBudget(projectId: string): void {
    this.budgets.delete(projectId);
    console.log(`[BUDGET MONITOR] Cleaned up budget for project ${projectId}`);
  }

  async runWithProjectId<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    return this.asyncLocalStorage.run(projectId, fn);
  }
}

export const aiBudgetRegistry = new AIBudgetRegistry();
