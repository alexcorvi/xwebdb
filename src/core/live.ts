/**
 * Updates the observable array (i.e. live query)
 * when a database change occurs, only if the query would give a different result
 * It basically achieves that by having an array of all the live queries taken from the database
 * Then on every update (insert/update/delete ... check datastore.ts) it checks the old result
 * and updates the observable array (live query result) if they're not the same
*/

import {
	Doc,
	Filter,
} from "../types";
import { dHash, uid } from "./customUtils";
import { Datastore } from "./datastore";
import { ObservableArray, Change } from "./observable";

interface LiveQuery<S extends Doc> {
	query: Filter<S>;
	observable: ObservableArray<Array<S>>;
	toDBObserver: (changes: Change<S[]>[]) => void;
	id?: string;
}

function hash<T extends { _id: string }>(res: T[]) {
	return dHash(JSON.stringify(res));
}

export class Live {
	private db: Datastore<any, any>;
	private queries: LiveQuery<any>[] = [];
	constructor(db: Datastore<any, any>) {
		this.db = db;
	}
	public addLive<S extends Doc>(q: LiveQuery<S>) {
		q.id = uid();
		this.queries.push(q);
		return q.id;
	}
	public async update() {
		for (let index = 0; index < this.queries.length; index++) {
			const q = this.queries[index];
			const newRes = await this.db.find(q.query);
			const newHash = hash(newRes);
			const oldHash = hash(q.observable.observable);
			if (newHash === oldHash) continue;
			let u = await q.observable.unobserve(q.toDBObserver);
			q.observable.observable.splice(0);
			q.observable.observable.push(...newRes);
			if (u.length) q.observable.observe(q.toDBObserver);
		}
	}
	public kill(uid: string) {
		const index = this.queries.findIndex((q) => q.id === uid);
		if (index > -1) {
			this.queries.splice(index, 1);
		}
	}
}