class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    // so instanceof checks still work after transpilation
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

module.exports = { AppError };
