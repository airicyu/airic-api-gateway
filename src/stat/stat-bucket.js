'use strict';

const moment = require('moment');

const separator = "#";
const separatorRegExp = RegExp(separator, 'g');

function escapeStr(inStr) {
    return inStr.replace(/_/g, "__").replace(separatorRegExp, "_-");
}

function unescapeStr(inStr) {
    return inStr.replace(separatorRegExp, ":").replace(/__/g, "_");
}

function getBucketKey({ bucketType = "", appId = "", opId = "", clientId = "", timestamp }) {
    var suffix = separator + appId + separator + escapeStr(opId) + separator + clientId;

    if (bucketType === '1m') {
        return bucketType + separator + Math.floor(timestamp / 60) + suffix;
    } else if (bucketType === '5m') {
        return bucketType + separator + Math.floor(timestamp / 300) + suffix;
    } else if (bucketType === '1h') {
        return bucketType + separator + Math.floor(timestamp / 3600) + suffix;
    } else {
        return null;
    }
}

function extractBucketInfo(bucketKey) {
    let [ bucketType, bucketIndex, appId, opId, clientId ] = bucketKey.split(separator);
    opId = unescapeStr(opId);
    bucketIndex = parseInt(bucketIndex);
    return { bucketType, bucketIndex, appId, opId, clientId };
}

function transformBucketKeyToStatRecord(bucketKey, count) {
    let { bucketType = "", bucketIndex, appId = "", opId = "", clientId = "" } = extractBucketInfo(bucketKey);

    let record = {
        bucketType: bucketType,
        bucketStart: null,
        bucketEnd: null,
        bucketIndex: bucketIndex,
        appId: appId,
        opId: opId,
        clientId: clientId,
        count: count
    };

    if (bucketType === '1m') {
        record.bucketStart = bucketIndex * 60;
        record.bucketEnd = (bucketIndex + 1) * 60;
    } else if (bucketType === '5m') {
        record.bucketStart = bucketIndex * 300;
        record.bucketEnd = (bucketIndex + 1) * 300;
    } else if (bucketType === '1h') {
        record.bucketStart = bucketIndex * 3600;
        record.bucketEnd = (bucketIndex + 1) * 3600;
    }

    return record;
}

module.exports = {
    getBucketKey,
    transformBucketKeyToStatRecord
}