const { AppError } = require('../utils/errors');


const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do this', 403));
    }

    next();
  };
};

module.exports = { requireRole };
