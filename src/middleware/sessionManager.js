// Stub middleware (auto-generated)
const passthrough = (req, res, next) => next();
const authenticate = passthrough;
const authorize = (...roles) => passthrough;
const requireAuth = passthrough;
const requireAdmin = passthrough;
module.exports = { authenticate, authorize, requireAuth, requireAdmin, default: passthrough };
