// let config = require("./config/config");
let express = require('express');
var router = express.Router();

router.post('/setup-session', (req, res, next) => {
  // res.send('hello');
  res.send(req.body.index);
});

module.exports = router;