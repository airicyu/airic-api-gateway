'use strict';

const crypto = require('crypto');
const { LRUMap } = require('./lru');

function getNewCacher() {
    let cacher = {
        _cacheMap: new LRUMap(10000)
    };

    cacher.hashKeyFunction = function (data) {
        return crypto.createHash('md5').update(data).digest("hex");
    }.bind(cacher);

    cacher.get = function (key) {
        return this._cacheMap.get(this.hashKeyFunction(key));
    }.bind(cacher);

    cacher.cache = function (key, v) {
        return this._cacheMap.set(this.hashKeyFunction(key), {
            v: v,
            t: Date.now()
        });
    }.bind(cacher);

    return cacher;
}

module.exports.getNewCacher = getNewCacher;