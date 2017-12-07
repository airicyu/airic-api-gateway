'use stric';

const loggerHolder = require('./../logger/logger');
const statBucket = require('./stat-bucket');
const statSyncAgent = require('./stat-sync-agent');

function _transformBufferStoreToRecord(buffer) {
    let records = [];
    for (let [key, value] of Object.entries(buffer.store)) {
        records.push(statBucket.transformBucketKeyToStatRecord(key, value));
    }
    return records;
}

const statBuffer = {
    buffer: {
        startTime: Date.now(),
        endTime: null,
        store: {},
        storeCount: 0,
    },
    _statSyncAgent: null,
    recordStatToBuffer: null,
    swapBuffer: null,
    setStatSyncAgent: null,
    syncStat: null
}


statBuffer.recordStatToBuffer = function ({ bucketType = "", appId = "", opId = "", clientId = "", timestamp }) {
    let bucketKey = statBucket.getBucketKey({ bucketType, appId, opId, clientId, timestamp });
    if (this.buffer.store[bucketKey] === undefined) {
        this.buffer.store[bucketKey] = 1;
        this.buffer.storeCount++;
    } else {
        this.buffer.store[bucketKey]++;
        this.buffer.storeCount++;
    }
}.bind(statBuffer);

statBuffer.swapBuffer = function () {
    let nowTimestamp = Date.now();
    let swappedBuffer = this.buffer;
    this.buffer = {
        startTime: nowTimestamp,
        endTime: null,
        store: {},
        storeCount: 0,
    };
    swappedBuffer.endTime = nowTimestamp;
    return swappedBuffer;
}.bind(statBuffer);

statBuffer.setStatSyncAgent = function (statSyncAgent) {
    this._statSyncAgent = statSyncAgent;
}.bind(statBuffer);

statBuffer.syncStat = async function (gatewayConfig) {
    if (Date.now() - statBuffer.buffer.startTime >= gatewayConfig['sync-api-stat-interval-second']*1000 ||
        statBuffer.buffer.storeCount >= gatewayConfig['sync-api-stat-max-records']) {

        try {
            let gatewayNodeId = gatewayConfig['gateway-node-id'];
            let buffer = this.swapBuffer();
            let records = _transformBufferStoreToRecord(buffer);
            if (records.length > 0) {
                let now = Date.now();
                let postData = {
                    statRecordEventId: gatewayNodeId + '#' + now,
                    gatewayNodeId,
                    eventTime: now,
                    recordStart: buffer.startTime,
                    recordEnd: buffer.endTime,
                    records
                };
                loggerHolder.getLogger().log(new Date().toISOString(), 'API Gateway sync stat');
                await this._statSyncAgent.syncStat(gatewayConfig, postData);
                loggerHolder.getLogger().log(new Date().toISOString(), 'API Gateway synced stat');
            }
        } catch (e) {
            loggerHolder.getLogger().error(e);
        }
    }

    return new Promise((resolve) => resolve());
}.bind(statBuffer);

statBuffer.setStatSyncAgent(statSyncAgent);

module.exports = statBuffer;