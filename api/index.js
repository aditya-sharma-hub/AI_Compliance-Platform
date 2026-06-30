const requestHandler = require('../local-server.js');

module.exports = (req, res) => {
  return requestHandler(req, res);
};
