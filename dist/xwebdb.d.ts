import { Persistence, Cursor, Q, customUtils, Datastore, Index, modelling, adapters, observable, Dictionary } from "./core";
import { Database } from "./database";
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
};
export { Database, Doc, SubDoc, mapSubModel, adapters, _internal };
