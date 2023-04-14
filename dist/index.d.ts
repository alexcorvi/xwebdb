import { AvlTree, Node } from './core/avl2/avl2';
import { Database } from "./database";
import { BaseModel } from "./types/base-schema";
import { Persistence, PersistenceEvent } from "./core";
import { Cursor } from "./core";
import * as customUtils from "./core/customUtils";
import { Datastore } from "./core";
import { Index } from "./core";
import * as modelling from "./core/model";
declare const unify: {
    Database: typeof Database;
    BaseModel: typeof BaseModel;
    adapters: {
        kvAdapter: import("./core/adapters/type").remoteAdapter;
        memoryAdapter: import("./core/adapters/type").remoteAdapter;
        memoryStores: {
            [key: string]: {
                [key: string]: string;
            };
        };
    };
    Persistence: typeof Persistence;
    PersistenceEvent: typeof PersistenceEvent;
    _internal: {
        avl: {
            AvlTree: typeof AvlTree;
            Node: typeof Node;
        };
        Cursor: typeof Cursor;
        customUtils: typeof customUtils;
        Datastore: typeof Datastore;
        Index: typeof Index;
        modelling: typeof modelling;
    };
};
export default unify;
