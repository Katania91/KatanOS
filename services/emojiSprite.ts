import emojiData from '../assets/emoji-data.json';
import emojiSheetMeta from '../assets/emoji-sheet-meta.json';
import emojiSheet from '../assets/emoji-sheet-32.webp';

type EmojiDataEntry = {
  unified: string;
  sheet_x?: number;
  sheet_y?: number;
  skin_variations?: Array<{
    unified: string;
    sheet_x?: number;
    sheet_y?: number;
  }>;
};

export type EmojiSprite = {
  sheetX: number;
  sheetY: number;
};

const DEFAULT_CELL_SIZE = 32;

const unifiedToEmoji = (unified: string) => {
  const codepoints = unified.split('-').map((code) => parseInt(code, 16));
  return String.fromCodePoint(...codepoints);
};

const spriteIndex = new Map<string, EmojiSprite>();
let maxSheetX = 0;
let maxSheetY = 0;

(emojiData as EmojiDataEntry[]).forEach((entry) => {
  if (typeof entry.sheet_x === 'number' && typeof entry.sheet_y === 'number') {
    const emoji = unifiedToEmoji(entry.unified);
    if (!spriteIndex.has(emoji)) {
      spriteIndex.set(emoji, { sheetX: entry.sheet_x, sheetY: entry.sheet_y });
    }
    if (entry.sheet_x > maxSheetX) maxSheetX = entry.sheet_x;
    if (entry.sheet_y > maxSheetY) maxSheetY = entry.sheet_y;
  }

  if (entry.skin_variations) {
    entry.skin_variations.forEach((variation) => {
      if (typeof variation.sheet_x !== 'number' || typeof variation.sheet_y !== 'number') return;
      const emoji = unifiedToEmoji(variation.unified);
      if (!spriteIndex.has(emoji)) {
        spriteIndex.set(emoji, { sheetX: variation.sheet_x, sheetY: variation.sheet_y });
      }
      if (variation.sheet_x > maxSheetX) maxSheetX = variation.sheet_x;
      if (variation.sheet_y > maxSheetY) maxSheetY = variation.sheet_y;
    });
  }
});

const sheetGrid = Math.max(maxSheetX, maxSheetY) + 1;
const metaWidth = typeof emojiSheetMeta?.width === 'number' ? emojiSheetMeta.width : 0;
const metaHeight = typeof emojiSheetMeta?.height === 'number' ? emojiSheetMeta.height : 0;
const computedCellSize = sheetGrid > 0 && metaWidth > 0 ? metaWidth / sheetGrid : DEFAULT_CELL_SIZE;

export const EMOJI_SHEET_CELL_SIZE = Number.isFinite(computedCellSize)
  ? Math.round(computedCellSize)
  : DEFAULT_CELL_SIZE;
export const EMOJI_SHEET_WIDTH = metaWidth || (maxSheetX + 1) * EMOJI_SHEET_CELL_SIZE;
export const EMOJI_SHEET_HEIGHT = metaHeight || (maxSheetY + 1) * EMOJI_SHEET_CELL_SIZE;

export const getEmojiSprite = (emoji: string) => spriteIndex.get(emoji);
export { emojiSheet };
