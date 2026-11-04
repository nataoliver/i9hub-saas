// backend/src/middlewares/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'i9hub_super_secret_jwt_key_change_in_production_2026';
const JWT_EXPIRES_IN = '24h';

/**
 * Gera um JWT com dados do usuário + tenant
 */
export function signToken(user, tenant) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan
      }
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware: valida JWT e anexa req.user
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token de autenticação ausente.' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ success: false, error: 'Token inválido.' });
  }
}

/**
 * Middleware: exige role superadmin
 */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Acesso restrito a super administradores.' });
  }
  next();
}