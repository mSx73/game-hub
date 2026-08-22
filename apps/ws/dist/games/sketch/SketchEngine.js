import { CrocodileEngine } from '../crocodile/CrocodileEngine.js';
import { getGameWords } from '../../utils/wordDictionary.js';

export class SketchEngine extends CrocodileEngine {
  constructor(room) {
    super(room);
    this.words = getGameWords('hat', this.settings.difficulty ?? 'medium', 200);
  }
}
