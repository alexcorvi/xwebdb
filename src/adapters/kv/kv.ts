import { Q } from "../../core/q";
import { remoteAdapter, remoteStore, } from "../../core/adapters/type"

const savedNS: { [endpoint: string]: { [title: string]: string } } = {};

export const kvAdapter: remoteAdapter = (endpoint: string, token: string) => (name: string) =>
	new Namespace({ endpoint, token, name });

async function kvRequest(
	instance: Namespace,
	method: string = "GET",
	path: string = "",
	body?: string,
	parse: boolean = true
): Promise<
	| string
	| {
			success: boolean;
			result: { title: string; id: string }[] | { id: string };
			result_info: {
				page: number;
				total_pages: number;
			};
	  }
	| {
			success: boolean;
			result: { name: string }[];
			result_info: {
				count: number;
				cursor: string;
			};
	  }
> {
	return new Promise((resolve) => {
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", function () {
			if (this.readyState === 4) {
				if (parse === false) {
					return resolve(this.responseText);
				}
				try {
					let json = JSON.parse(this.responseText);
					resolve(json);
				} catch (e) {
					resolve(this.responseText);
				}
			}
		});
		xhr.open(
			method,
			(instance.endpoint + "/" + path)
				// removing double slashes
				.replace(/(https?:\/{2}.*)\/{2}/, "$1/")
				// removing trailing slashes
				.replace(/\/$/, "")
		);
		xhr.setRequestHeader("Authorization", `Bearer ${instance.token}`);
		xhr.setRequestHeader("Content-Type", `application/json`);
		xhr.send(body);
	});
}

