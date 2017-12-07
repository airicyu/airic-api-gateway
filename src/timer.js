'use strict';

function getTimer(name) {
    let timer = {
        _name: name,
        _startTime: null,
        _endTime: null,
        _status: null,
        start: null,
        stop: null,
        getDuration: null,
        getName: null,
        getInfo: null,
        getInfoString: null
    };

    timer.start = function () {
        this._startTime = process.hrtime();
        this._status = 'started';
        return this;
    }.bind(timer);

    timer.stop = function () {
        this._endTime = process.hrtime(this._startTime);
        this._status = 'stoped';
        return this;
    }.bind(timer);

    timer.getDuration = function () {
        if (this._status === 'started') {
            let tempTime = process.hrtime(this._startTime);
            return tempTime[0] * 1000 + tempTime[1] / 1000 / 1000;
        } if (this._status === 'stoped') {
            return this._endTime[0] * 1000 + this._endTime[1] / 1000 / 1000;
        } else {
            return -1;
        }
    }.bind(timer);

    timer.getInfo = function () {
        let duration = this.getDuration();
        return { name: this._name, duration};
    }.bind(timer);

    timer.getInfoString = function () {
        let duration = this.getDuration();
        return JSON.stringify({ name: this._name, duration});
    }.bind(timer);

    return timer;
}

module.exports.getTimer = getTimer;