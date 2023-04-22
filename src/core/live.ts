import { Database } from "../database";
import {
	BaseModel,
	Filter,
	NFP,
	SchemaKeyProjection,
	SchemaKeySort,
} from "../types";
import { xxh, uid } from "./customUtils";
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
	hash?: number;
	id?: string;
}

const liveQueries: LiveQuery<any>[] = [];

function hash<T extends { _id: string }>(res: T[]) {
	return xxh(JSON.stringify(res));
}

export function addLive<S extends BaseModel>(q: LiveQuery<S>) {
	q.id = uid();
	q.hash = hash(q.observable.observable);
	liveQueries.push(q);
	return q.id;
}

export async function liveUpdate(): Promise<void> {
	for (let index = 0; index < liveQueries.length; index++) {
		const q = liveQueries[index];
		const newRes = await q.database.read(q.queryFilter, q.queryOptions);
		const newHash = hash(newRes);
		if (newHash === q.hash) continue;
		q.observable.unobserve(q.toDBObserver);
		q.observable.observable.splice(0);
		q.observable.observable.push(...newRes);
		q.observable.observe(q.toDBObserver);
		q.hash = newHash;
	}
}

export function kill(uid: string) {
	const index = liveQueries.findIndex((q) => q.id === uid);
	if (index > -1) {
		liveQueries.splice(index, 1);
	}
}
