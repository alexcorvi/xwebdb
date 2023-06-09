import {
	Persistence,
	Cursor,
	Q,
	customUtils,
	Datastore,
	Index,
	modelling,
	observable,
	Dictionary,
	Cache,
	remoteStore,
	remoteAdapter,
	Aggregate,
} from "./core";
import { Database } from "./database";
import { ObservableArray } from "./core/observable";
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
	Dictionary,
	Cache,
	Aggregate,
};

export {
	Database,
	Doc,
	SubDoc,
	mapSubModel,
	_internal,
	remoteStore,
	remoteAdapter,
	ObservableArray,
};
