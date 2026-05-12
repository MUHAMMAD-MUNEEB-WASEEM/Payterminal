const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
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

router.get('/me', auth, (req, res) => res.json(req.user));

module.exports = router;
