const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const SUPER_ADMIN = require('../config/superAdmin');
const { loginRateLimit } = require('../middleware/rateLimit');
const { invalidate: invalidateMaintenance } = require('../middleware/maintenance');

// The super admin lives outside the database. Its password now comes from
// SUPER_ADMIN_PASSWORD — see src/config/superAdmin.js for why, and for the
// fallback that stops this change locking anyone out.

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check for super admin first (hidden, not in database)
    if (SUPER_ADMIN.matches(username, password)) {
      const token = jwt.sign(
        { 
          id: 'superadmin',
          _id: 'superadmin',
          username: SUPER_ADMIN.username,
          role: SUPER_ADMIN.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        user: {
          _id: 'superadmin',
          username: SUPER_ADMIN.username,
          role: SUPER_ADMIN.role,
          email: 'superadmin@system.local'
        }
      });
    }
    
    // Regular user authentication
    const user = await db.users.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    if (user.role !== 'admin' && user.status !== 'approved') {
      return res.status(403).json({ message: `Account is ${user.status}. Please wait for admin approval.` });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const exists = await db.users.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ message: 'Username or email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await db.users.insert({
      username, email, password: hashed,
      role: 'user', status: 'pending',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ message: 'Account created. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin-only endpoint to create compliance users (auto-approved)
router.post('/register', auth, adminOnly, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Validate role
    if (!['user', 'compliance'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const exists = await db.users.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ message: 'Username or email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await db.users.insert({
      username, 
      email, 
      password: hashed,
      role: role || 'user',
      status: 'approved', // Auto-approve admin-created users
      createdAt: new Date().toISOString(),
    });

    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ message: 'User created successfully', user: safeUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, (req, res) => res.json(req.user));

// Maintenance mode endpoints (super admin only)
router.get('/maintenance-status', async (req, res) => {
  try {
    let settings = await db.systemSettings.findOne({ _id: 'system_maintenance' });
    if (!settings) {
      settings = { _id: 'system_maintenance', maintenanceMode: false };
      await db.systemSettings.insert(settings);
    }
    res.json({ maintenanceMode: settings.maintenanceMode || false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/maintenance-mode', auth, async (req, res) => {
  try {
    // Only super admin can toggle maintenance mode
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { enabled } = req.body;
    
    let settings = await db.systemSettings.findOne({ _id: 'system_maintenance' });
    if (settings) {
      await db.systemSettings.update(
        { _id: 'system_maintenance' },
        { $set: { maintenanceMode: enabled } }
      );
    } else {
      await db.systemSettings.insert({
        _id: 'system_maintenance',
        maintenanceMode: enabled
      });
    }

    // Drop the cached value so the change takes effect on the very next
    // request rather than up to five seconds later.
    invalidateMaintenance();

    console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} by superadmin`);
    res.json({ success: true, maintenanceMode: enabled });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
