const jwt = require('jsonwebtoken');
const db = require('../db');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle superadmin (not in database)
    if (decoded.id === 'superadmin' && decoded.role === 'superadmin') {
      req.user = {
        _id: 'superadmin',
        username: 'superadmin',
        role: 'superadmin',
        email: 'superadmin@system.local'
      };
      return next();
    }
    
    // Regular user lookup
    const user = await db.users.findOne({ _id: decoded.id });
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.role !== 'admin' && user.role !== 'compliance' && user.status !== 'approved') {
      return res.status(403).json({ message: 'Account not approved' });
    }

    const { password: _, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const adminOrCompliance = (req, res, next) => {
  if (!['admin', 'compliance', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Admin or Compliance access required' });
  }
  next();
};

const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly, adminOrCompliance, superAdminOnly };
