const crypto = require("crypto");

const DEFAULT_BYTES = 16;
const DEFAULT_ENCODING = "base64url";
const DEFAULT_PREFIX = "";

exports.generateRandomToken = ({ prefix = DEFAULT_PREFIX, bytes = DEFAULT_BYTES, encoding = DEFAULT_ENCODING } = {}) => {
  const token = crypto.randomBytes(bytes).toString(encoding);

  return prefix ? `${prefix}_${token}` : token;
};
