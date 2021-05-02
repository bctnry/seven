export type Subscriber<A> = (newValue: A, oldValue?: A) => void;
export type Subscription = {unsubscribe: () => void};
export class SevenReactiveVariable<A> {
    private _currentValue: A|undefined;
    public get value(): A|undefined { return this._currentValue }
    public set value(newValue: A|undefined) { this._currentValue = newValue; }

    private _subscribers: Subscriber<A>[];

    constructor(initValue?: A) {
        this._currentValue = initValue;
        this._subscribers = [];
    }
    public subscribe(subscriber: Subscriber<A>): Subscription {
        return {
            unsubscribe: () => {
                let index = this._subscribers.indexOf(subscriber);
                if (index !== -1) {
                    this._subscribers.splice(index, 1);
                }
            }
        };
    }
}

export interface SevenComponent {
    name: string,
    call: (machine: SevenMachine, args: {[name: string]: any}) => boolean|void,
}
export class SevenExpr {
    constructor(public _: string, public args: any[]) {}
}
export interface SevenExternFunction {
    name: string,
    call: (machine: SevenMachine, args: any[]) => any
}
type _MachineContinuation = {
    program: SevenMachineProgram,
    position: number
}
export type SevenMachineInitOptions = {
    traceEnabled?: boolean,
}
export class SevenMachine {

    private _componentDict: {[key: string]: SevenComponent} = {};
    public getComponentByName(name: string): SevenComponent|undefined {
        return this._componentDict[name];
    }
    private _componentListCache: SevenComponent[] = [];
    private _componentListDirtyFlag: boolean = false;
    public get currentComponent(): SevenComponent[] {
        if (!this._componentListDirtyFlag) { return this._componentListCache; }
        else {
            let res = [];
            for (const key in this._componentDict) {
                if (Object.prototype.hasOwnProperty.call(this._componentDict, key)) {
                    const element = this._componentDict[key];
                    res.push(element);
                }
            }
            this._componentListCache = res;
            this._componentListDirtyFlag = false;
            return res;
        }
    }
    public registerComponent(component: SevenComponent) {
        this._componentDict[component.name] = component;
        this._componentListDirtyFlag = true;
    }

    private _externFunctionMap: {[key: string]: SevenExternFunction} = {};
    public registerExternFunction(externFunction: SevenExternFunction) {
        this._externFunctionMap[externFunction.name] = externFunction;
    }
    
    private _reactiveVariableMap: {[varName: string]: SevenReactiveVariable<any>} = {};
    public getReactiveVariableByName(name: string): SevenReactiveVariable<any>|undefined {
        return this._reactiveVariableMap[name];
    }
    public get reactiveVariableMap(): {[varName: string]: SevenReactiveVariable<any>} {
        return this._reactiveVariableMap;
    }

    private _staticVariableMap: {[varName: string]: any} = {};
    public getStaticVariableValueByName(name: string): any {
        return this._staticVariableMap[name];
    }
    public get staticVariableMap(): {[varName: string]: any} {
        return this._staticVariableMap;
    }

    private _program: SevenMachineProgram;
    public get currentProgram(): SevenMachineProgram {
        return this._program;
    }
    private _position: number = 0;
    public get currentPosition(): number {
        return this._position;
    }
    public get currentInstr(): SevenMachineInstr|undefined {
        return this._program[this._position];
    }
    public loadProgram(program: SevenMachineProgram) {
        this._program = program;
        this._position = 0;
    }
    public jsEval(source: string): any {
        return eval(`(function(Seven){return (${source})})(
            {   $:this.reactiveVariableMap,
                $$:this.staticVariableMap,
            })`);
    }
    public eval(source: SevenExpr|any): any {
        console.log(source);
        console.log(source instanceof SevenExpr);
        if (source instanceof SevenExpr) {
            return this._externFunctionMap[source._].call(this, source.args);
        } else {
            return source;
        }
    }
    public get halted(): boolean {
        return !!this._program[this._position];
    }
    private _machineContinuationStack: _MachineContinuation[] = [];
    // NOTE: store the position one plus *after* the CALL instr.
    private _callStack: number[] = [];
    private _trace: SevenMachineInstr[] = [];
    private _lock: boolean = false;
    public lock() { this._lock = true; }
    public unlock() { this._lock = false; }
    public get locked() { return this._lock; }

