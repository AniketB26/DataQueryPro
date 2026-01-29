/**
 * Controllers Index
 */

const authController = require('./authController');
const dbController = require('./dbController');
const chatController = require('./chatController');

module.exports = {
    authController,
    dbController,
    chatController
};
