const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  
  // Allow both default passwords to avoid confusion
  if (password === 'xlr8_dev' || password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'striker_jwt_secret_2024', { expiresIn: '24h' });
    return res.json({ token });
  }
  
  return res.status(401).json({ error: 'Invalid password' });
});

module.exports = router;
