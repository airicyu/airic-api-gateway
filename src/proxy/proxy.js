'use stream';

const http = require('http');
const https = require('https');
const httpAgent = new http.Agent({
    keepAlive: true,
    maxFreeSockets: 1024,
    keepAliveMsecs: 15000
});
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxFreeSockets: 1024,
    keepAliveMsecs: 15000
});
const url = require('url');

async function proxy(targetUrl, gatewayReq, gatewayRes, gatewayConfig) {
    let agent = httpAgent;
    let proxyModule = http;
    if (targetUrl.indexOf('https') === 0) {
        proxyModule = https;
        agent = httpsAgent;
    }

    let [method, headers, reqBody] = [gatewayReq.method, gatewayReq.headers, gatewayReq.body];

    let xForwardedFor = gatewayReq.headers['x-forwarded-for'] ||
        gatewayReq.connection.remoteAddress ||
        gatewayReq.socket.remoteAddress ||
        gatewayReq.connection && gatewayReq.connection.socket && gatewayReq.connection.socket.remoteAddress;

    if (xForwardedFor) {
        headers['x-forwarded-for'] = xForwardedFor;
    }

    let targetUrlObj = url.parse(targetUrl);
    let requestOptions = Object.assign({}, targetUrlObj);
    requestOptions.method = method;
    requestOptions.headers = headers;
    requestOptions.timeout = gatewayConfig['gateway-timeout'];
    requestOptions.agent = agent;
    requestOptions.rejectUnauthorized = false;

    return new Promise((resolve, reject) => {
        let req = proxyModule.request(requestOptions, function (res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                gatewayRes.write(chunk);
            });
            res.on('end', function () {
                gatewayRes.end();
                return resolve();
            });
        });
        req.on('error', (e) => {});
        if (reqBody instanceof Buffer) {
            req.write(reqBody);
        }
        req.end();
    });
}

module.exports = proxy;