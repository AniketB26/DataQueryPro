/**
 * Analytics Module Index
 * 
 * Exports all analytics components for easy importing.
 */

const { AnalyticsEngine, analyticsEngine } = require('./AnalyticsEngine');
const SemanticMapper = require('./SemanticMapper');
const StatisticalEngine = require('./StatisticalEngine');
const DataCleaner = require('./DataCleaner');
const QueryPlanner = require('./QueryPlanner');

module.exports = {
    // Main engine
    AnalyticsEngine,
    analyticsEngine,

    // Sub-modules
    SemanticMapper,
    StatisticalEngine,
    DataCleaner,
    QueryPlanner
};
