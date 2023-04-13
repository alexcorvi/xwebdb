import { memoryStores } from './core/adapters/memory';
import { Database, DatabaseConfigurations } from "./database";
import { BaseModel } from "./types/base-schema";
import { Persistence, PersistenceEvent } from "./core";
import {AVLTree, BST, Node, defaultCheckValueEquality, defaultCompareKeysFunction, isDef} from "./core/avl";
import { Cursor } from "./core";
import * as customUtils from "./core/customUtils";
import { Datastore } from "./core";
import {Index} from "./core"
import * as modelling from "./core/model"
import {kvAdapter, memoryAdapter} from "./core/adapters";

const unify = {
    Database,
    BaseModel,
    adapters: {
        kvAdapter, memoryAdapter, memoryStores
    },
    Persistence,
    PersistenceEvent,
    _internal: {
        avl: {
            AVLTree,
            BST,
            Node,
            defaultCompareKeysFunction,
            defaultCheckValueEquality,
            isDef
        },
        Cursor,
        customUtils,
        Datastore,
        Index,
        modelling
    }
};

export default unify;