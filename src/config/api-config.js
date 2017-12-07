'use strict';

const loggerHolder = require('./../logger/logger');
const configSource = require('./api-config-source-util').configSource;

const apiConfigHolder = {
    configSource: configSource,
    _lastConfigUpdateTime: null,
    config: {
        apps: {},
        clients: {},
        openApiSpecs:{}
    },
    get: null,
    pullConfig: null
}

apiConfigHolder.get = function () {
    return this.config;
}.bind(apiConfigHolder);



apiConfigHolder.pullConfig = async function (gatewayConfig) {
    loggerHolder.getLogger().log(new Date().toISOString(), 'API Gateway pulling API config');

    let pullTime = Date.now();

    let newConfig;
    try {
        newConfig = await this.configSource.pull(gatewayConfig);
    } catch (e) {
        loggerHolder.getLogger().error(e);
    }
    
    if (newConfig){
        newConfig.openApiSpecs = {};
        
        for(let[appId, app] of Object.entries(newConfig.apps)){
            if (!this._lastConfigUpdateTime || app.openAPISpecLastUpdateTime > this._lastConfigUpdateTime){
                try{
                    let openApiSpec = await this.configSource.getAppOpenApiSpec(gatewayConfig, gatewayConfig['workspace-id'], appId);
                    newConfig.openApiSpecs[appId] = openApiSpec;
                } catch (e) {
                    loggerHolder.getLogger().error(e);
                }
            }
        }
        
        this.config.apps = newConfig.apps;
        this.config.clients = newConfig.clients;
        for(let [appId, openApiSpec] of Object.entries(newConfig.openApiSpecs)){
            this.config.openApiSpecs[appId] = openApiSpec;
        }
        this._lastConfigUpdateTime = pullTime;
    
        loggerHolder.getLogger().log(new Date().toISOString(), 'API Gateway pulled API config');
        return;
    } else {
        return Promise.reject();
    }    
}.bind(apiConfigHolder);

module.exports.apiConfigHolder = apiConfigHolder;