# UnifyDB

> Work in progress, unstable api, still not usable, check issues & Todo list below for more info.

<p align="center">
	<img src="https://i.postimg.cc/0yp2LmPJ/exchange-databases.png" width="100">
	<br>
	<br>
</p>


### What is this?
- A database for the browser
- Offline first, syncs when online
- Fast & lightweight (below 50K hopefully)
- Strongly-typed (very)
- Mongodb-like api (a subset, almost identical query language)
- Persistent (indexeddb + cloud, when online)
- Reactive (can be used as a state-manager for react/angular/svelte/vue ...etc)
- Designed for serverless applications

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
		- [ ] Sync Integration
		- [ ] Check sync function step (diff) on all tests
		- [ ] Sync Unit
		- [ ] KV Adapter
	- [X] Work with conflicts
	- [ ] transaction log truncation (deleted? updated again?)
	- [ ] idb operations in bulk for perf improvements
	- [ ] devalidate $H ? `Math.floor(new Date() / (1000 * 60 * 20))`
- [ ] Setup Sync demo
	- [ ] updating docs
- [ ] Split optional functionalities into modules (for the browser)
	- [ ] Adapters (each)
	- [ ] Synching
	- [ ] Reactive
- [ ] zero-dependecy
	- [x] q
- [ ] Performance
	- [ ] loops
	- [x] q
- [ ] Reactive
- [ ] Improve `Class Database` API
- [ ] Examples
- [ ] Benchmark
- [ ] Docs