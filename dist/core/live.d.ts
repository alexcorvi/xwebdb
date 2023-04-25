import { Database } from "../database";
import { Doc, Filter, SchemaKeyProjection, SchemaKeySort } from "../types";
import { ObservableArray, Change } from "./observable";
interface LiveQuery<S extends Doc> {
    database: Database<S>;
    queryFilter: Filter<S>;
    queryOptions: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<S>;
        project?: SchemaKeyProjection<S>;
    };
    observable: ObservableArray<Array<S>>;
    toDBObserver: (changes: Change<S[]>[]) => void;
    id?: string;
}
export declare function addLive<S extends Doc>(q: LiveQuery<S>): string;
export declare function liveUpdate(): Promise<void>;
export declare function kill(uid: string): void;
export {};
