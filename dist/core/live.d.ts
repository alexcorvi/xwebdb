import { Database } from "../database";
import { BaseModel, Filter, NFP, SchemaKeyProjection, SchemaKeySort } from "../types";
import { ObservableArray, Change } from "./observable";
interface LiveQuery<S extends BaseModel> {
    database: Database<S>;
    queryFilter: Filter<NFP<S>>;
    queryOptions: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<NFP<S>>;
        project?: SchemaKeyProjection<NFP<S>>;
    };
    observable: ObservableArray<Array<S>>;
    toDBObserver: (changes: Change<S[]>[]) => void;
    id?: string;
}
export declare function addLive<S extends BaseModel>(q: LiveQuery<S>): string;
export declare function liveUpdate(): Promise<void>;
export declare function kill(uid: string): void;
export {};
