const {Router} = require('express');
const userRoutes = require('./user.routes');
const urlRoutes = require('./url.routes');

const router = Router();

router.use('/users', userRoutes);
router.use('/urls', urlRoutes);

module.exports = router;