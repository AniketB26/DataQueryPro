/**
 * Services Index
 */

const authService = require('./authService');
const connectionService = require('./connectionService');
const chatService = require('./chatService');
const queryHistoryService = require('./queryHistoryService');

module.exports = {
    authService,
    connectionService,
    chatService,
    queryHistoryService
};
