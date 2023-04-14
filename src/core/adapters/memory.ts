import { remoteAdapter, remoteStore } from "./type";

export const memoryStores: {
	[key: string]: {
		[key: string]: string;
	};
} = {};

export const memoryAdapter: remoteAdapter = () => (name: string) => {
	name = name.replace(/_\d(_\w+)$/, "$1"); // replacer is to make the sync demo work
	if(!memoryStores[name]) memoryStores[name] = {};
	return new MemoryStore(name);
};

class MemoryStore implements remoteStore {
	name: string;
	constructor(name: string) {
		this.name = name;
	}
	async removeStore() {
		memoryStores[this.name] = {};
		return true;
	}
	async removeItem(itemID: string) {
		delete memoryStores[this.name][itemID];
		return true;
	}
	async removeItems(ids: string[]) {
		const results: boolean[] = [];
		for (let index = 0; index < ids.length; index++) {
			const element = ids[index];
			results.push(await this.removeItem(element));
		}
		return results;
	}
	async setItems(data: { key: string; value: string }[]) {
		const results: boolean[] = [];
		for (let index = 0; index < data.length; index++) {
			const element = data[index];
			results.push(await this.setItem(element.key, element.value));
		}
		return results;
	}
	async getItems(keys: string[]) {
		const results: { key: string; value: string }[] = [];
		for (let index = 0; index < keys.length; index++) {
			const key = keys[index];
			results.push({ key, value: await this.getItem(key) });
		}
		return results;
	}
	async setItem(itemID: string, itemData: string) {
		memoryStores[this.name][itemID] = itemData;
		return true;
	}
	async getItem(itemID: string): Promise<string> {
		return memoryStores[this.name][itemID];
	}
	async keys(): Promise<string[]> {
		return Object.keys(memoryStores[this.name]);
	}
}
