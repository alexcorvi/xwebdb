import {
	Persistence,
	PersistenceEvent,
	Cursor,
	Q,
	customUtils,
	Datastore,
	Index,
	modelling,
	adapters,
	observable,
} from "./core";
import { Database } from "./database";
import { Doc, SubDoc, mapSubModel } from "./types/base-schema";

const _internal = {
	observable,
	Cursor,
	customUtils,
	Datastore,
	Index,
	modelling,
	Q,
	Persistence,
	PersistenceEvent,
};

export { Database, Doc, SubDoc, mapSubModel, adapters, _internal };
