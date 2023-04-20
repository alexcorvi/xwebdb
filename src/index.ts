import { AvlTree, Node } from './core/avl';
import { Database } from "./database";
import { BaseModel } from "./types/base-schema";
import { Persistence, PersistenceEvent } from "./core";
import { Cursor, Q } from "./core";
import * as customUtils from "./core/customUtils";
import { Datastore } from "./core";
import {Index} from "./core"
import * as modelling from "./core/model"
import {kvAdapter} from "./core/adapters";

const xwebdb = {
    Database,
    BaseModel,
    adapters: {
        kvAdapter
    },
    Persistence,
    PersistenceEvent,
    _internal: {
        avl: {AvlTree, Node},
        Cursor,
        customUtils,
        Datastore,
        Index,
        modelling,
        Q
    }
};

export default xwebdb;