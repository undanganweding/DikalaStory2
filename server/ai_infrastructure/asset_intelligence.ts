export interface AssetRecord {
  assetId: string;
  projectId: string;
  name: string;
  type: 'CHARACTER' | 'LOCATION' | 'PROP' | 'STORYBOARD' | 'MASTER_FRAME';
  referenceUrl?: string;
  status: 'READY' | 'PENDING' | 'MISSING';
  metadata: Record<string, any>;
}

const assetStore: Map<string, AssetRecord[]> = new Map();

export const assetIntelligence = {
  async registerAsset(asset: AssetRecord): Promise<AssetRecord> {
    const list = assetStore.get(asset.projectId) || [];
    const idx = list.findIndex(a => a.assetId === asset.assetId);
    if (idx >= 0) {
      list[idx] = asset;
    } else {
      list.push(asset);
    }
    assetStore.set(asset.projectId, list);
    return asset;
  },

  async getProjectAssets(projectId: string): Promise<AssetRecord[]> {
    return assetStore.get(projectId) || [];
  },

  async verifyAssetAvailability(projectId: string, requiredAssetIds: string[]): Promise<{ missing: string[]; available: string[] }> {
    const assets = await this.getProjectAssets(projectId);
    const availableIds = assets.filter(a => a.status === 'READY').map(a => a.assetId);
    const missing = requiredAssetIds.filter(id => !availableIds.includes(id));
    return {
      missing,
      available: requiredAssetIds.filter(id => availableIds.includes(id)),
    };
  },
};
