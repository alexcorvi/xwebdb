/**
 * Updates the observable array (i.e. live query)
 * when a database change occurs, only if the query would give a different result
 * It basically achieves that by having an array of all the live queries taken from the database
 * Then on every update (insert/update/delete ... check datastore.ts) it checks the old result
 * and updates the observable array (live query result) if they're not the same
*/
import { Doc, Filter } from "../types";
import { Datastore } from "./datastore";
import { ObservableArray, Change } from "./observable";
interface LiveQuery<S extends Doc> {
    query: Filter<S>;
    observable: ObservableArray<Array<S>>;
    toDBObserver: (changes: Change<S[]>[]) => void;
    id?: string;
}
export declare class Live {
    private db;
    private queries;
    constructor(db: Datastore<any, any>);
    addLive<S extends Doc>(q: LiveQuery<S>): string;
    update(): Promise<void>;
    kill(uid: string): void;
}
export {};
