'use strict';

const request = require('request');

const statSyncAgent = {
    syncStat: null
};

statSyncAgent.syncStat = async function (gatewayConfig, postData) {
    return new Promise((resolve, reject) => {
        request(gatewayConfig['sync-api-stat-uri'], {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'id-key': gatewayConfig['gateway-permission-token']
                },
                body: JSON.stringify(postData)
            },
            function (error, response, body) {
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            });
    });
}.bind(statSyncAgent);


module.exports = statSyncAgent;