'use strict';

const os = require('os');
const uuidv4 = require('uuid/v4');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const loggerHolder = require('./logger/logger');
const apiConfigHolder = require('./config/api-config').apiConfigHolder;
const gatewayConfigHolder = require('./config/gateway-config').gatewayConfigHolder;
const quotaServiceHolder = require('./quota/quota-service').quotaServiceHolder;
const quotaBucket = require('./quota/quota-bucket');
const statBuffer = require('./stat/stat-buffer');
const resourceMatcher = require('./openapi/resource-matcher');
const proxy = require('./proxy/proxy');
const { getTimer } = require('./timer');
const keyCache = require('./key/key-cache');

const defaultYamlGatewayConfigSource = require('./config/gateway-config-source').defaultYamlGatewayConfigSource;
const memoryQuotaService = require('./quota/memory-quota-service').quotaService;
const redisQuotaService = require('./quota/redis-quota-service').quotaService;
const mongoQuotaService = require('./quota/mongo-quota-service').quotaService;

function buildError(codeMessage, e, extraAttributesMap) {
    let error = {
        code: codeMessage.code,
        message: codeMessage.message,
        err: e
    };
    if (extraAttributesMap) {
        for (let [key, val] of Object.entries(extraAttributesMap)) {
            error[key] = val;
        }
    }
    return error;
}

const ERROR_CODE = {
    QUOTA_EXCEED_LIMITATION_ERROR: {
        code: '60c7f8ec-80f5-4a72-aff3-e57280a5d78d',
        message: 'QUOTA_EXCEED_LIMITATION_ERROR'
    },
    QUOTA_VALIDATION_ERROR: {
        code: '2e225fe8-54ec-4511-b5c4-baaf32e2390a',
        message: 'QUOTA_VALIDATION_ERROR'
    },
    API_KEY_INVALID: {
        code: 'dad8df6e-8abd-42a5-9c45-ce6a28bcc90d',
        message: 'API_KEY_INVALID:'
    },
    API_KEY_VALIDATION_ERROR: {
        code: 'eabbb79f-0444-44ee-a141-cd02def9e1d2',
        message: 'API_KEY_VALIDATION_ERROR:'
    }
};

const apiGateway = {
    _app: null,
    registerLogger: null,
    getLogger: null,
    registerQuotaService: null,
    registerStatSyncAgent: null,
    registerGatewayConfigSource: null,
    inflateExpressApp: null,
    run: null,
    implementations: {
        gatewayConfigSource: {
            defaultYamlGatewayConfigSource
        },
        quotaService: {
            memoryQuotaService: memoryQuotaService,
            redisQuotaService: redisQuotaService,
            mongoQuotaService: mongoQuotaService
        }
    }
}

async function _validateApiKey({ gatewayConfig, apiKey }) {
    if (!apiKey){
        return Promise.reject(buildError(ERROR_CODE.API_KEY_INVALID));
    }

    let keyCacheResult = keyCache.get(apiKey);
    if (keyCacheResult){
        if (!keyCacheResult.v){
            return false;
        } else if (Date.now() - keyCacheResult.t <= gatewayConfig['key-cache-max-second'] * 1000){
            return true;
        }
    }

    return new Promise((resolve, reject) => {
        request(gatewayConfig['api-key-validation-endpoint-url'], {
            method: 'POST',
            json: true,
            body: {
                key: apiKey
            }
        }, function (error, response, body) {
            if (error) {
                return reject(error);
            } else if (response.statusCode !== 200) {
                return reject(new Error('Invalid response with response code ', response.statusCode));
            } else {
                let resBody = body;
                if (typeof resBody === 'string') {
                    try {
                        resBody = JSON.parse(resBody);
                    } catch (e) {
                        return reject(e);
                    }
                }
                if (resBody && resBody.result === true) {
                    keyCache.cache(apiKey, true);
                    return resolve(true);
                } else {
                    keyCache.cache(apiKey, false);
                    return resolve(false);
                }
            }
        });
    });
}

