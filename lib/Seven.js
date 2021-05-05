"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prelude = exports.SevenMachineInstrType = exports.SevenMachine = exports.SevenExpr = exports.SevenReactiveVariable = void 0;
var SevenReactiveVariable = /** @class */ (function () {
    function SevenReactiveVariable(initValue) {
        this._currentValue = initValue;
        this._subscribers = [];
    }
    Object.defineProperty(SevenReactiveVariable.prototype, "value", {
        get: function () { return this._currentValue; },
        set: function (newValue) { this._currentValue = newValue; },
        enumerable: false,
        configurable: true
    });
    SevenReactiveVariable.prototype.subscribe = function (subscriber) {
        var _this = this;
        return {
            unsubscribe: function () {
                var index = _this._subscribers.indexOf(subscriber);
                if (index !== -1) {
                    _this._subscribers.splice(index, 1);
                }
            }
        };
    };
    return SevenReactiveVariable;
}());
exports.SevenReactiveVariable = SevenReactiveVariable;
var SevenExpr = /** @class */ (function () {
    function SevenExpr(_, args) {
        this._ = _;
        this.args = args;
    }
    return SevenExpr;
}());
exports.SevenExpr = SevenExpr;
var SevenMachine = /** @class */ (function () {
    function SevenMachine(initProgram, options) {
        var _this = this;
        this._componentDict = {};
        this._componentListCache = [];
        this._componentListDirtyFlag = false;
        this._externFunctionMap = {};
        this._reactiveVariableMap = {};
        this._staticVariableMap = {};
        this._position = 0;
        this._machineContinuationStack = [];
        // NOTE: store the position one plus *after* the CALL instr.
        this._callStack = [];
        this._trace = [];
        this._lock = false;
        this._stepRequested = false;
        this._program = initProgram || [];
        this._options = options;
        [Prelude.BasicMath, Prelude.BasicBitwise, Prelude.BasicConditon, Prelude.BasicPrimitive].forEach(function (v) {
            v.forEach(function (v) { return _this.registerExternFunction(v); });
        });
    }
    SevenMachine.prototype.getComponentByName = function (name) {
        return this._componentDict[name];
    };
    Object.defineProperty(SevenMachine.prototype, "currentComponent", {
        get: function () {
            if (!this._componentListDirtyFlag) {
                return this._componentListCache;
            }
            else {
                var res = [];
                for (var key in this._componentDict) {
                    if (Object.prototype.hasOwnProperty.call(this._componentDict, key)) {
                        var element = this._componentDict[key];
                        res.push(element);
                    }
                }
                this._componentListCache = res;
                this._componentListDirtyFlag = false;
                return res;
            }
        },
        enumerable: false,
        configurable: true
    });
    SevenMachine.prototype.registerComponent = function (component) {
        this._componentDict[component.name] = component;
        this._componentListDirtyFlag = true;
        return this;
    };
    SevenMachine.prototype.registerExternFunction = function (externFunction) {
        this._externFunctionMap[externFunction.name] = externFunction;
        return this;
    };
    SevenMachine.prototype.getReactiveVariableByName = function (name) {
        return this._reactiveVariableMap[name];
    };
    Object.defineProperty(SevenMachine.prototype, "reactiveVariableMap", {
        get: function () {
            return this._reactiveVariableMap;
        },
        enumerable: false,
        configurable: true
    });
    SevenMachine.prototype.getStaticVariableValueByName = function (name) {
        return this._staticVariableMap[name];
    };
    Object.defineProperty(SevenMachine.prototype, "staticVariableMap", {
        get: function () {
            return this._staticVariableMap;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SevenMachine.prototype, "currentProgram", {
        get: function () {
            return this._program;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SevenMachine.prototype, "currentPosition", {
        get: function () {
            return this._position;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SevenMachine.prototype, "currentInstr", {
        get: function () {
            return this._program[this._position];
        },
        enumerable: false,
        configurable: true
    });
    SevenMachine.prototype.loadProgram = function (program) {
        this._program = program;
        this._position = 0;
    };
    SevenMachine.prototype.jsEval = function (source) {
        return eval("(function(Seven){return (" + source + ")})(\n            {   $:this.reactiveVariableMap,\n                $$:this.staticVariableMap,\n            })");
    };
    SevenMachine.prototype.eval = function (source) {
        console.log(source);
        console.log(source instanceof SevenExpr);
        if (source instanceof SevenExpr) {
            return this._externFunctionMap[source._].call(this, source.args);
        }
        else {
            return source;
        }
    };
    Object.defineProperty(SevenMachine.prototype, "halted", {
        get: function () {
            return !!this._program[this._position];
        },
        enumerable: false,
        configurable: true
    });
    SevenMachine.prototype.lock = function () { this._lock = true; };
    SevenMachine.prototype.unlock = function () {
        this._lock = false;
        if (this._stepRequested) {
            this._stepRequested = false;
            this.step();
        }
    };
    Object.defineProperty(SevenMachine.prototype, "locked", {
        get: function () { return this._lock; },
        enumerable: false,
        configurable: true
    });
    SevenMachine.prototype.step = function (singleStep) {
        var _a;
        if (singleStep === void 0) { singleStep = false; }
        // NOTE: `+1` means the current program.
        fullStepProcess: while (this._machineContinuationStack.length + 1 > 0) {
            var instr = this.currentInstr;
            if (!instr) {
                // NOTE: if no more continuation we should leave.
                if (this._machineContinuationStack.length <= 0) {
                    break;
                }
                var continuation = this._machineContinuationStack.pop();
                this._program = continuation.program;
                this._position = continuation.position;
                continue;
            }
            var keepStepping = true;
            do {
                if (this._lock) {
                    this._stepRequested = true;
                    return;
                }
                switch (instr._) {
                    case SevenMachineInstrType.SET_REACTIVE_VAR: {
                        this._reactiveVariableMap[instr.name].value = (instr.eval ? this.jsEval : this.eval)(instr.value);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.SET_STATIC_VAR: {
                        this._staticVariableMap[instr.name] = (instr.eval ? this.jsEval : this.eval)(instr.value);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.GOTO: {
                        this._position = instr.target;
                        break;
                    }
                    case SevenMachineInstrType.COND_GOTO: {
                        this._position = (instr.eval ? this.jsEval : this.eval)(instr.condition);
                        break;
                    }
                    case SevenMachineInstrType.CALL: {
                        this._callStack.push(this._position = instr.target);
                        break;
                    }
                    case SevenMachineInstrType.CALL_COMPONENT: {
                        var component = this.getComponentByName(instr.name);
                        if (!component) {
                            throw new Error("SevenMachine: no component named " + instr.name + " registered for this machine.");
                        }
                        keepStepping = !!component.call(this, instr.args);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.RETURN: {
                        if (this._callStack.length <= 0) {
                            throw new Error("SevenMachine: cannot return because there's no call.");
                        }
                        this._position = this._callStack.pop();
                        break;
                    }
                }
                if ((_a = this._options) === null || _a === void 0 ? void 0 : _a.traceEnabled) {
                    this._trace.push(instr);
                }
                if (!(instr = this.currentInstr)) {
                    break;
                }
                if (singleStep) {
                    break fullStepProcess;
                }
                if (!keepStepping) {
                    break fullStepProcess;
                }
            } while (keepStepping);
        }
    };
    SevenMachine.prototype.run = function () {
        while (!this.halted) {
            this.step();
        }
    };
    // NOTE: we have to do some kind of "continuation stack" if we want to support
    // running sub-program (e.g. switching between different scenes.)
    SevenMachine.prototype._pushCurrentContinuation = function () {
        this._machineContinuationStack.push({ program: this._program, position: this._position });
    };
    SevenMachine.prototype.loadSubProgram = function (subProgram) {
        this._pushCurrentContinuation();
        this.loadProgram(subProgram);
    };
    return SevenMachine;
}());
exports.SevenMachine = SevenMachine;
var SevenMachineInstrType;
(function (SevenMachineInstrType) {
    SevenMachineInstrType[SevenMachineInstrType["SET_STATIC_VAR"] = 1] = "SET_STATIC_VAR";
    SevenMachineInstrType[SevenMachineInstrType["SET_REACTIVE_VAR"] = 2] = "SET_REACTIVE_VAR";
    SevenMachineInstrType[SevenMachineInstrType["GOTO"] = 3] = "GOTO";
    SevenMachineInstrType[SevenMachineInstrType["COND_GOTO"] = 4] = "COND_GOTO";
    SevenMachineInstrType[SevenMachineInstrType["CALL"] = 5] = "CALL";
    SevenMachineInstrType[SevenMachineInstrType["RETURN"] = 6] = "RETURN";
    SevenMachineInstrType[SevenMachineInstrType["CALL_COMPONENT"] = 7] = "CALL_COMPONENT";
})(SevenMachineInstrType = exports.SevenMachineInstrType || (exports.SevenMachineInstrType = {}));
var Prelude;
(function (Prelude) {
    Prelude.BasicMath = [
        { name: '+', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a + b; }); } },
        { name: '-', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a - b; }); } },
        { name: '*', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a * b; }); } },
        { name: '/', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a / b; }); } },
        { name: '%', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a % b; }); } },
        { name: 'ABS', call: function (m, args) { return Math.abs(args[0]); } },
    ];
    Prelude.BasicBitwise = [
        { name: '&', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a & b; }); } },
        { name: '|', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a | b; }); } },
        { name: '^', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a ^ b; }); } },
    ];
    Prelude.BasicConditon = [
        { name: '<', call: function (m, args) { return m.eval(args[0]) < m.eval(args[1]); } },
        { name: '>', call: function (m, args) { return m.eval(args[0]) > m.eval(args[1]); } },
        { name: '<=', call: function (m, args) { return m.eval(args[0]) <= m.eval(args[1]); } },
        { name: '>=', call: function (m, args) { return m.eval(args[0]) >= m.eval(args[1]); } },
        { name: '==', call: function (m, args) { return m.eval(args[0]) == m.eval(args[1]); } },
        { name: '!=', call: function (m, args) { return m.eval(args[0]) != m.eval(args[1]); } },
        { name: 'and', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a && b; }); } },
        { name: 'or', call: function (m, args) { return args.map(function (v) { return m.eval(v); }).reduce(function (a, b) { return a || b; }); } },
        { name: 'not', call: function (m, args) { return !m.eval(args[0]); } },
    ];
    Prelude.BasicPrimitive = [
        { name: '#VAR', call: function (m, args) { return m.getStaticVariableValueByName(args[0]); } },
        { name: '$VAR', call: function (m, args) { var _a; return (_a = m.getReactiveVariableByName(args[0])) === null || _a === void 0 ? void 0 : _a.value; } },
        { name: '.', call: function (m, args) {
                var x = m.eval(args[0]);
                for (var i = 1; i < args.length; i++) {
                    x = x[m.eval(args[i])];
                }
                return x;
            } }
    ];
})(Prelude = exports.Prelude || (exports.Prelude = {}));
