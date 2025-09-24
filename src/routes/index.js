const {Router} = require('express');
const urlRoutes = require('./url.routes');

const router = Router();


router.use('/urls', urlRoutes);

module.exports = router;