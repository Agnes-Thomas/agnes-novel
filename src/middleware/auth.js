import jwt from 'jsonwebtoken';
const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-in-production';

export const requireAuth = (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, SECRET());
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
};

export { SECRET };
