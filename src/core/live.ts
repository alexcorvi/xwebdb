import { Database } from "../database";
import { BaseModel, Filter, NFP, SchemaKeyProjection, SchemaKeySort } from "../types";
import { xxh } from "./customUtils";
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
    observable: ObservableArray<Array<S>>
	toDBObserver: (changes: Change<S[]> []) => void;
	hash?: number;
}

const liveQueries: LiveQuery<any>[] = [];

function hash<T extends { _id: string }>(res: T[]) {
	return xxh(JSON.stringify(res));
}

// adds a live query
export function addLive<S extends BaseModel>(q: LiveQuery<S>) {
	q.hash = hash(q.observable.observable);
	liveQueries.push(q);
}

// checks live queries and updates data if necassary
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
