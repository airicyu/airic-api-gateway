'use strict';

function resourceMatcher(req, openapi) {
    let reqUrl = req.path;
    if (reqUrl.slice(-1) === '/') {
        reqUrl = reqUrl.subStr(0, reqUrl.length - 1);
    }
    let reqUrlFragment = reqUrl.split('/');

    if (openapi && openapi.paths) {
        try{
            for (let [path, pathObj] of Object.entries(openapi.paths)) {
                let apiPath = openapi.basePath + path;
                if (matchOpenApiPath(reqUrlFragment, apiPath) && pathObj[req.method.toLowerCase()]) {
                    let operationObj = pathObj[req.method.toLowerCase()];
                    if (operationObj) {
                        return {
                            tags: operationObj.tags || [],
                            operationId: operationObj.operationId || ''
                        };
                    }
                }
            }
        } catch(e){}
    }

    return {
        tags: '',
        operationId: ''
    };
}

function matchOpenApiPath(reqUrlFragment, path) {
    let pathFragment = path.split('/');
    if (reqUrlFragment.length !== pathFragment.length) {
        return false
    }
    for (let i = 0; i < reqUrlFragment.length; i++) {
        if (reqUrlFragment[i] !== pathFragment[i] && !pathFragment[i].match(/{.*?}/)) {
            return false;
        }
    }
    return true;
}

module.exports = resourceMatcher;