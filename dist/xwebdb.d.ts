import { Persistence, Cursor, Q, customUtils, Datastore, Index, modelling, observable, Dictionary, Cache, remoteStore, kvAdapter } from "./core";
import { Database } from "./database";
import { ObservableArray } from './core/observable';
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
};
export { Database, Doc, SubDoc, mapSubModel, kvAdapter, _internal, remoteStore, ObservableArray };