async function _checkQuota({ appId, clientId, appConfig, clientConfig, clientPlans, currTags, currOperationId }) {
    let timestamp = moment().unix();

    let appQuotaRule = appConfig && appConfig.quotaRule

    if (clientPlans.length > 0 && appQuotaRule) {

        //check quota rule
        let quotaPlans = clientPlans.filter(planName => appConfig && appConfig.quotaRule && appConfig.quotaRule[planName] != undefined);

        let bucketQuotas = [];

        for (let planName of quotaPlans) {

            let plan = appConfig.quotaRule[planName];

            //get app quota rule bucket keys
            if (plan.app && plan.app.length > 0) {
                for (let appQuota of plan.app) {
                    if (appQuota.bucket && appQuota.quota) {
                        let bucketKey = quotaBucket.getBucketKey({ bucketType: appQuota.bucket, appId, tag: '*', opId: "*", clientId, timestamp });
                        bucketQuotas.push({
                            quota: appQuota.quota,
                            bucketKey,
                            planMeta : {
                                name: planName,
                                type: 'app',
                            }
                        });
                    }
                }
            }

            //get tag quota rule bucket keys
            for (let currTag of currTags) {
                if (plan.tag && plan.tag[currTag] && plan.tag[currTag].length > 0) {
                    for (let tagQuota of plan.tag[currTag]) {
                        if (tagQuota.bucket && tagQuota.quota) {
                            let bucketKey = quotaBucket.getBucketKey({ bucketType: tagQuota.bucket, appId, tag: currTag, opId: "*", clientId, timestamp });
                            bucketQuotas.push({
                                quota: tagQuota.quota,
                                bucketKey,
                                planMeta : {
                                    name: planName,
                                    type: 'tag',
                                    target: currTag
                                }
                            });
                        }
                    }
                }
            }

            //get operation quota rule bucket keys
            if (plan.operation && plan.operation[currOperationId] && plan.operation[currOperationId].length > 0) {
                for (let operationQuota of plan.operation[currOperationId]) {
                    if (operationQuota.bucket && operationQuota.quota) {
                        let bucketKey = quotaBucket.getBucketKey({ bucketType: operationQuota.bucket, appId, tag: '*', opId: currOperationId, clientId, timestamp });
                        bucketQuotas.push({
                            quota: operationQuota.quota,
                            bucketKey,
                            planMeta : {
                                name: planName,
                                type: 'operation id',
                                target: currOperationId
                            }
                        });
                    }
                }
            }
        }

        return new Promise(async(resolve, reject) => {
            if (bucketQuotas && bucketQuotas.length > 0) {
                try {
                    let [validateResult, quotaExceedInfo] = await quotaServiceHolder.getQuotaService().validateQuotas(bucketQuotas);
                    if (!validateResult) {
                        let planMeta = quotaExceedInfo.planMeta;
                        let quotaExceedDisplayInfo = {};
                        
                        quotaExceedDisplayInfo.planName = planMeta.name;
                        quotaExceedDisplayInfo.quotaTargetType = planMeta.type;
                        if (planMeta.type === 'tag' || planMeta.type === 'operation id'){
                            quotaExceedDisplayInfo.quotaTarget = planMeta.target;
                        }
                        quotaExceedDisplayInfo.quotaWindow = quotaBucket.extractBucketInfo(quotaExceedInfo.bucketKey).bucketType;
                        quotaExceedDisplayInfo.quotaCountStartTime = quotaBucket.extractStartTimeFromBucketKey(quotaExceedInfo.bucketKey);
                        quotaExceedDisplayInfo.quotaCountEndTime = quotaBucket.extractEndTimeFromBucketKey(quotaExceedInfo.bucketKey);
                        return resolve([false, quotaExceedDisplayInfo]);
                    } else {
                        let uniqueKeysMap = {};
                        let uniqueCheckedBucketKeys = bucketQuotas.map(_ => _.bucketKey).filter(function (item) {
                            return uniqueKeysMap.hasOwnProperty(item) ? false : (uniqueKeysMap[item] = true);
                        });
                        return resolve([true, uniqueCheckedBucketKeys]);
                    }
                } catch (e) {
                    return reject(e);
                }
            }
        });

    }
    return [true, []];
}

async function _countQuota({ bucketKeys }) {
    return quotaServiceHolder.getQuotaService().countQuotas(bucketKeys).then(() => {
        return quotaServiceHolder.getQuotaService().getBucketKeysCount(bucketKeys)
    }).then((getQuotaResult) => {
        loggerHolder.getLogger().log(getQuotaResult);
    }).catch(err => loggerHolder.getLogger().log(err));
}

apiGateway.registerLogger = function(logger) {
    loggerHolder.setLogger(logger);
}.bind(apiGateway);

apiGateway.getLogger = function() {
    return loggerHolder.getLogger();
}.bind(apiGateway);

