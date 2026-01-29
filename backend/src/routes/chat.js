/**
 * Chat Routes
 * 
 * POST /api/chat/new         - Create new chat session
 * GET  /api/chat/history     - Get chat history
 * GET  /api/chat/suggestions - Get query suggestions
 * POST /api/chat/clear       - Clear chat history
 * GET  /api/chat/export      - Export chat history
 */

const express = require('express');
const router = express.Router();
const { chatController } = require('../controllers');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Chat routes
router.post('/new', chatController.createChatSession);
router.get('/history', chatController.getChatHistory);
router.get('/suggestions', chatController.getSuggestions);
router.post('/clear', chatController.clearHistory);
router.get('/export', chatController.exportChat);

module.exports = router;
