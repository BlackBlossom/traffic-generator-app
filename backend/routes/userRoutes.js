// routes/userRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // Allows access to params like :email
const campaignController = require('../controllers/campaignController');
const apiKeyAuth = require('../middleware/apiKeyAuth');

router.get('/:email/campaigns', apiKeyAuth, campaignController.getUserCampaigns);
router.post('/:email/campaigns', apiKeyAuth, campaignController.createCampaign);
router.get('/:email/campaigns/:campaignId', apiKeyAuth, campaignController.getSingleCampaign);
router.put('/:email/campaigns/:campaignId', apiKeyAuth, campaignController.updateCampaign);
router.delete('/:email/campaigns/:campaignId', apiKeyAuth, campaignController.deleteCampaign);

// Secure Stop: Only campaign owner can stop
router.post('/:email/campaigns/:campaignId/stop', apiKeyAuth, campaignController.stopCampaign);

// Campaign logs management
router.get('/:email/campaigns/:campaignId/logs', apiKeyAuth, campaignController.getCampaignLogs);
router.delete('/:email/campaigns/:campaignId/logs', apiKeyAuth, campaignController.clearCampaignLogs);

// Campaign analytics
router.get('/:email/campaigns/:campaignId/analytics', apiKeyAuth, campaignController.getCampaignAnalytics);

// User-level log management
router.get('/:email/logs/stats', apiKeyAuth, campaignController.getUserLogStats);
router.get('/:email/logs/global', apiKeyAuth, campaignController.getUserGlobalLogs);
router.delete('/:email/logs/clear', apiKeyAuth, campaignController.clearUserLogs);

module.exports = router;