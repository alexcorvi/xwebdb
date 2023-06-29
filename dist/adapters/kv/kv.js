(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["xwebdb-kvadapter"] = {}));
})(this, (function (exports) { 'use strict';

    /**
     * A task queue that makes sure that methods are run sequentially
     * It's used on all inserts/deletes/updates of the database.
     * it also has the following advantages:
     *		A. ability to set concurrency
     *			(used on remote sync adapters to limit concurrent API calls)
     *		B. ability to pause and resume operations
     *			(used when loading database from persistence layer)
     *
     * Methods and API are self-explanatory
     */
    class Q {
        constructor(concurrency = 1) {
            this._queue = [];
            this._pause = false;
            this._ongoingCount = 0;
            this._concurrency = 1;
            this._resolveEmpty = () => Promise.resolve();
            this._concurrency = concurrency;
        }
        pause() {
            this._pause = true;
        }
        start() {
            this._pause = false;
            this._next();
        }
        add(fn) {
            return new Promise((resolve, reject) => {
                const run = async () => {
                    this._ongoingCount++;
                    try {
                        const val = await Promise.resolve().then(fn);
                        this._ongoingCount--;
                        this._next();
                        resolve(val);
                        return val;
                    }
                    catch (err) {
                        this._ongoingCount--;
                        this._next();
                        reject(err);
                        return null;
                    }
                };
                if (this._ongoingCount < this._concurrency && !this._pause) {
                    run();
                }
                else {
                    this._queue.push(run);
                }
            });
        }
        // Promises which are not ready yet to run in the queue.
        get waitingCount() {
            return this._queue.length;
        }
        // Promises which are running but not done.
        get ongoingCount() {
            return this._ongoingCount;
        }
        _next() {
            if (this._ongoingCount >= this._concurrency || this._pause) {
                return;
            }
            if (this._queue.length > 0) {
                const firstQueueTask = this._queue.shift();
                if (firstQueueTask) {
                    firstQueueTask();
                }
            }
            else {
                this._resolveEmpty();
            }
        }
    }

    const savedNS = {};
    const kvAdapter = (endpoint, token) => (name) => new Namespace({ endpoint, token, name });
    async function kvRequest(instance, method = "GET", path = "", body, parse = true) {
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
                    }
                    catch (e) {
                        resolve(this.responseText);
                    }
                }
            });
            xhr.open(method, (instance.endpoint + "/" + path)
                // removing double slashes
                .replace(/(https?:\/{2}.*)\/{2}/, "$1/")
                // removing trailing slashes
                .replace(/\/$/, ""));
            xhr.setRequestHeader("Authorization", `Bearer ${instance.token}`);
            xhr.setRequestHeader("Content-Type", `application/json`);
            xhr.send(body);
        });
    }
    class Namespace {
        constructor({ name: name, token, endpoint, }) {
            this.id = "";
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
        async listStores() {
            const namespaces = [];
            let currentPage = 1;
            let totalPages = 1;
            while (totalPages >= currentPage) {
                const res = await kvRequest(this, "GET", `?page=${currentPage}`);
                if (typeof res === "string" || !res.success || !Array.isArray(res.result)) {
                    throw new Error("XWebDB: Error while listing namespaces: " + JSON.stringify(res));
                }
                else {
                    const resNamespaces = res.result;
                    for (let index = 0; index < resNamespaces.length; index++) {
                        const element = resNamespaces[index];
                        namespaces.push({ id: element.id, name: element.title });
                    }
                    totalPages = res.result_info.total_pages;
                    currentPage++;
                }
            }
            return namespaces;
        }
        async createStore(title) {
            const res = await kvRequest(this, "POST", "", JSON.stringify({ title }));
            if (typeof res === "string" || !res.success || Array.isArray(res.result)) {
                throw new Error("XWebDB: Error while creating namespace: " + JSON.stringify(res));
            }
            else {
                return res.result.id;
            }
        }
        async clear() {
            if (!this.id)
                await this.connect();
            const res = await kvRequest(this, "DELETE", this.id);
            if (typeof res === "string" || !res.success) {
                throw new Error("XWebDB: Error while deleting namespace: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        }
        async del(itemID) {
            if (!this.id)
                await this.connect();
            const res = await kvRequest(this, "DELETE", `${this.id}/values/${itemID}`);
            if (typeof res === "string" || !res.success) {
                throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        }
        async set(itemID, itemData) {
            if (!this.id)
                await this.connect();
            const res = await kvRequest(this, "PUT", `${this.id}/values/${itemID}`, itemData);
            if (typeof res === "string" || !res.success) {
                throw new Error("XWebDB: Error while setting item: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        }
        async get(itemID) {
            if (!this.id)
                await this.connect();
            const res = await kvRequest(this, "GET", `${this.id}/values/${itemID}`, undefined, false);
            if (typeof res !== "string") {
                throw new Error("XWebDB: Error while getting item: " + JSON.stringify(res));
            }
            else {
                return res;
            }
        }
        async keys() {
            if (!this.id)
                await this.connect();
            let keys = [];
            let cursor = "";
            do {
                const res = await kvRequest(this, "GET", `${this.id}/keys${cursor ? `?cursor=${cursor}` : ""}`);
                if (typeof res === "string" || !res.success || !Array.isArray(res.result)) {
                    throw new Error("XWebDB: Error while listing keys: " + JSON.stringify(res));
                }
                else {
                    const arr = res.result;
                    for (let index = 0; index < arr.length; index++) {
                        const element = arr[index];
                        keys.push(element.name);
                    }
                    cursor = res.result_info.cursor;
                }
            } while (cursor);
            return keys;
        }
        async delBulk(items) {
            if (!this.id)
                await this.connect();
            // deal with 10,000 limit
            const dividedItems = items.reduce((arr, item, index) => {
                const sub = Math.floor(index / 9999);
                if (!arr[sub])
                    arr[sub] = [];
                arr[sub].push(item);
                return arr;
            }, []);
            let results = [];
            for (let index = 0; index < dividedItems.length; index++) {
                const batch = dividedItems[index];
                const res = await kvRequest(this, "DELETE", `${this.id}/bulk`, JSON.stringify(batch));
                if (typeof res === "string" || !res.success) {
                    throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
                }
                else {
                    results.push(true);
                }
            }
            return results;
        }
        async setBulk(couples) {
            // deal with 10,000 limit
            if (!this.id)
                await this.connect();
            const dividedItems = couples.reduce((arr, item, index) => {
                const sub = Math.floor(index / 9999);
                if (!arr[sub])
                    arr[sub] = [];
                arr[sub].push(item);
                return arr;
            }, []);
            let results = [];
            for (let index = 0; index < dividedItems.length; index++) {
                const batch = dividedItems[index];
                const res = await kvRequest(this, "PUT", `${this.id}/bulk`, JSON.stringify(batch.map((x) => ({ key: x[0], value: x[1] }))));
                if (typeof res === "string" || !res.success) {
                    throw new Error("XWebDB: Error while deleting item: " + JSON.stringify(res));
                }
                else {
                    results.push(true);
                }
            }
            return results;
        }
        async getBulk(keys) {
            if (keys.length === 0)
                return [];
            // Cloudflare, sadly, still doesn't bulk gets!
            // so we're just looping through the given keys
            // to make things slightly better:
            // we're setting a max concurrent connection using Q
            const q = new Q(20);
            const valuesPromises = [];
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                valuesPromises.push(q.add(() => this.get(key)));
            }
            const values = await Promise.all(valuesPromises);
            const result = [];
            for (let index = 0; index < keys.length; index++) {
                let value = values[index];
                result.push(value);
            }
            return result;
        }
    }

    exports.kvAdapter = kvAdapter;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
