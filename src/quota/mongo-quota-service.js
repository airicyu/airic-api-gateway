'use strict';

const loggerHolder = require('./../logger/logger');
const quotaBucket = require('./quota-bucket');

const quotaService = {
    registerDB: null,
    getQuotas: null,
    validateQuotas: null,
    countQuotas: null
}

const QUOTAS = 'QUOTAS';

quotaService.registerDB = function (db) {
    this._db = db;
}.bind(quotaService);

quotaService.getBucketKeysCount = async function (bucketKeys) {
    return new Promise((resolve, reject) => {
        this._db.collection(QUOTAS).find({ _id: { $in: bucketKeys } }).toArray((err, docs) => {
            if (err) {
                return reject(err);
            } else {
                let response = {};
                for (let i = 0; i < docs.length; i++) {
                    response[bucketKeys[i]] = parseInt(docs[i] && docs[i].count);
                    if (isNaN(response[bucketKeys[i]])) {
                        response[bucketKeys[i]] = undefined;
                    }
                }
                return resolve(response);
            }
        });
    });
}.bind(quotaService);

quotaService.validateQuotas = async function (bucketQuotas) {
    let bukcetDbQuotaMap = {};

    let bucketKeys = [];
    for (let bucketQuota of bucketQuotas) {
        let { bucketKey } = bucketQuota;
        bucketKeys.push(bucketKey);
    }

    return new Promise((resolve, reject) => {
        this._db.collection(QUOTAS).find({ _id: { $in: bucketKeys } }).toArray((err, docs) => {
            if (err) {
                return reject(err);
            } else {
                let dbQuotas = {};
                for (let i = 0; i < docs.length; i++) {
                    dbQuotas[docs[i]._id] = docs[i];
                }

                let result = true;
                let quotaExceedInfo = null;
                for (let i = 0; i < bucketKeys.length; i++) {
                    bukcetDbQuotaMap[bucketKeys[i]] = dbQuotas[bucketKeys[i]] && dbQuotas[bucketKeys[i]].count || 0;
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

    let operationPromises = [];
    for (let i = 0; i < bucketKeys.length; i++) {
        let bucketKey = bucketKeys[i];
        operationPromises.push(this._db.collection(QUOTAS).updateOne({ _id: bucketKey }, {
            $inc: { count: 1 },
            $set: {
                _id: bucketKey,
                keyExpireTime: keyExpireTime[i]
            }
        }, { upsert: true }));
    }
    return Promise.all(operationPromises).then(true);
}.bind(quotaService);

module.exports.quotaService = quotaService;