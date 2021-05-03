export declare type Subscriber<A> = (newValue: A, oldValue?: A) => void;
export declare type Subscription = {
    unsubscribe: () => void;
};
export declare class SevenReactiveVariable<A> {
    private _currentValue;
    get value(): A | undefined;
    set value(newValue: A | undefined);
    private _subscribers;
    constructor(initValue?: A);
    subscribe(subscriber: Subscriber<A>): Subscription;
}
export interface SevenComponent {
    name: string;
    call: (machine: SevenMachine, args: {
        [name: string]: any;
    }) => boolean | void;
}
export declare class SevenExpr {
    _: string;
    args: any[];
    constructor(_: string, args: any[]);
}
export interface SevenExternFunction {
    name: string;
    call: (machine: SevenMachine, args: any[]) => any;
}
export declare type SevenMachineInitOptions = {
    traceEnabled?: boolean;
};
export declare class SevenMachine {
    private _componentDict;
    getComponentByName(name: string): SevenComponent | undefined;
    private _componentListCache;
    private _componentListDirtyFlag;
    get currentComponent(): SevenComponent[];
    registerComponent(component: SevenComponent): void;
    private _externFunctionMap;
    registerExternFunction(externFunction: SevenExternFunction): void;
    private _reactiveVariableMap;
    getReactiveVariableByName(name: string): SevenReactiveVariable<any> | undefined;
    get reactiveVariableMap(): {
        [varName: string]: SevenReactiveVariable<any>;
    };
    private _staticVariableMap;
    getStaticVariableValueByName(name: string): any;
    get staticVariableMap(): {
        [varName: string]: any;
    };
    private _program;
    get currentProgram(): SevenMachineProgram;
    private _position;
    get currentPosition(): number;
    get currentInstr(): SevenMachineInstr | undefined;
    loadProgram(program: SevenMachineProgram): void;
    jsEval(source: string): any;
    eval(source: SevenExpr | any): any;
    get halted(): boolean;
    private _machineContinuationStack;
    private _callStack;
    private _trace;
    private _lock;
    lock(): void;
    unlock(): void;
    get locked(): boolean;
    step(singleStep?: boolean): void;
    run(): void;
    private _pushCurrentContinuation;
    loadSubProgram(subProgram: SevenMachineProgram): void;
    private _options;
    constructor(initProgram?: SevenMachineProgram, options?: SevenMachineInitOptions);
}
export declare type SevenMachineProgram = SevenMachineInstr[];
export declare enum SevenMachineInstrType {
    SET_STATIC_VAR = 1,
    SET_REACTIVE_VAR = 2,
    GOTO = 3,
    COND_GOTO = 4,
    CALL = 5,
    RETURN = 6,
    CALL_COMPONENT = 7
}
export declare type SevenMachineInstr = {
    _: SevenMachineInstrType.SET_STATIC_VAR;
    name: string;
    value: any | string;
    eval?: boolean;
} | {
    _: SevenMachineInstrType.SET_REACTIVE_VAR;
    name: string;
    value: any | string;
    eval?: boolean;
} | {
    _: SevenMachineInstrType.GOTO;
    target: number;
} | {
    _: SevenMachineInstrType.COND_GOTO;
    target: number;
    condition: any | string;
    eval?: boolean;
} | {
    _: SevenMachineInstrType.CALL;
    target: number;
} | {
    _: SevenMachineInstrType.RETURN;
} | {
    _: SevenMachineInstrType.CALL_COMPONENT;
    name: string;
    args: {
        [name: string]: any;
    };
};
export declare namespace Prelude {
    const BasicMath: SevenExternFunction[];
    const BasicBitwise: SevenExternFunction[];
    const BasicConditon: SevenExternFunction[];
    const BasicPrimitive: SevenExternFunction[];
}
//# sourceMappingURL=Seven.d.ts.map