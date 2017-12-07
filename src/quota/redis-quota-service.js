'use strict';

const loggerHolder = require('./../logger/logger');
const quotaBucket = require('./quota-bucket');
//const quotaCache = require('./quota-cache');

const quotaService = {
    setClient: null,
    getQuotas: null,
    validateQuotas: null,
    countQuotas: null
}

quotaService.setClient = function (client) {
    this.client = client;
}.bind(quotaService);

quotaService.getBucketKeysCount = async function (bucketKeys) {

    return new Promise((resolve, reject) => {
        this.client.mget(bucketKeys, function (err, replies) {
            if (err) {
                return reject(err);
            } else {
                let response = {};
                for (let i = 0; i < replies.length; i++) {
                    let quotaCount = parseInt(replies[i]);
                    response[bucketKeys[i]] = quotaCount;
                    if (isNaN(response[bucketKeys[i]])) {
                        response[bucketKeys[i]] = undefined;
                    } else {
                        /*quotaCache.cache(bucketKeys[i], {
                            v: quotaCount,
                            t: Date.now()
                        })*/
                    }
                }
                return resolve(response);
            }
        });
    });

}.bind(quotaService);

/*
quotaService.validateQuotasWithCache = function (bucketQuotas) {
    let result = true;

    let bukcetDbQuotaMap = {};

    let bucketQuotasPendingCheck = [];

    for (let bucketQuota of bucketQuotas) {
        let { bucketKey, quota, planMeta } = bucketQuota;

        let cachedResult = quotaCache.get(bucketKey);
        if (cachedResult && Date.now() - cachedResult.t <= 3 * 1000) {
            let quotaCurrentCount = cachedResult.v;
            if (quotaCurrentCount && parseInt(quotaCurrentCount) >= parseInt(quota)) {
                result = false;
                quotaExceedInfo = {
                    bucketKey,
                    planMeta
                };
                break;
            }
        } else {
            bucketQuotasPendingCheck.push(bucketQuota);
        }
    }

    if (!result) {
        return [result, quotaExceedInfo];
    } else {
        return [result, bucketQuotasPendingCheck];
    }
}.bind(quotaService);
*/

quotaService.validateQuotas = async function (bucketQuotas) {

    /*let [checkCacheResult, variable] = this.validateQuotasWithCache(bucketQuotas);
    if (!checkCacheResult) {
        return [false, quotaExceedInfo = variable];
    } else {
        bucketQuotas = variable;
    }*/

    if (bucketQuotas && bucketQuotas.length === 0) {
        return [true, null];
    }

    let result = true;

    let bukcetDbQuotaMap = {};

    let bucketKeys = [];
    for (let bucketQuota of bucketQuotas) {
        let { bucketKey } = bucketQuota;
        bucketKeys.push(bucketKey);
    }

    return new Promise((resolve, reject) => {
        this.client.mget(bucketKeys, function (err, replies) {
            if (err) {
                return reject(err);
            } else {
                let dbQuotas = replies;
                let result = true;
                let quotaExceedInfo = null;

                for (let i = 0; i < bucketKeys.length; i++) {
                    bukcetDbQuotaMap[bucketKeys[i]] = dbQuotas[i];
                }
                for (let bucketQuota of bucketQuotas) {
                    let { bucketKey, quota, planMeta } = bucketQuota;
                    let quotaCurrentCount = bukcetDbQuotaMap[bucketKey];
                    if (quotaCurrentCount && parseInt(quotaCurrentCount) >= parseInt(quota)) {
                        result = false;
                        quotaExceedInfo = {
                            bucketKey,
                            planMeta
                        };
                        break;
                    }
                }
                return resolve([result, quotaExceedInfo]);
            }
        });
    });
}.bind(quotaService);

quotaService.countQuotas = async function (bucketKeys) {
    let setKeyParams = [];

    let now = Date.now();
    let keyExpireTime = [];
    for (let bucketKey of bucketKeys) {
        let keyExpireTimeAt = quotaBucket.extractEndTimeFromBucketKey(bucketKey);
        keyExpireTime.push(keyExpireTimeAt - Math.round(now / 1000) + 300);
    }

    let multi = this.client.multi();

    return new Promise((resolve, reject) => {
        for (let i = 0; i < bucketKeys.length; i++) {
            multi.incr(bucketKeys[i]);
            multi.expire(bucketKeys[i], keyExpireTime[i]);
        }
        multi.exec(function (err, replies) {
            if (err) {
                loggerHolder.getLogger().error(err);
                return reject(false);
            } else {
                return resolve(true);
            }
        });
    });
}.bind(quotaService);



module.exports.quotaService = quotaService;