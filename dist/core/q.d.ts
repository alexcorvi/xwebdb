/**
 * A task queue that makes sure that methods are run sequentially
 * It's used on all inserts/deletes/updates of the database.
 * it also has the following advantages:
 *		A. ability to set concurrency
 *			(used on remote sync adapters to limit concurrent API calls)
 *		B. ability to pause and resume operations
 *			(used when loading database from persistence layer)
 *
 * Methods and API are self-explanatory
 */
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
