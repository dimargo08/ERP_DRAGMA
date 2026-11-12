const jwt = require('jsonwebtoken');
const { JWT_SECRET: SECRET } = require('../config/env');

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'No autenticado' });
    }
    try {
      req.user = jwt.verify(token, SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
  };
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ error: 'No tienes permisos para esta acción' });

module.exports = { auth, requireRole, SECRET };
