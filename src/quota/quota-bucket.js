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

function getBucketKey({ bucketType = "", appId = "", tag = "", opId = "", clientId = "", timestamp }) {
    var suffix = separator + appId + separator + escapeStr(tag) + separator + escapeStr(opId) + separator + clientId;

    if (bucketType === '1m') {
        return bucketType + separator + Math.floor(timestamp / 60) + suffix;
    } else if (bucketType === '5m') {
        return bucketType + separator + Math.floor(timestamp / 300) + suffix;
    } else if (bucketType === '1h') {
        return bucketType + separator + Math.floor(timestamp / 3600) + suffix;
    } else if (bucketType === '1d') {
        return bucketType + separator + Math.floor(timestamp / 86400) + suffix;
    } else if (bucketType === '1w') {
        return bucketType + separator + Math.floor((timestamp - 86400 * 4) / 7 * 86400) + suffix;
    } else if (bucketType === '1M') {
        let now = moment.unix(timestamp);
        return bucketType + separator + (now.year() * 12 + now.month() + 1) + suffix;
    } else {
        return null;
    }
}

function extractBucketInfo(bucketKey) {
    let [bucketType, bucketIndex, appId, tag, opId, clientId] = bucketKey.split(separator);
    tag = unescapeStr(tag);
    opId = unescapeStr(opId);
    return { bucketType, bucketIndex, appId, tag, opId, clientId };
}

function extractStartTimeFromBucketKey(bucketKey) {
    let { bucketType, bucketIndex } = extractBucketInfo(bucketKey);
    if (bucketType === '1m') {
        return bucketIndex * 60;
    } else if (bucketType === '5m') {
        return bucketIndex * 300;
    } else if (bucketType === '1h') {
        return bucketIndex * 3600;
    } else if (bucketType === '1d') {
        return bucketIndex * 86400;
    } else if (bucketType === '1w') {
        return 86400 * 4 + bucketIndex * 7 * 86400;
    } else if (bucketType === '1M') {
        let year = Math.floor(parseInt(bucketIndex) / 12);
        let month = parseInt(bucketIndex) % 12 + 1;
        return moment(`${year}-${month}-1`, "YYYY-M-D").unix();
    } else {
        return null;
    }
}

function extractEndTimeFromBucketKey(bucketKey) {
    let {bucketType, bucketIndex} = extractBucketInfo(bucketKey);
    bucketIndex = parseInt(bucketIndex);

    if (bucketType === '1m') {
        return (bucketIndex + 1) * 60;
    } else if (bucketType === '5m') {
        return (bucketIndex + 1) * 300;
    } else if (bucketType === '1h') {
        return (bucketIndex + 1) * 3600;
    } else if (bucketType === '1d') {
        return (bucketIndex + 1) * 86400;
    } else if (bucketType === '1w') {
        return 86400 * 4 + (bucketIndex + 1) * 7 * 86400;
    } else if (bucketType === '1M') {
        let year = Math.floor((bucketIndex + 1) / 12);
        let month = (bucketIndex + 1) % 12 + 1;
        return moment(`${year}-${month}-1`, "YYYY-M-D").unix();
    } else {
        return null;
    }
}

module.exports = {
    getBucketKey,
    extractBucketInfo,
    extractStartTimeFromBucketKey,
    extractEndTimeFromBucketKey
}