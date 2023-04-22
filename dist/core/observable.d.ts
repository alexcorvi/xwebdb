type Observable<T extends object> = T & {
    [oMetaKey]: OMetaBase<T>;
};
type ChangeType = "insert" | "update" | "delete" | "reverse" | "shuffle";
type PrepareFunction<T extends object> = (source: T, oMeta: OMetaBase<T>, visited: Set<any>) => Observable<T>;
interface MetaProperties<T> {
    target: T;
    ownKey: symbol | number | string;
    parent: any | null;
    visited?: Set<any>;
}
interface Observer<T> {
    (changes: Change<T>[]): void;
}
export interface ObservableArray<A extends object> {
    observable: Observable<A>;
    observe: (observer: Observer<A>) => void;
    unobserve: (observers?: Observer<A> | Observer<A>[]) => void;
    silently: (work: (o: Observable<A>) => any) => void;
}
declare const oMetaKey: unique symbol;
declare class Change<T> {
    type: ChangeType;
    path: (string | number | symbol)[];
    value?: any;
    oldValue?: any;
    object: any;
    snapshot: T;
    constructor(type: ChangeType, path: (string | number | symbol)[], value: any | undefined, oldValue: any | undefined, object: T, snapshot: T);
}
declare class OMetaBase<T extends object> {
    parent: any;
    ownKey: string | number | symbol;
    observers: Observer<T>[];
    revocable: {
        proxy: Observable<T>;
        revoke: () => void;
    };
    proxy: Observable<T>;
    target: T;
    batches: [Observer<T>, Change<T>[]][];
    constructor(properties: MetaProperties<T>, cloningFunction: PrepareFunction<T>);
    detach(): T;
    set(target: T, key: number | string | symbol, value: any): boolean;
    deleteProperty(target: Observable<T>, key: string | symbol): boolean;
}
declare function observable<D, A extends D[]>(target: A | Observable<A>): ObservableArray<A>;
declare function isObservable<T>(input: T): boolean;
export { observable, isObservable, Change };
