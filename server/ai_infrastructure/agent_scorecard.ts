export interface AgentScorecard {
  agentId: string;
  totalRuns: number;
  successfulRuns: number;
  rejectedOutputs: number;
  averageScore: number;
  averageConfidence: number;
  commonFailures: string[];
  lastEvaluation: number;
}

const scorecardStore: Map<string, AgentScorecard> = new Map();

export const agentScorecardManager = {
  async getAgentScorecard(agentId: string): Promise<AgentScorecard> {
    let card = scorecardStore.get(agentId);
    if (!card) {
      card = {
        agentId,
        totalRuns: 0,
        successfulRuns: 0,
        rejectedOutputs: 0,
        averageScore: 100,
        averageConfidence: 1.0,
        commonFailures: [],
        lastEvaluation: Date.now(),
      };
      scorecardStore.set(agentId, card);
    }
    return card;
  },

  async recordEvaluation(
    agentId: string,
    score: number,
    confidence: number,
    status: 'PASS' | 'WARNING' | 'REJECT',
    issues: string[]
  ): Promise<AgentScorecard> {
    const card = await this.getAgentScorecard(agentId);

    card.totalRuns += 1;
    if (status === 'PASS' || status === 'WARNING') {
      card.successfulRuns += 1;
    }
    if (status === 'REJECT') {
      card.rejectedOutputs += 1;
    }

    // Running averages
    card.averageScore = Math.round(((card.averageScore * (card.totalRuns - 1) + score) / card.totalRuns) * 10) / 10;
    card.averageConfidence = Math.round(((card.averageConfidence * (card.totalRuns - 1) + confidence) / card.totalRuns) * 100) / 100;

    for (const issue of issues) {
      if (!card.commonFailures.includes(issue)) {
        card.commonFailures.push(issue);
        if (card.commonFailures.length > 10) {
          card.commonFailures.shift();
        }
      }
    }

    card.lastEvaluation = Date.now();
    scorecardStore.set(agentId, card);
    return card;
  },

  calculateAgentQualityScore(card: AgentScorecard): number {
    return card.averageScore;
  },

  async listAllScorecards(): Promise<AgentScorecard[]> {
    return Array.from(scorecardStore.values());
  },
};
