export type remoteAdapter = (endpoint: string, token: string) => (name: string) => remoteStore;

export interface remoteStore {
	name: string;
	removeStore: () => Promise<boolean>;
	removeItem: (id: string) => Promise<boolean>;
	setItem: (id: string, value: string) => Promise<boolean>;
	getItem: (id: string) => Promise<string>;
	removeItems: (ids: string[])=> Promise<boolean[]>;
	setItems: (items: {key: string, value: string}[])=> Promise<boolean[]>;
	getItems: (ids: string[])=> Promise<{key: string, value: string}[]>;
	keys: () => Promise<string[]>;
}
