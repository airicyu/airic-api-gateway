'use strict';

const {getNewCacher} = require('./key-cacher');
const apiKeyCache = getNewCacher();

module.exports.get = apiKeyCache.get;
module.exports.cache = apiKeyCache.cache;