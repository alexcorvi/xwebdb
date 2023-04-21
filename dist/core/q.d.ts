export declare class Q {
    private _queue;
    private _pause;
    private _ongoingCount;
    private readonly _concurrency;
    constructor(concurrency?: number);
    pause(): void;
    start(): void;
    add<T>(fn: () => Promise<T>): Promise<T>;
    get waitingCount(): number;
    get ongoingCount(): 0;
    private _resolveEmpty;
    private _next;
}
