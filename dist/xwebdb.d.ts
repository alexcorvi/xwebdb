import { Persistence, Cursor, Q, customUtils, Datastore, Index, modelling, observable, Dictionary, Cache, remoteStore, remoteAdapter, Aggregate } from "./core";
import { Database } from "./database";
import { ObservableArray } from "./core/observable";
import { Doc, SubDoc, mapSubModel } from "./types/base-schema";
declare const _internal: {
    observable: typeof observable;
    Cursor: typeof Cursor;
    customUtils: typeof customUtils;
    Datastore: typeof Datastore;
    Index: typeof Index;
    modelling: typeof modelling;
    Q: typeof Q;
    Persistence: typeof Persistence;
    Dictionary: typeof Dictionary;
    Cache: typeof Cache;
    Aggregate: typeof Aggregate;
};
export { Database, Doc, SubDoc, mapSubModel, _internal, remoteStore, remoteAdapter, ObservableArray, };
