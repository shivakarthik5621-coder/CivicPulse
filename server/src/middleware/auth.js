const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to verify JWT token on admin routes.
 * Attaches decoded admin data to req.admin
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Middleware to restrict access based on admin's city and category.
 * Super admins can access all cities and categories.
 * City category admins only see their assigned city + category.
 */
function cityScope(req, res, next) {
  if (req.admin.role === 'super_admin') {
    req.cityFilter = null;
    req.categoryFilter = null;
  } else {
    req.cityFilter = req.admin.city;
    req.categoryFilter = req.admin.category || null;
  }
  next();
}

function generateToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      city: admin.city,
      category: admin.category || null,
      name: admin.name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { verifyToken, cityScope, generateToken, JWT_SECRET };

