const required = ['AUTH_SESSION_SECRET', 'WELLSPRING_DEMO_ACCOUNTS'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required authentication environment variables:', missing.join(', '));
  process.exit(1);
}
if (process.env.AUTH_SESSION_SECRET.length < 32) {
  console.error('AUTH_SESSION_SECRET must be at least 32 characters.');
  process.exit(1);
}
try {
  const accounts = JSON.parse(process.env.WELLSPRING_DEMO_ACCOUNTS);
  if (!Array.isArray(accounts) || accounts.length === 0) throw new Error();
  const roles = new Set(accounts.map(a => a.role));
  if (!roles.has('patient') || !roles.has('clinician')) throw new Error();
  for (const account of accounts) {
    if (!account.id || !account.email || !account.name || !account.salt || !account.passwordHash || !['patient','clinician'].includes(account.role))
      throw new Error();
  }
} catch {
  console.error('WELLSPRING_DEMO_ACCOUNTS must be a JSON array with id, email, name, role, salt, and passwordHash for each account, including patient and clinician roles.');
  process.exit(1);
}
console.log('Authentication configuration shape is valid. This does not test the deployed login or database.');
