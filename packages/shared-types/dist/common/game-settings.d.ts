import type { MafiaSettings } from '../games/mafia';
export type GameSettings = MafiaSettings | CrocodileSettings | HatSettings | AssociationsSettings;
export interface CrocodileSettings {
  roundTime?: number;
  /** Глаголы и фразы-действия | существительные | смешанный набор */
  crocodileWordBank?: 'verbs' | 'nouns' | 'mixed';
}
export interface HatSettings {
  wordsPerPlayer?: number;
  roundTime?: number;
}
export interface AssociationsSettings {
  chainLength?: number;
}
//# sourceMappingURL=game-settings.d.ts.map
