const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SID'
];

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key] || !String(process.env[key]).trim());

  if (missing.length > 0) {
    const message = `[env] Missing required environment variables: ${missing.join(', ')}`;
    throw new Error(message);
  }
}

module.exports = {
  validateEnv,
  requiredEnvVars
};