    public step(singleStep: boolean = false) {
        if (this._lock) { return; }
        // NOTE: `+1` means the current program.
        fullStepProcess: while (this._machineContinuationStack.length + 1 > 0) {
            let instr = this.currentInstr;
            if (!instr) {
                // NOTE: if no more continuation we should leave.
                if (this._machineContinuationStack.length <= 0) { break; }
                let continuation = this._machineContinuationStack.pop();
                this._program = continuation!.program;
                this._position = continuation!.position;
                continue;
            }
            let keepStepping: boolean = true;
            do {
                switch (instr._) {
                    case SevenMachineInstrType.SET_REACTIVE_VAR: {
                        this._reactiveVariableMap[instr.name].value = (instr.eval?this.jsEval:this.eval)(instr.value as any);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.SET_STATIC_VAR: {
                        this._staticVariableMap[instr.name] = (instr.eval?this.jsEval:this.eval)(instr.value as any);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.GOTO: {
                        this._position = instr.target;
                        break;
                    }
                    case SevenMachineInstrType.COND_GOTO: {
                        this._position = (instr.eval?this.jsEval:this.eval)(instr.condition as any);
                        break;
                    }
                    case SevenMachineInstrType.CALL: {
                        this._callStack.push(this._position = instr.target);
                        break;
                    }
                    case SevenMachineInstrType.CALL_COMPONENT: {
                        let component = this.getComponentByName(instr.name);
                        if (!component) { throw new Error(`SevenMachine: no component named ${instr.name} registered for this machine.`); }
                        keepStepping = !!component.call(this, instr.args);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.RETURN: {
                        if (this._callStack.length <= 0) { throw new Error(`SevenMachine: cannot return because there's no call.`); }
                        this._position = this._callStack.pop() as number;
                        break;
                    }
                }
                if (this._options?.traceEnabled) { this._trace.push(instr); }
                if (!(instr = this.currentInstr)) { break; }
                if (singleStep) { break fullStepProcess; }
                if (!keepStepping) { break fullStepProcess; }
            } while (keepStepping);
        }
    }
    public run() {
        while (!this.halted) { this.step(); }
    }

    // NOTE: we have to do some kind of "continuation stack" if we want to support
    // running sub-program (e.g. switching between different scenes.)
    private _pushCurrentContinuation() {
        this._machineContinuationStack.push({program: this._program, position: this._position});
    }

    public loadSubProgram(subProgram: SevenMachineProgram) {
        this._pushCurrentContinuation();
        this.loadProgram(subProgram);
    }

    private _options: SevenMachineInitOptions|undefined;
    constructor(initProgram?: SevenMachineProgram, options?: SevenMachineInitOptions) {
        this._program = initProgram||[];
        this._options = options;
        [Prelude.BasicMath, Prelude.BasicBitwise, Prelude.BasicConditon, Prelude.BasicPrimitive].forEach((v) => {
            v.forEach((v) => this.registerExternFunction(v));
        });
    }
}

export type SevenMachineProgram = SevenMachineInstr[];
export enum SevenMachineInstrType {
    SET_STATIC_VAR = 1,
    SET_REACTIVE_VAR = 2,
    GOTO = 3,
    COND_GOTO = 4,
    CALL = 5,
    RETURN = 6,
    CALL_COMPONENT = 7,
}
export type SevenMachineInstr
    = {_:SevenMachineInstrType.SET_STATIC_VAR, name:string, value: any|string, eval?: boolean}
    | {_:SevenMachineInstrType.SET_REACTIVE_VAR, name:string, value: any|string, eval?: boolean}
    | {_:SevenMachineInstrType.GOTO, target:number}
    | {_:SevenMachineInstrType.COND_GOTO, target:number, condition: any|string, eval?: boolean}
    | {_:SevenMachineInstrType.CALL, target:number}
    | {_:SevenMachineInstrType.RETURN}
    | {_:SevenMachineInstrType.CALL_COMPONENT,
        name: string, args: {[name: string]: any}}

export namespace Prelude {
    export const BasicMath: SevenExternFunction[] = [
        {name: '+', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a + b) },
        {name: '-', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a - b) },
        {name: '*', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a * b) },
        {name: '/', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a / b) },
        {name: '%', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a % b) },
        {name: 'ABS', call: (m, args) => Math.abs(args[0]) },
    ];
    export const BasicBitwise: SevenExternFunction[] = [
        {name: '&', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a & b) },
        {name: '|', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a | b) },
        {name: '^', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a ^ b) },
    ];
    export const BasicConditon: SevenExternFunction[] = [
        {name: '<', call: (m, args) => m.eval(args[0]) < m.eval(args[1]) },
        {name: '>', call: (m, args) => m.eval(args[0]) > m.eval(args[1]) },
        {name: '<=', call: (m, args) => m.eval(args[0]) <= m.eval(args[1]) },
        {name: '>=', call: (m, args) => m.eval(args[0]) >= m.eval(args[1]) },
        {name: '==', call: (m, args) => m.eval(args[0]) == m.eval(args[1]) },
        {name: '!=', call: (m, args) => m.eval(args[0]) != m.eval(args[1]) },
        {name: 'and', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a && b) },
        {name: 'or', call: (m, args) => args.map((v) => m.eval(v)).reduce((a, b) => a || b) },
        {name: 'not', call: (m, args) => !m.eval(args[0])},
    ];
    export const BasicPrimitive: SevenExternFunction[] = [
        {name: '#VAR', call: (m, args) => m.getStaticVariableValueByName(args[0])},
        {name: '$VAR', call: (m, args) => m.getReactiveVariableByName(args[0])?.value},
        {name: '.', call: (m, args) => {
            let x = m.eval(args[0]);
            for (let i = 1; i < args.length; i++) {
                x = x[m.eval(args[i])];
            }
            return x;
        }}
    ];
}
