import {UseStore, createStore, get, set, del, getMany, setMany, delMany, keys, values, clear} from "idb-keyval";
export class IDB {
	store: UseStore;
	constructor(ref: string) {
		this.store = createStore(ref, ref)
	}
	get(key: string) {
		return get<string>(key, this.store)
	}
	set(key: string, value: string) {
		return set(key, value, this.store)
	}
	del(key: string) {
		return del(key, this.store)
	}
	gets(keys: string[]) {
		return getMany<string>(keys, this.store)
	}
	sets(entries: [string, string][]) {
		return setMany(entries, this.store);
	}
	dels(keys: string[]) {
		return delMany(keys, this.store)
	}
	keys() {
		return keys(this.store)
	}
	values() {
		return values<string>(this.store);
	}
	clear() {
		return clear(this.store);
	}
	async length() {
		return (await this.keys()).length
	}
}