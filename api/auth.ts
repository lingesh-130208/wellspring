import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

type Account = { id: string; email: string; name: string; role: 'patient' | 'clinician' };
type DemoAccount = Account & { salt: string; passwordHash: string };

const COOKIE = 'wellspring_session';
const SESSION_SECONDS = 60 * 60 * 8;
const secret = () => process.env.AUTH_SESSION_SECRET || '';

function accounts(): DemoAccount[] {
  const raw = process.env.WELLSPRING_DEMO_ACCOUNTS || '';
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows.filter((r: any) =>
      r && typeof r.email === 'string' && typeof r.name === 'string' &&
      ['patient', 'clinician'].includes(r.role) && typeof r.salt === 'string' &&
      typeof r.passwordHash === 'string'
    ) as DemoAccount[];
  } catch { return []; }
}

function signature(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function parseCookies(header: string | undefined) {
  return Object.fromEntries((header || '').split(';').map(part => {
    const i = part.indexOf('=');
    return i < 0 ? ['', ''] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([k]) => !!k));
}
function publicAccount(account: DemoAccount): Account {
  return { id: account.id, email: account.email, name: account.name, role: account.role };
}
function verifyPassword(password: string, account: DemoAccount) {
  const actual = scryptSync(password, account.salt, 64).toString('hex');
  return safeEqual(actual, account.passwordHash);
}
function issueSession(account: DemoAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: account.id, role: account.role, iat: now, exp: now + SESSION_SECONDS, nonce: randomBytes(8).toString('hex') })).toString('base64url');
  return payload + '.' + signature(payload);
}
export function getSession(req: any): Account | null {
  if (!secret()) return null;
  const token = parseCookies(req.headers?.cookie)[COOKIE];
  if (!token) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra || !safeEqual(sig, signature(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.exp !== 'number' || session.exp <= Date.now() / 1000) return null;
    const account = accounts().find(a => a.id === session.sub && a.role === session.role);
    return account ? publicAccount(account) : null;
  } catch { return null; }
}
export function requireRole(req: any, res: any, roles: Account['role'][]): Account | null {
  const user = getSession(req);
  if (!user) { res.status(401).json({ error: 'Sign in is required.' }); return null; }
  if (!roles.includes(user.role)) { res.status(403).json({ error: 'Your account does not have access to this feature.' }); return null; }
  return user;
}

export function requireAccountRole(req: any, res: any, roles: Account['role'][]): Account | null {
  const user = requireRole(req, res, roles);
  if (!user) return null;
  if (user.role === 'clinician' && process.env.CLINIC_ADMIN_TOKEN) {
    const token = req.headers?.['x-clinic-token'];
    if (typeof token !== 'string' || !safeEqual(token, process.env.CLINIC_ADMIN_TOKEN)) {
      res.status(401).json({ error: 'Clinic authorization is missing or invalid.' });
      return null;
    }
  }
  return user;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && new URL(req.url || '/api/auth', 'http://localhost').searchParams.get('action') === 'me') {
    const user = getSession(req);
    return res.status(200).json({ authenticated: !!user, user });
  }
  if (req.method === 'POST' && new URL(req.url || '/api/auth', 'http://localhost').searchParams.get('action') === 'logout') {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax; Max-Age=0`);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST' || new URL(req.url || '/api/auth', 'http://localhost').searchParams.get('action') !== 'login')
    return res.status(405).json({ error: 'Unsupported method or action.' });
  if (!secret() || secret().length < 32) return res.status(503).json({ error: 'Authentication is not configured. Set AUTH_SESSION_SECRET to a strong random secret.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password || email.length > 254 || password.length > 1024)
    return res.status(400).json({ error: 'Enter your email and password.' });
  const account = accounts().find(a => a.email.toLowerCase() === email);
  if (!account || !verifyPassword(password, account))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.setHeader('Set-Cookie', `${COOKIE}=${issueSession(account)}; Path=/; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
  return res.status(200).json({ user: publicAccount(account) });
}