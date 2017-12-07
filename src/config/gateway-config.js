'use strict';

const defaultYamlGatewayConfigSource = require('./gateway-config-source').defaultYamlGatewayConfigSource;

const defaultGatewayConfig = {
    "gateway-node-id": "DEFAULT",
    "port": 3000,
    "workspace-id": "",
    "pull-api-config-interval-second": 600,
    "config-server-base-url": "http://localhost:3001/config/export/workspaces/{{workspaceId}}",
    "api-key-validation-endpoint-url": "http://localhost:3001/keys/api-key/verification",
    "gateway-permission-token": "",
    "gateway-timeout": 30000,
    "enable-stat": true,
    "stat-bucket-type": "1m",
    "sync-api-stat-max-records": 100,
    "sync-api-stat-interval-second": 90,
    "sync-api-stat-uri": "http://localhost:3002/stat",
    "key-cache-max-second": 60
};

const gatewayConfigHolder = {
    _gatewayConfig: defaultGatewayConfig,
    _gatewayConfigSource: null,
    getGatewayConfig: null,
    loadGatewayConfig: null,
    setGatewayConfigSource: null
}

gatewayConfigHolder.getGatewayConfig = function () {
    return this._gatewayConfig;
}.bind(gatewayConfigHolder)

gatewayConfigHolder.loadGatewayConfig = async function () {
    let config = await this._gatewayConfigSource.get();
    this._gatewayConfig = Object.assign({}, defaultGatewayConfig, config);
    return new Promise((resolve) => resolve());
}.bind(gatewayConfigHolder);

gatewayConfigHolder.setGatewayConfigSource = function (gatewayConfigSource) {
    this._gatewayConfigSource = gatewayConfigSource;
}.bind(gatewayConfigHolder);


gatewayConfigHolder.setGatewayConfigSource(defaultYamlGatewayConfigSource);

module.exports.gatewayConfigHolder = gatewayConfigHolder;