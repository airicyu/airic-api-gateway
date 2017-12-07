'use strict';

const crypto = require('crypto');
const {LRUMap} = require('./lru');

function hash(data) {
    return data
    //return crypto.createHash('md5').update(data).digest("hex");
}

const quotaCache = new LRUMap(10000);

function get(key){
    return quotaCache.get(hash(key));
}

function cache(key, value){
    return quotaCache.set(hash(key), {
        v: value,
        t: Date.now()
    });
}

module.exports.get = get;
module.exports.cache = cache;