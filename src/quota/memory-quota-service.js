'use strict';

const quotaMap = {};

const quotaService = {
    getQuotas: null,
    validateQuotas: null,
    countQuotas: null
}

quotaService.getBucketKeysCount = async function (bucketKeys) {
    let response = {};
    for (let bucketKey of bucketKeys) {
        response[bucketKey] = quotaMap[bucketKey];
    }
    return response;
}.bind(quotaService);

quotaService.validateQuotas = async function (bucketQuotas) {
    let result = true;
    let quotaExceedInfo = null;

    for (let bucketQuota of bucketQuotas) {
        let { bucketKey, quota, planMeta } = bucketQuota;
        let quotaCurrentCount = quotaMap[bucketKey];
        if (quotaCurrentCount !== undefined && quotaCurrentCount >= quota) {
            result = false;
            quotaExceedInfo = {
                bucketKey, planMeta
            };
            break;
        }
    }

    return [result, quotaExceedInfo];
}.bind(quotaService);

quotaService.countQuotas = async function (bucketKeys) {
    for (let bucketKey of bucketKeys) {
        quotaMap[bucketKey] = quotaMap[bucketKey] || 0;
        quotaMap[bucketKey]++;
    }
    return true;
}.bind(quotaService);


module.exports.quotaService = quotaService;