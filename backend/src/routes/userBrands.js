const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

// Get brands assigned to a user (admin only)
router.get('/user/:userId', auth, adminOnly, async (req, res) => {
  try {
    const userBrands = await db.userBrands.find({ userId: req.params.userId });
    const brandIds = userBrands.map(ub => ub.brandId);
    
    const brands = [];
    for (const id of brandIds) {
      const brand = await db.brands.findOne({ _id: id });
      if (brand) brands.push(brand);
    }
    
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get brands for current user (regular users)
router.get('/my-brands', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // Admins see all brands
      const brands = await db.brands.find({});
      return res.json(brands);
    }
    
    // Regular users see only assigned brands
    const userBrands = await db.userBrands.find({ userId: req.user._id });
    const brandIds = userBrands.map(ub => ub.brandId);
    
    const brands = [];
    for (const id of brandIds) {
      const brand = await db.brands.findOne({ _id: id });
      if (brand) brands.push(brand);
    }
    
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign brand to user (admin only)
router.post('/user/:userId/assign', auth, adminOnly, async (req, res) => {
  try {
    const { brandId } = req.body;
    
    if (!brandId) {
      return res.status(400).json({ message: 'Brand ID is required' });
    }
    
    // Check if already assigned
    const existing = await db.userBrands.findOne({ 
      userId: req.params.userId, 
      brandId 
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Brand already assigned to this user' });
    }
    
    const assignment = await db.userBrands.insert({
      userId: req.params.userId,
      brandId,
      createdAt: new Date().toISOString(),
    });
    
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove brand from user (admin only)
router.delete('/user/:userId/brand/:brandId', auth, adminOnly, async (req, res) => {
  try {
    await db.userBrands.remove({ 
      userId: req.params.userId, 
      brandId: req.params.brandId 
    });
    res.json({ message: 'Brand removed from user' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
