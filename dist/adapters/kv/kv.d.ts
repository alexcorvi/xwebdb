type remoteAdapter = (endpoint: string, token: string) => (name: string) => remoteStore;

interface remoteStore {
	name: string;
	clear: () => Promise<boolean>;
	del: (key: string) => Promise<boolean>;
	set: (key: string, value: string) => Promise<boolean>;
	get: (key: string) => Promise<string>;
	delBulk: (keys: string[]) => Promise<boolean[]>;
	setBulk: (couples: [string, string][]) => Promise<boolean[]>;
	getBulk: (keys: string[]) => Promise<(string | undefined)[]>;
	keys: () => Promise<string[]>;
}
export declare const kvAdapter: remoteAdapter;
