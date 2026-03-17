/* eslint-env node */
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

// in-memory user store for demo
const users = [
  {
    id: 1,
    email: 'admin@example.com',
    passwordHash: bcrypt.hashSync('password123', 8),
  },
];

// secret for JWT (in a real app use env var)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '1h',
  });
  res.json({ token });
});

export default router;
