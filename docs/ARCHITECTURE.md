# Architecture

## API

``` typescript
// reactive variable.
// 大致上相当于rxjs的observable。
export declare type Subscriber<A> = (newValue: A, oldValue?: A) => void;
export declare type Subscription = {
    unsubscribe: () => void;
};
export declare class SevenReactiveVariable<A> {
    get value(): A | undefined;
    set value(newValue: A | undefined);
    constructor(initValue?: A); 
    subscribe(subscriber: Subscriber<A>): Subscription;
}

// component.
// component大致上类似于syscall，本身并不跟实际的控件相关。
// 在component的call里返回true可以让机器在执行这个component后继续执行
// 这样可以这样做一些隐式的操作，例如代码级别的埋点。
// 注意：不返回true不能阻挡别的地方执行machine.step()。例如，假如某个component的
// 执行需要等待某个http请求返回的结果，单纯不返回true是无法防止别的控件让机器继续
// 运行。如果需要完全防止机器运行，需要在返回之前使用machine.lock()，并在完成需要
// 等待的操作后machine.unlock()；如果同时需要让机器自动执行，则需要同时手动执行
// machine.step()。
export interface SevenComponent {
    name: string;
    call: (machine: SevenMachine, args: {
        [name: string]: any;
    }) => boolean|void;
}

// expression
// 一般而言，expression用于跟变量有关的场合，例如判断某个flag是否设立/大小是否
// 达到阈值。expression有两种指定方式：SevenExpr对象和用于被eval的字符串。在对应
// 的指令中，使用eval这个字段表示是否直接eval。
// eval用的字符串中，可以使用：
//     $ 获得机器的reactiveVariableMap
//     $$ 获得机器的staticVariableMap
// 理论上来说，expression在eval的时候不应背允许能够操作机器本身，一般情况下也不会
// 有这么做的必要。
export declare class SevenExpr {
    type: string;
    constructor(type: string, values: {
        [key: string]: any;
    });
}
export interface SevenExternFunction {
    name: string;
    call: (machine: SevenMachine, args: any[]) => any;
}

export declare class SevenMachine {
    getComponentByName(name: string): SevenComponent | undefined;
    get currentComponent(): SevenComponent[];
    registerComponent(component: SevenComponent): void;
    
    registerExternFunction(externFunction: SevenExternFunction): void;
    getReactiveVariableByName(name: string): SevenReactiveVariable<any> | undefined;
    get reactiveVariableMap(): {
        [varName: string]: SevenReactiveVariable<any>;
    };
    getStaticVariableValueByName(name: string): any;
    get staticVariableMap(): {
        [varName: string]: any;
    };
    
    get currentProgram(): SevenMachineProgram;
    get currentPosition(): number;
    get currentInstr(): SevenMachineInstr | undefined;

    loadProgram(program: SevenMachineProgram): void;
    jsEval(source: string): any;
    eval(source: SevenExpr | any): any;

    // 当前机器是否已经停机
    get halted(): boolean;

    lock(): void;
    unlock(): void;
    get locked(): boolean;
    // NOTE: step()会一直执行到第一个不返回false的component；如果需要真正的
    // 单步执行，用step(true)。
    step(): void;
    run(): void;

    // 用于在component内执行子程序。e.g. 在某个"container" component内。
    public loadSubProgram(subProgram: SevenMachineProgram);

    constructor(initProgram?: SevenMachineProgram);
}

// 机器指令定义。
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

// prelude.
// 基本的内置函数。
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
```


## Usage

e.g.:

``` typescript
import * as Seven from "@bctnry/seven";
import { DialogComponent, PhraseComponent, NarratorComponent } from "./Components";

export const Machine = new Seven.SevenMachine()
    .registerComponent(DialogComponent)
    .registerComponent(PhraseComponent)
    .registerComponent(NarratorComponent);

```

something like this.