apiGateway.registerGatewayConfigSource = function(gatewayConfigSource) {
    gatewayConfigHolder.setGatewayConfigSource(gatewayConfigSource);
}.bind(apiGateway);

apiGateway.registerQuotaService = function(quotaService) {
    quotaServiceHolder.setQuotaService(quotaService);
}.bind(apiGateway);

apiGateway.registerStatSyncAgent = function(statSyncAgent) {
    statBuffer.setStatSyncAgent(statSyncAgent);
}.bind(apiGateway);

let getApiKeyPayload = (req) => {
    let apiKey = req.header('api-key');
    let apiKeyPayload = {};
    
    if (apiKey){
        try{
            let decodedApiKey = jwt.decode(apiKey, {
                complete: true
            });
            if (decodedApiKey && decodedApiKey.payload){
                apiKeyPayload = decodedApiKey.payload;
                return [true, apiKeyPayload];
            }
        } catch(e){
        }
    }

    return [false, null];
}

apiGateway.inflateExpressApp = function(app) {
    this._app = app || express();
    app = this._app

    app.use(bodyParser.raw({
        max: '50mb',
        type: function (req) {
            return true;
        }
    }))

    app.get('/api-gateway-healthcheck', function (req, res) {
        res.send('OK');
    });

    app.all('/*', async function (req, res) {
        let gatewayProcessTimer = getTimer('gatewayProcessTimer').start();
        let gatewayResponseTimer = getTimer('gatewayResponseTimer').start();
        let validateApiKeyProcessTimer = getTimer('validateApiKeyProcessTimer');
        let checkQuotaProcessTimer = getTimer('checkQuotaProcessTimer');
        
        let gatewayConfig = gatewayConfigHolder.getGatewayConfig();
        let path = req.originalUrl;

        let apiConfig = apiConfigHolder.get();
        //let apiKey = req.header('api-key');
        let [decodeKeySuccess, apiKeyPayload] = getApiKeyPayload(req);
        
        if (!decodeKeySuccess){
            return res.status(401).send('Invalid API key');
        }

        let appId = apiKeyPayload.appId;
        let clientId = apiKeyPayload.clientId;

        let appConfig = apiConfig.apps && apiConfig.apps[appId] || {};

        let clientConfig = apiConfig.clients && apiConfig.clients[clientId] || {};
        let clientPlans = clientConfig && clientConfig.plans && clientConfig.plans[appId] || [];

        let openApiSpec = (apiConfig.openApiSpecs || {})[appId];
        if (!openApiSpec) {
            return res.sendStatus(404);
        }
        
        let {
            tags: currTags,
            operationId: currOperationId
        } = resourceMatcher(req, openApiSpec);
        
        if (!currOperationId || currOperationId.length === 0){
            return res.sendStatus(404);
        }
        
        let checkedBucketKeys = [];
        let checkingError = null;
        try {
            checkedBucketKeys = await Promise.all([
                new Promise((resolve, reject)=>{
                    validateApiKeyProcessTimer.start();
                    return _validateApiKey({ gatewayConfig, apiKey }).catch((e) => {
                        return Promise.reject(buildError(ERROR_CODE.API_KEY_VALIDATION_ERROR, e));
                    }).then((result)=>{
                        validateApiKeyProcessTimer.stop();
                        return resolve(result);
                    }).catch((reason)=>{
                        validateApiKeyProcessTimer.stop();
                        return reject(reason);
                    })
                })
                ,
                new Promise((resolve, reject)=>{
                    checkQuotaProcessTimer.start();
                    return _checkQuota({ appId, clientId, appConfig, clientConfig, clientPlans, currTags, currOperationId }).catch((e) => {
                        return Promise.reject(buildError(ERROR_CODE.QUOTA_VALIDATION_ERROR, e));
                    }).then((results)=>{
                        checkQuotaProcessTimer.stop();
                        return resolve(results);
                    }).catch((reason)=>{
                        checkQuotaProcessTimer.stop();
                        return reject(reason);
                    })
                })
            ]).then(([validateApiKeySuccess, checkQuotaResult]) => {
                let [checkQuotaSuccess, checkQuotaResultData] = checkQuotaResult;

                if (!validateApiKeySuccess) {
                    return Promise.reject(buildError(ERROR_CODE.API_KEY_INVALID));
                } else if (!checkQuotaSuccess) {
                    let quotaExceedDisplayInfo = checkQuotaResultData;
                    return Promise.reject(buildError(ERROR_CODE.QUOTA_EXCEED_LIMITATION_ERROR, undefined, {quotaExceedDisplayInfo}));
                }

                let uniqueKeysMap = {};
                let uniqueCheckedBucketKeys = checkQuotaResultData.filter(function (item) {
                    return uniqueKeysMap.hasOwnProperty(item) ? false : (uniqueKeysMap[item] = true);
                });
                return Promise.resolve(uniqueCheckedBucketKeys);
            });
        } catch (rejectReason) {
            loggerHolder.getLogger().error(rejectReason);
            checkingError = rejectReason;
            if (checkingError.code === ERROR_CODE.API_KEY_VALIDATION_ERROR.code ||
                checkingError.code === ERROR_CODE.QUOTA_VALIDATION_ERROR.code) {
                return res.sendStatus(500);
            } else if (checkingError.code === ERROR_CODE.API_KEY_INVALID.code) {
                return res.status(401).send('Invalid API key');
            } else if (checkingError.code === ERROR_CODE.QUOTA_EXCEED_LIMITATION_ERROR.code) {
                return res.status(429).send({
                    message: 'Quota Exceed Limitation Error',
                    data: checkingError.quotaExceedDisplayInfo
                });
            } else {
                return res.sendStatus(500);
            }
        }
        
        let targetUrl = '';
        targetUrl += openApiSpec.schemes[0] + "://" + openApiSpec.host + path;

        let gatewayProxyTimer = getTimer('gatewayProxyTimer').start();
        await proxy(targetUrl, req, res, gatewayConfig);
        gatewayProxyTimer.stop();
        gatewayResponseTimer.stop();
        
        if (checkedBucketKeys && checkedBucketKeys.length > 0) {
            //we don't await this promise because we want to do it async in parallel
            _countQuota({ bucketKeys: checkedBucketKeys }).then();
        }

        if (gatewayConfig['enable-stat']) {
            statBuffer.recordStatToBuffer({ bucketType: gatewayConfig['stat-bucket-type'], appId, opId: currOperationId, clientId, timestamp: moment().unix() });
        }
        gatewayProcessTimer.stop();
        
        if (Math.random()<0.00001){
            loggerHolder.getLogger().debug({
                gatewayProcessTimer: gatewayProcessTimer.getInfoString(),
                gatewayResponseTimer: gatewayResponseTimer.getInfoString(),
                gatewayProxyTimer: gatewayProxyTimer.getInfoString(),
                validateApiKeyProcessTimer: validateApiKeyProcessTimer.getInfoString(),
                checkQuotaProcessTimer: checkQuotaProcessTimer.getInfoString()
            });
            loggerHolder.getLogger().debug(`gatewayResponseTimeExcludeProxyTime: ${gatewayResponseTimer.getDuration() - gatewayProxyTimer.getDuration()}ms`);
        }
    });

}.bind(apiGateway);

