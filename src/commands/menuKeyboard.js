const { locale } = require('../utils/env');
const languages = require('../utils/language');

const LUCKY_DRAW_BUTTON = '🎲 قرعه‌کشی روزانه';

/**
 * The persistent bottom menu. The dice row is only included while the daily draw is open,
 * so a closed draw stops being offered to anyone who opens /start after it was closed.
 */
function mainMenuKeyboard({ luckyEnabled }) {
  const { suppotButtonKeyboard, promotionButtonKeyboard, FAQButtonKeyboard, helpMeButtonKeyboard } = languages[locale];

  const keyboard = [
    [
      { text: suppotButtonKeyboard, style: 'primary' },
      { text: promotionButtonKeyboard, style: 'success' },
    ],
    [
      { text: FAQButtonKeyboard, style: 'primary' },
      { text: helpMeButtonKeyboard, style: 'danger' },
    ],
  ];

  if (luckyEnabled) {
    keyboard.push([{ text: LUCKY_DRAW_BUTTON, style: 'success' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    persistent: true,
    one_time_keyboard: false,
  };
}

module.exports = { LUCKY_DRAW_BUTTON, mainMenuKeyboard };
