'use strict';

const YAML = require('yamljs');
const request = require('request');

const configSource = {
    pull: null,
    getAppOpenApiSpec: null
};

configSource.pull = async function (gatewayConfig) {
    let configUrl = `${gatewayConfig['config-server-base-url']}/config/export/workspaces/${gatewayConfig['workspace-id']}`;
    return new Promise((resolve, reject) => {
        request(configUrl, {
                json: true,
                headers: {
                    'id-key': gatewayConfig['gateway-permission-token'] || ''
                }
            },
            function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode === 200) {
                    let workspaceConfig = body.workspaces[gatewayConfig['workspace-id']];
                    resolve(workspaceConfig);
                } else {
                    resolve(null);
                }
            });
    });
}.bind(configSource);

configSource.getAppOpenApiSpec = async function (gatewayConfig, workspaceId, appId) {
    let configUrl = `${gatewayConfig['config-server-base-url']}/config/workspaces/${workspaceId}/apps/${appId}/open-api-specs`;
    return new Promise((resolve, reject) => {
        request(configUrl, {
                headers: {
                    'id-key': gatewayConfig['gateway-permission-token'] || ''
                }
            },
            function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode === 200) {
                    let openApiSpec = YAML.parse(body);
                    resolve(openApiSpec);
                } else {
                    resolve(null);
                }
            });
    });
}.bind(configSource);

module.exports.configSource = configSource;