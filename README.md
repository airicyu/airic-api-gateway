# airic-api-gateway

[![npm version](https://img.shields.io/npm/v/airic-api-gateway.svg)](https://www.npmjs.com/package/airic-api-gateway)
[![node](https://img.shields.io/node/v/airic-api-gateway.svg)](https://www.npmjs.com/package/airic-api-gateway)
[![Codecov branch](https://img.shields.io/codecov/c/github/airicyu/airic-api-gateway/master.svg)](https://codecov.io/gh/airicyu/airic-api-gateway)
[![Build](https://travis-ci.org/airicyu/airic-api-gateway.svg?branch=master)](https://travis-ci.org/airicyu/airic-api-gateway)

[![dependencies Status](https://david-dm.org/airicyu/airic-api-gateway/status.svg)](https://david-dm.org/airicyu/airic-api-gateway)
[![devDependencies Status](https://david-dm.org/airicyu/airic-api-gateway/dev-status.svg)](https://david-dm.org/airicyu/airic-api-gateway?type=dev)

## Description

airic-api-gateway module is the core gateway component of airic-api-gateway.

------------------------

## Samples

### Hello world

Starting server:

```javascript
'use strict';
const YAML = require('yamljs');
const { apiGateway } = require('airic-api-gateway');
apiGateway.run();
```

------------------------

## Gateway Config YAML

Sample:
```yaml
gateway-node-id: DEFAULT
port: 3000
workspace-id: 6ba955dde3044b6687af7b4d05a64920
pull-api-config-interval-second: 60
config-server-base-url: http://localhost:3001
gateway-permission-token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImZpbmdlcnByaW50IjoiZmI6OWM6Yzc6NzQ6NjQ6Y2I6YzM6Mzk6ZWM6MTg6ZmQ6Njk6OTk6ZTk6YWY6MjYifQ.eyJ0b2tlbi10eXBlIjoiaWRlbnRpdHkiLCJzdWItdHlwZSI6IndvcmtzcGFjZSIsInN1YiI6IjZiYTk1NWRkZTMwNDRiNjY4N2FmN2I0ZDA1YTY0OTIwIiwidmVyIjoiMSIsInN0YXRlIjpudWxsLCJpYXQiOjE1MTAyNDM4NTV9.c0uR3XpF6f69PK9avsN6FXKTcDx09T93wxJGfKwROte5S22v0LQEv_xGoFJnsyq542cjClKFNPVmq-LXopinIby7R3qNTexbBymSuguD1BZmzdpP6E4Kx7O_T0YZhbbihA5TLB395wkrQ-x-KnKs8nN2mMWzYPGo5S9d5_GoI7qOHS73wL7p8jogQb78oVFLDOkH8BghZn2RG2caoSO_HB1EX4QFoHwiPIZUJFc4Yui7dTluEA4xQ3pRAZUQWNHB1Q-Ome5PIvlWjLHT-nL7-FVUPTiCIdgKDwORLfPvRuK2dqzmdpAzU-5XBn6T3QxMDHY60uEiN1jnH03WI8rvbA
api-key-validation-endpoint-url: http://localhost:3002/keys/api-keys/verification
gateway-timeout: 30000
enable-stat: true
stat-bucket-type: 1m
sync-api-stat-max-records: 1000
sync-api-stat-interval-second: 60
sync-api-stat-uri: http://localhost:3005/stat
key-cache-max-second: 60
```