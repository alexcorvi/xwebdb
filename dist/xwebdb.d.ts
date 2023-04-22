import { AvlTree, Node, Persistence, PersistenceEvent, Cursor, Q, customUtils, Datastore, Index, modelling, adapters, observable } from "./core";
import { Database } from "./database";
import { BaseModel } from "./types/base-schema";
declare const _internal: {
    avl: {
        AvlTree: typeof AvlTree;
        Node: typeof Node;
    };
    observable: typeof observable;
    Cursor: typeof Cursor;
    customUtils: typeof customUtils;
    Datastore: typeof Datastore;
    Index: typeof Index;
    modelling: typeof modelling;
    Q: typeof Q;
    Persistence: typeof Persistence;
    PersistenceEvent: typeof PersistenceEvent;
};
export { Database, BaseModel, adapters, _internal };
