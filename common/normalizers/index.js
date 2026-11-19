const Boom = require("@hapi/boom");

// Constants
const { CURRENCY } = require("../constants");

exports.normalizeShortcut = (value) => {
  const cleaned = cleanText(value, { maxLength: 40 }) || "";
  const withoutSlash = cleaned.replace(/^\/+/, "").trim().toLowerCase();

  if (!withoutSlash) {
    throw Boom.badRequest("A shortcut trigger is required");
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(withoutSlash)) {
    throw Boom.badRequest("Shortcuts may only contain letters, numbers, dots, dashes and underscores");
  }

  return withoutSlash.slice(0, 40);
};

exports.normalizeToArray = (value) => {
  if (value == null) return [];

  return Array.isArray(value) ? value : [value];
};

exports.normalizeToCurrencies = (amount = 0, currency) => {
  const DOLLAR_RATE = 270;

  const ratesToUSD = {
    [CURRENCY.PKR]: 1 / DOLLAR_RATE,
    [CURRENCY.USD]: 1,
  };

  if (!currency || !ratesToUSD[currency]) {
    return Object.fromEntries(Object.values(CURRENCY).map((cur) => [cur, 0]));
  }

  return Object.fromEntries(
    Object.values(CURRENCY).map((targetCurrency) => {
      const targetRate = ratesToUSD[targetCurrency];
      const sourceRate = ratesToUSD[currency];

      if (!targetRate || !sourceRate) return [targetCurrency, 0];

      if (targetCurrency === currency) return [targetCurrency, amount];

      const converted = amount * (sourceRate / targetRate);

      return [targetCurrency, converted];
    }),
  );
};
