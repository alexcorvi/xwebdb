# XWebDB
_pronounced: Cross Web Database_

<p align="center">
	<img src="https://i.postimg.cc/0yp2LmPJ/exchange-databases.png" width="100">
	<br>
	<br>
</p>

> Work in progress, unstable api, still not usable, check issues & Todo list below for more info.

### What is this?
- A database for the browser
- Offline first, syncs when online
- Fast & lightweight (below 50K hopefully)
- Strongly-typed (very)
- Mongodb-like api (a subset, almost identical query language)
- Persistent (indexeddb + cloud, when online)
- Reactive (can be used as a state-manager for react/angular/svelte/vue ...etc)
- Designed for serverless applications

### Comparision with other databases
#### PouchDB
||Common Features|XWebDB Features|
| ------------ | ------------ | ------------ |
|1|   |   |
|2|   |   |

#### Dexie.js
#### Localforage
#### LokiJs
#### RxDB

### Current progress
- [x] AVLTree & Indexing
- [x] Modelling system
- [x] Query API
- [x] Persistence
- [x] Strong-typing
- [ ] Replication/sync system
	- [x] Basic functional sync functionality
	- [x] Cloudflare KV Adapter
	- [ ] CosmosDB Adapter
	- [ ] DynamoDB Adapter
	- [ ] Firestore Adapter
	- [ ] S3 Adapter (not advised)
	- [x] Memory adapter (for demo & tests)
	- [ ] Write tests
		- [x] Sync Integration
		- [x] Check sync function step (diff) on all tests
		- [ ] Sync Unit
		- [ ] All adapters
	- [x] Work with conflicts
	- [x] transaction log truncation (deleted? updated again?)
	- [x] idb operations in bulk for perf improvements
	- [x] devalidate $H ? `Math.floor(new Date() / (1000 * 60 * 20))`
	- [ ] force sync (regardless of ongoing/hash)
	- [ ] test devalidation
- [ ] Setup Sync demo
	- [ ] updating docs
- [ ] Split optional functionalities into modules (for the browser)
	- [ ] Adapters (each)
	- [ ] Synching
	- [ ] Reactive
- [ ] Performance
	- [ ] loops
	- [x] q
	- [ ] Deffer all IndexedDB interactions and do them in bulk (especially writes & deletes) 
- [ ] Reactive
	- [x] Make observable nested arrays possible 
		- [x] TESTING REQUIRED: write unit core tests for "observable"
	- [x] use live() to return an observable result that will be consumed by the application
		- [ ] TESTING REQUIRED: write integration tests for "live"
	- [x] UI frameworks state should update automagically once the database updates (if the update)
		- [ ] check comments at the end of observable file... seems to be working just needs more testing
	- [x] observe this result for changes from the UI framework side and reflect those changes onto the DB
		- [ ] since updates are in batch, merge multiple operations on the same document
		- [ ] TESTING REQUIRED: write integration tests for "live"
	- [x] observe changes in the database and reflect them onto the live query and hence the application
		- [ ] TESTING REQUIRED: write integration tests for "live"
	- [x] Ability to kill live query
- [x] Improve `Class Database` API
- [ ] Examples
- [ ] Benchmark
- [ ] Docs
- [ ] Landing page