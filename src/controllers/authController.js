const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userService = require('../services/userService');
const { AppError } = require('../utils/errors');

const VALID_ROLES = ['admin', 'manager', 'employee'];


const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'employee' } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return next(new AppError(`Role must be one of: ${VALID_ROLES.join(', ')}`, 400));
    }

    const existing = await userService.findByEmail(email);
    if (existing) return next(new AppError('Email already in use', 409));

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userService.createUser({ name, email, passwordHash, role });

    res.status(201).json({
      success: true,
      message: 'Account created',
      user,
    });
  } catch (err) {
    next(err);
  }
};


const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userService.findByEmail(email);
    if (!user) return next(new AppError('Invalid credentials', 401));

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return next(new AppError('Invalid credentials', 401));

    const accessToken = signAccessToken(user);
    const { refreshToken, hash, expiresAt } = await createRefreshToken();

    await userService.saveRefreshToken(user.id, hash, expiresAt);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};


const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(new AppError('Refresh token required', 400));

    const hash = hashToken(refreshToken);
    const stored = await userService.findRefreshToken(hash);
    if (!stored) return next(new AppError('Invalid or expired refresh token', 401));

    // rotate — delete old, issue new
    await userService.deleteRefreshToken(hash);

    const user = await userService.findById(stored.user_id);
    if (!user) return next(new AppError('User not found', 404));

    const accessToken = signAccessToken(user);
    const { refreshToken: newRefreshToken, hash: newHash, expiresAt } = await createRefreshToken();
    await userService.saveRefreshToken(user.id, newHash, expiresAt);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};


const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = hashToken(refreshToken);
      await userService.deleteRefreshToken(hash);
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};


const me = async (req, res, next) => {
  try {
    const user = await userService.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// --- helper functions ---

const signAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createRefreshToken = async () => {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(refreshToken);
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN) || 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return { refreshToken, hash, expiresAt };
};

module.exports = { register, login, refresh, logout, me };
