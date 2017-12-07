'use strict';

const loggerHolder = require('./../logger/logger');
const defaultQuotaService = require('./memory-quota-service').quotaService;

var quotaServiceHolder = {
    _quotaService: defaultQuotaService,
    setQuotaService: null,
    getQuotaService: null
}


quotaServiceHolder.setQuotaService = function (quotaService) {
    this._quotaService = quotaService;
}.bind(quotaServiceHolder);

quotaServiceHolder.getQuotaService = function () {
    return this._quotaService;
}.bind(quotaServiceHolder);


module.exports.quotaServiceHolder = quotaServiceHolder;