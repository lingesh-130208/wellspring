import { getSession, requireRole } from './auth';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const user = requireRole(req, res, ['patient', 'clinician']);
  if (!user) return;
  return res.status(200).json({ user });
}
