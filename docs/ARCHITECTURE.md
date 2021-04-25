# Architecture

## API

``` typescript

type Subscriber<A> = (newValue: A, oldValue?: A) => void;
class SevenReactiveVariable<A> {
    public get currentValue: A|undefined;
    public subscribe(subscriber: Subscriber): void;
}

class SevenMachine {
    get currentComponent: SevenComponent[];
    get currentProgram: SevenMachineProgram;
    get currentPosition: string;
    get currentInstr: SevenMachineInstr;

    get reactiveVariableMap: {[varName: string]: SevenReactiveVariable<any>},
    get staticVariableMap: {[varName: string]: any},

    constructor(initProgram?: SevenMachineProgram) {}
    public registerComponent(component: SevenComponent);
    public loadProgram(program: SevenMachineProgram);

    public step() {}
    public run() {}
    public eval() {}
}

type SevenMachineProgram = SevenMachineInstr[];
enum SevenMachineInstrType {
    SET_STATIC_VAR = 1,
    SET_REACTIVE_VAR = 2,
    GOTO = 3,
    COND_GOTO = 4,
    CALL = 5,
    RETURN = 6,
    CALL_COMPONENT = 7,
}
type SevenMachineInstr
    = {_:SevenMachineInstrType.SET_STATIC_VAR, name:string, }
    | {_:SevenMachineInstrType.SET_REACTIVE_VAR, name:string, }
    | {_:SevenMachineInstrType.GOTO, id:number}
    | {_:SevenMachineInstrType.COND_GOTO, id:number, }
    | {_:SevenMachineInstrType.CALL, id:number}
    | {_:SevenMachineInstrType.RETURN}
    | {_:SevenMachineInstrType.CALL_COMPONENT,
        name: string, args: {[name: string]: any}}
```


## Usage

``` typescript
import * as Seven from "@larkproject/seven";
import { DialogComponent, PhraseComponent, NarratorComponent } from "@larkproject/skier";

export const Machine = new Seven.SevenMachine()
    .registerComponent(DialogComponent)
    .registerComponent(PhraseComponent)
    .registerComponent(NarratorComponent);

```
