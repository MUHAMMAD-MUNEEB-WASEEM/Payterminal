const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// Get all notifications (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const notifications = await db.notifications.find({}, { createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unread count (admin only)
router.get('/unread-count', auth, adminOnly, async (req, res) => {
  try {
    const count = await db.notifications.count({ read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark notification as read (admin only)
router.patch('/:id/read', auth, adminOnly, async (req, res) => {
  try {
    await db.notifications.update({ _id: req.params.id }, { $set: { read: true } });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark all as read (admin only)
router.post('/mark-all-read', auth, adminOnly, async (req, res) => {
  try {
    await db.notifications.update({}, { $set: { read: true } }, { multi: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete notification (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.notifications.remove({ _id: req.params.id });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
