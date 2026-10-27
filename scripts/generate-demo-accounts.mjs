import { randomBytes, scryptSync } from 'node:crypto';

const accounts = [
  { id: 'clinician-demo-01', email: 'clinician@example.test', name: 'Demo Clinician', role: 'clinician' },
  { id: 'patient-demo-01', email: 'patient@example.test', name: 'Demo Patient', role: 'patient' }
];
const configured = accounts.map(account => {
  const password = process.env[account.role === 'clinician' ? 'WELLSPRING_CLINICIAN_DEMO_PASSWORD' : 'WELLSPRING_PATIENT_DEMO_PASSWORD'];
  if (!password || password.length < 12) throw new Error('Set both demo passwords to at least 12 characters in your local environment before generating account records.');
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  return { ...account, salt, passwordHash };
});
process.stdout.write(JSON.stringify(configured, null, 2) + '\n');
