const nodemailer = require("nodemailer");

// Environment Variables
const env = require("./env");

const transporter = (smtp) => {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // true for 465, false for other ports
    auth: smtp.user
      ? {
          user: smtp.user,
          pass: smtp.pass,
        }
      : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    ...(env.NODE_ENV === "development" && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  });
};

module.exports = transporter;
