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
    call: (machine: SevenMachine, args: {[name: string]: any}) => boolean,
}
export class SevenExpr {
    constructor(public type: string, values: {[key: string]: any}) {
        this.type = type;
        for (const k in values) {
            if (values.hasOwnProperty(k)) {
                const v = values[k];
                (this as any)[k] = v;
            }
        }
    }
}
export interface SevenExternFunction {
    name: string,
    call: (machine: SevenMachine, args: any[]) => any
}
type _MachineContinuation = {
    program: SevenMachineProgram,
    position: number
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

    private _externFunctionDict: {[key: string]: SevenExternFunction} = {};
    public registerExternFunction(externFunction: SevenExternFunction) {
        this._externFunctionDict[externFunction.name] = externFunction;
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
    public eval(source: string): any {
        return eval(`(function(__MACHINE){return ${source}})(this._expose())`);
    }
    public get halted(): boolean {
        return !!this._program[this._position];
    }
    private _machineContinuationStack: _MachineContinuation[] = [];
    // NOTE: store the position one plus *after* the CALL instr.
    private _callStack: number[] = [];
    public step() {
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
                        this._reactiveVariableMap[instr.name].value = instr.eval? this.eval(instr.value as string) : instr.value;
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.SET_STATIC_VAR: {
                        this._staticVariableMap[instr.name] = instr.eval? this.eval(instr.value as string) : instr.value;
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.GOTO: {
                        this._position = instr.target;
                        break;
                    }
                    case SevenMachineInstrType.COND_GOTO: {
                        this._position = instr.eval? this.eval(instr.condition) : instr.condition;
                        break;
                    }
                    case SevenMachineInstrType.CALL: {
                        this._callStack.push(this._position = instr.target);
                        break;
                    }
                    case SevenMachineInstrType.CALL_COMPONENT: {
                        let component = this.getComponentByName(instr.name);
                        if (!component) { throw new Error(`SevenMachine: no component named ${instr.name} registered for this machine.`); }
                        keepStepping = component.call(this, instr.args);
                        this._position++;
                        break;
                    }
                    case SevenMachineInstrType.RETURN: {
                        if (this._callStack.length <= 0) { throw new Error(`SevenMachine: cannot return because there's no call.`); }
                        this._position = this._callStack.pop() as number;
                        break;
                    }
                }
                if (!(instr = this.currentInstr)) { break; }
                if (!keepStepping) { break fullStepProcess; }
            } while (keepStepping);
        }
    }
    public run() {
        while (!this.halted) { this.step(); }
    }

    // NOTE: we need some kind of separation so that components cannot fully control
    // the running of the machine; components can use the machine to run subprograms,
    // but can only control the stepping by returning a boolean value in its call method.
    // when `true` is returned, the machine will take one more step after the component call.
    // this is to allow "background" component to stay invisible to the end-user.
    // NOTE: we have to do some kind of "continuation stack" if we want to support
    // running sub-program (e.g. switching between different scenes.)
    private _pushCurrentContinuation() {
        this._machineContinuationStack.push({program: this._program, position: this._position});
    }
    private _expose(): ISevenMachineInComponent {
        return {
            reactiveVariableMap: this.reactiveVariableMap,
            staticVariableMap: this.staticVariableMap,
            runProgram: (program: SevenMachineProgram) => {
                this._pushCurrentContinuation();
                this.loadProgram(program);
            }
        };
    }

    constructor(initProgram?: SevenMachineProgram) {
        this._program = initProgram||[];
    }
}

export type ISevenMachineInComponent = {
    reactiveVariableMap: {[varName: string]: SevenReactiveVariable<any>},
    staticVariableMap: {[varName: string]: any},
    runProgram: (program: SevenMachineProgram) => void
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
