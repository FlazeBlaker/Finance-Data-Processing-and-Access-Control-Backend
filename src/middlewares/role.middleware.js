/**
 * Middleware to check user role authorization
 * @param  {...string} roles - List of allowed roles (e.g., 'admin', 'viewer')
 * @returns {Function} Middleware function
 *
 * Usage:
 *   router.get('/admin', authenticate, authorizeRoles('admin'), adminController);
 *   router.get('/analyst-or-admin', authenticate, authorizeRoles('analyst', 'admin'), handler);
 */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated (req.user should exist)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user's role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Required role(s): ' + roles.join(', ')
      });
    }

    // User has required role, continue
    next();
  };
};
