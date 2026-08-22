export interface PremiumFeatures {
  customAvatars: boolean;
  animatedAvatars: boolean;
  exclusiveSkins: string[];
  advancedStats: boolean;
  replayAccess: boolean;
  unlimitedHistory: boolean;
  privateRooms: boolean;
  largerRooms: boolean;
  customTimers: boolean;
  aiGameMaster: boolean;
  aiAssistant: boolean;
  noAds: boolean;
  prioritySupport: boolean;
  betaAccess: boolean;
}
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'ultimate';
export declare const TIER_FEATURES: Record<SubscriptionTier, PremiumFeatures>;
//# sourceMappingURL=premium.d.ts.map