class Namespace implements remoteStore {
	id: string = "";
	name: string;
	token: string;
	endpoint: string;
	constructor({
		name: name,
		token,
		endpoint,
	}: {
		name: string;
		token: string;
		endpoint: string;
	}) {
		this.name = name;
		this.token = token;
		this.endpoint = endpoint;
		this.connect();
	}
	// basically trying to get the ID of the namespace
	// from the array above or remotely
	// or creating a new namespace
	async connect() {
		if (!savedNS[this.endpoint]) {
			savedNS[this.endpoint] = {};
		}

		if (savedNS[this.endpoint][this.name]) {
			// found saved
			this.id = savedNS[this.endpoint][this.name];
			return;
		}

		const remoteNamespaces = await this.listStores();
		for (let index = 0; index < remoteNamespaces.length; index++) {
			const element = remoteNamespaces[index];
			savedNS[this.endpoint][element.name] = element.id;
		}
		if (savedNS[this.endpoint][this.name]) {
			// found remote
			this.id = savedNS[this.endpoint][this.name];
			return;
		}

		const id = await this.createStore(this.name);
		savedNS[this.endpoint][this.name] = id;
		this.id = id;
	}
	async listStores(): Promise<{ id: string; name: string }[]> {
		const namespaces: { id: string; name: string }[] = [];
		let currentPage = 1;
		let totalPages = 1;
		while (totalPages >= currentPage) {
			const res = await kvRequest(this, "GET", `?page=${currentPage}`);
			if (typeof res === "string" || !res.success || !Array.isArray(res.result)) {
				throw new Error(
					"XWebDB: Error while listing namespaces: " + JSON.stringify(res)
				);
			} else {
				const resNamespaces: { id: string; title: string }[] = (res as any).result;
				for (let index = 0; index < resNamespaces.length; index++) {
					const element = resNamespaces[index];
					namespaces.push({ id: element.id, name: element.title });
				}
				totalPages = (res as any).result_info.total_pages;
				currentPage++;
			}
		}
		return namespaces;
	}
	async createStore(title: string) {
		const res = await kvRequest(this, "POST", "", JSON.stringify({ title }));
		if (typeof res === "string" || !res.success || Array.isArray(res.result)) {
			throw new Error("XWebDB: Error while creating namespace: " + JSON.stringify(res));
		} else {
			return res.result.id;
		}
	}
	async clear() {
		if (!this.id) await this.connect();
		const res = await kvRequest(this, "DELETE", this.id);
		if (typeof res === "string" || !res.success) {
			throw new Error("XWebDB: Error while deleting namespace: " + JSON.stringify(res));
		} else {
			return true;
		}
	}
	async del(itemID: string) {
		if (!this.id) await this.connect();
		const res = await kvRequest(this, "DELETE", `${this.id}/values/${itemID}`);
		if (typeof res === "string" || !res.success) {
			throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
		} else {
			return true;
		}
	}
	async set(itemID: string, itemData: string) {
		if (!this.id) await this.connect();
		const res = await kvRequest(this, "PUT", `${this.id}/values/${itemID}`, itemData);
		if (typeof res === "string" || !res.success) {
			throw new Error("XWebDB: Error while setting item: " + JSON.stringify(res));
		} else {
			return true;
		}
	}
	async get(itemID: string): Promise<string> {
		if (!this.id) await this.connect();
		const res = await kvRequest(
			this,
			"GET",
			`${this.id}/values/${itemID}`,
			undefined,
			false
		);
		if (typeof res !== "string") {
			throw new Error("XWebDB: Error while getting item: " + JSON.stringify(res));
		} else {
			return res;
		}
	}
	async keys(): Promise<string[]> {
		if (!this.id) await this.connect();
		let keys: string[] = [];
		let cursor = "";
		do {
			const res = await kvRequest(
				this,
				"GET",
				`${this.id}/keys${cursor ? `?cursor=${cursor}` : ""}`
			);
			if (typeof res === "string" || !res.success || !Array.isArray(res.result)) {
				throw new Error("XWebDB: Error while listing keys: " + JSON.stringify(res));
			} else {
				const arr: any[] = res.result;
				for (let index = 0; index < arr.length; index++) {
					const element: { name: string } = arr[index];
					keys.push(element.name);
				}
				cursor = (res.result_info as any).cursor;
			}
		} while (cursor);
		return keys;
	}
	async delBulk(items: string[]) {
		if (!this.id) await this.connect();
		// deal with 10,000 limit
		const dividedItems = items.reduce<(typeof items)[]>((arr, item, index) => {
			const sub = Math.floor(index / 9999);
			if (!arr[sub]) arr[sub] = [];
			arr[sub].push(item);
			return arr;
		}, []);
		let results: boolean[] = [];
		for (let index = 0; index < dividedItems.length; index++) {
			const batch = dividedItems[index];
			const res = await kvRequest(
				this,
				"DELETE",
				`${this.id}/bulk`,
				JSON.stringify(batch)
			);
			if (typeof res === "string" || !res.success) {
				throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
			} else {
				results.push(true);
			}
		}
		return results;
	}
	async setBulk(couples: [string, string][]) {
		// deal with 10,000 limit
		if (!this.id) await this.connect();

		const dividedItems = couples.reduce<(typeof couples)[]>((arr, item, index) => {
			const sub = Math.floor(index / 9999);
			if (!arr[sub]) arr[sub] = [];
			arr[sub].push(item);
			return arr;
		}, []);
		let results: boolean[] = [];

		for (let index = 0; index < dividedItems.length; index++) {
			const batch = dividedItems[index];
			const res = await kvRequest(
				this,
				"PUT",
				`${this.id}/bulk`,
				JSON.stringify(batch.map((x) => ({ key: x[0], value: x[1] })))
			);
			if (typeof res === "string" || !res.success) {
				throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
			} else {
				results.push(true);
			}
		}

		return results;
	}
	async getBulk(keys: string[]) {
		if (keys.length === 0) return [];
		// Cloudflare, sadly, still doesn't bulk gets!
		// so we're just looping through the given keys
		// to make things slightly better:
		// we're setting a max concurrent connection using Q
		const q = new Q(20);
		const valuesPromises: Promise<string>[] = [];
		for (let index = 0; index < keys.length; index++) {
			const key = keys[index];
			valuesPromises.push(q.add(() => this.get(key)));
		}
		const values = await Promise.all(valuesPromises);
		const result: string[] = [];
		for (let index = 0; index < keys.length; index++) {
			let value = values[index];
			result.push(value);
		}
		return result;
	}
}
