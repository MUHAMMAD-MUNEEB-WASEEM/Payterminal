const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { auth, adminOnly, adminOrCompliance } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', auth, async (req, res) => {
  try {
    const brands = await db.brands.find({}, { createdAt: -1 });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const brand = await db.brands.findOne({ _id: req.params.id });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOrCompliance, upload.single('logo'), async (req, res) => {
  try {
    const { name, brandNo, redirectUrl, enableRedirect, verificationCode } = req.body;
    if (!name) return res.status(400).json({ message: 'Brand name is required' });
    if (!req.file) return res.status(400).json({ message: 'Brand logo is required' });

    // Compliance users need verification code
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required for compliance users' });
      }

      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode.trim(),
        userId: req.user._id,
        action: 'create_brand',
        used: false,
      });

      if (!verification) {
        return res.status(400).json({ message: 'Invalid or already used verification code' });
      }

      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Verification code has expired' });
      }

      // Mark verification as used
      await db.verificationCodes.update(
        { _id: verification._id },
        { $set: { used: true, usedAt: new Date().toISOString() } }
      );
    }

    const brand = await db.brands.insert({
      name,
      brandNo: brandNo && brandNo.trim() !== '' ? brandNo.trim() : null,
      logo: `/uploads/logos/${req.file.filename}`,
      redirectUrl: redirectUrl && redirectUrl.trim() !== '' ? redirectUrl.trim() : null,
      enableRedirect: enableRedirect === 'true' || enableRedirect === true,
      createdBy: req.user._id,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(brand);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOrCompliance, upload.single('logo'), async (req, res) => {
  try {
    const { name, brandNo, redirectUrl, enableRedirect, verificationCode } = req.body;
    const brand = await db.brands.findOne({ _id: req.params.id });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    // Compliance users need verification code
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required for compliance users' });
      }

      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode.trim(),
        userId: req.user._id,
        action: 'edit_brand',
        used: false,
      });

      if (!verification) {
        return res.status(400).json({ message: 'Invalid or already used verification code' });
      }

      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Verification code has expired' });
      }

      // Mark verification as used
      await db.verificationCodes.update(
        { _id: verification._id },
        { $set: { used: true, usedAt: new Date().toISOString() } }
      );
    }

    const updates = {
      name: name || brand.name,
      brandNo: brandNo && brandNo.trim() !== '' ? brandNo.trim() : null,
      redirectUrl: redirectUrl && redirectUrl.trim() !== '' ? redirectUrl.trim() : null,
      enableRedirect: enableRedirect === 'true' || enableRedirect === true,
    };

    if (req.file) {
      if (brand.logo) {
        const oldPath = path.join(__dirname, '../..', brand.logo);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updates.logo = `/uploads/logos/${req.file.filename}`;
    }

    await db.brands.update({ _id: req.params.id }, { $set: updates });
    const updated = await db.brands.findOne({ _id: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOrCompliance, async (req, res) => {
  try {
    const { verificationCode } = req.query;
    const brand = await db.brands.findOne({ _id: req.params.id });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    // Compliance users need verification code
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required for compliance users' });
      }

      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode.trim(),
        userId: req.user._id,
        action: 'delete_brand',
        used: false,
      });

      if (!verification) {
        return res.status(400).json({ message: 'Invalid or already used verification code' });
      }

      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Verification code has expired' });
      }

      // Mark verification as used
      await db.verificationCodes.update(
        { _id: verification._id },
        { $set: { used: true, usedAt: new Date().toISOString() } }
      );
    }

    if (brand.logo) {
      const logoPath = path.join(__dirname, '../..', brand.logo);
      if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
    }
    await db.brands.remove({ _id: req.params.id });
    res.json({ message: 'Brand deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
