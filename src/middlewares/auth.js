const auth = (req, res, next) => {
  // Dummy authentication middleware
  // const token = req.headers['authorization'];
  next();
};

module.exports = { auth };