apiGateway.run = async function() {
    let self = this;
    if (!self._app) {
        self.inflateExpressApp();
    }

    await gatewayConfigHolder.loadGatewayConfig();
    let gatewayConfig = gatewayConfigHolder.getGatewayConfig();
    if (gatewayConfig['gateway-node-id'] === 'DEFAULT') {
        gatewayConfig['gateway-node-id'] = os.hostname + ':' + gatewayConfig['port'];
    } else if (gatewayConfig['gateway-node-id'] === 'RANDOM-UUID') {
        gatewayConfig['gateway-node-id'] = uuidv4();
    }

    loggerHolder.getLogger().log('api-gateway starting with config: ', gatewayConfig);

    await apiConfigHolder.pullConfig(gatewayConfig);
    self.pullConfigInterval = setInterval(apiConfigHolder.pullConfig, gatewayConfig['pull-api-config-interval-second'] * 1000, gatewayConfig);

    if (gatewayConfig['enable-stat']) {
        statBuffer.swapBuffer();
        self.syncStatInterval = setInterval(statBuffer.syncStat, Math.min(10*1000, Math.max(3*1000, gatewayConfig['sync-api-stat-interval-second'] * 1000 / 10)), gatewayConfig);
    }

    return new Promise((resolve) => {
        self._app.listen(gatewayConfig['port'], function () {
            clearInterval(self.pullConfigInterval);
            clearInterval(self.syncStatInterval);
            loggerHolder.getLogger().log('api-gateway listening on port 3000!');
            resolve();
        });
    });

}.bind(apiGateway);


module.exports = apiGateway