const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    // Return all non-admin users (regular users and compliance users)
    const users = await db.users.find({ role: { $ne: 'admin' } }, { createdAt: -1 });
    res.json(users.map(({ password, ...u }) => u));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    await db.users.update({ _id: req.params.id }, { $set: { status } });
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/role', auth, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'compliance'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await db.users.findOne({ _id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot change admin role' });
    }
    await db.users.update({ _id: req.params.id }, { $set: { role } });
    const updatedUser = await db.users.findOne({ _id: req.params.id });
    const { password, ...safeUser } = updatedUser;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.users.remove({ _id: req.params.id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
