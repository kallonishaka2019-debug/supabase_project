const CUSTOM_PRICE_PER_LETTER = 7;
const CUSTOM_PRICE_PER_DIGIT = 15;
const CUSTOM_NAME_PATTERN = /^[A-Za-z .'-]{1,12}$/;
const CUSTOM_NUMBER_PATTERN = /^\d{1,2}$/;
const CUSTOM_MODES = ["name", "number", "both"];
const CUSTOM_FONTS = ["classic", "modern", "serif", "script"];
const CUSTOM_COLORS = ["gold", "white", "black", "red", "blue", "green"];
const DEFAULT_CUSTOM_FONT = "classic";
const DEFAULT_CUSTOM_COLOR = "gold";

function customizationFee(name, number) {
  const letters = (String(name ?? "").match(/[A-Za-z]/g) || []).length;
  const digits = (String(number ?? "").match(/\d/g) || []).length;
  return letters * CUSTOM_PRICE_PER_LETTER + digits * CUSTOM_PRICE_PER_DIGIT;
}

module.exports = {
  CUSTOM_PRICE_PER_LETTER,
  CUSTOM_PRICE_PER_DIGIT,
  CUSTOM_NAME_PATTERN,
  CUSTOM_NUMBER_PATTERN,
  CUSTOM_MODES,
  CUSTOM_FONTS,
  CUSTOM_COLORS,
  DEFAULT_CUSTOM_FONT,
  DEFAULT_CUSTOM_COLOR,
  customizationFee,
};
