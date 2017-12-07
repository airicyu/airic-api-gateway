'use strict';
const YAML = require('yamljs');

const defaultYamlGatewayConfigSource = {
    get: null
}

defaultYamlGatewayConfigSource.get = async function () {
    let gatewayConfig = YAML.load('./gateway-config.yaml');
    return new Promise((resolve) => { resolve(gatewayConfig) });
}.bind(defaultYamlGatewayConfigSource);

module.exports.defaultYamlGatewayConfigSource = defaultYamlGatewayConfigSource;