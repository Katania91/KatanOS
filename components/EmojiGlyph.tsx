import React from 'react';
import { emojiSheet, EMOJI_SHEET_CELL_SIZE, EMOJI_SHEET_HEIGHT, EMOJI_SHEET_WIDTH, getEmojiSprite } from '../services/emojiSprite';

interface EmojiGlyphProps {
  emoji: string;
  size?: number;
  className?: string;
  title?: string;
}

const EmojiGlyph: React.FC<EmojiGlyphProps> = ({ emoji, size = 20, className = '', title }) => {
  const sprite = getEmojiSprite(emoji);
  if (!sprite) {
    return (
      <span className={`emoji-font ${className}`} style={{ fontSize: size }} title={title}>
        {emoji}
      </span>
    );
  }

  const scale = size / EMOJI_SHEET_CELL_SIZE;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-block',
    backgroundImage: `url(${emojiSheet})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${EMOJI_SHEET_WIDTH * scale}px ${EMOJI_SHEET_HEIGHT * scale}px`,
    backgroundPosition: `${-sprite.sheetX * EMOJI_SHEET_CELL_SIZE * scale}px ${-sprite.sheetY * EMOJI_SHEET_CELL_SIZE * scale}px`,
  };

  return <span className={className} style={style} title={title} />;
};

export default EmojiGlyph;
