import { Database } from "../database";
import {
	Doc,
	Filter,
	NFP,
	SchemaKeyProjection,
	SchemaKeySort,
} from "../types";
import { xxh, uid } from "./customUtils";
import { ObservableArray, Change } from "./observable";

interface LiveQuery<S extends Doc> {
	database: Database<S>;
	queryFilter: Filter<S>;
	queryOptions: {
		skip?: number;
		limit?: number;
		sort?: SchemaKeySort<S>;
		project?: SchemaKeyProjection<S>;
	};
	observable: ObservableArray<Array<S>>;
	toDBObserver: (changes: Change<S[]>[]) => void;
	id?: string;
}

const liveQueries: LiveQuery<any>[] = [];

function hash<T extends { _id: string }>(res: T[]) {
	return xxh(JSON.stringify(res));
}

export function addLive<S extends Doc>(q: LiveQuery<S>) {
	q.id = uid();
	liveQueries.push(q);
	return q.id;
}

export async function liveUpdate(): Promise<void> {
	for (let index = 0; index < liveQueries.length; index++) {
		const q = liveQueries[index];
		const newRes = await q.database.read(q.queryFilter, q.queryOptions);
		const newHash = hash(newRes);
		const oldHash = hash(q.observable.observable);
		if (newHash === oldHash) continue;
		let u = await q.observable.unobserve(q.toDBObserver);
		q.observable.observable.splice(0);
		q.observable.observable.push(...newRes);
		if (u.length) q.observable.observe(q.toDBObserver);
	}
}

export function kill(uid: string) {
	const index = liveQueries.findIndex((q) => q.id === uid);
	if (index > -1) {
		liveQueries.splice(index, 1);
	}
}
