# XWebDB
_pronounced: Cross Web Database_

> Documentation work in progess

### What is this?

<table>
	<tr>
		<td width="50%" align="center">
				<img src="https://i.postimg.cc/SKshV92T/4e3061c9-e108-4239-b3df-32360b88cff6.jpg" width="200">
				<br>
	A browser-based NoSQL database backed and persisted by IndexedDB.
		</td>
		<td align="center">
				<img src="https://i.postimg.cc/26dNS7P5/f35b457a-1760-4f59-868e-e3a8a2cdb735.jpg" width="200">
				<br>
	Tailored for serverless applications, offline-first, seamlessly syncing when connected.
		</td>
	</tr>
</table>
<table>
	<tr>
		<td width="50%" align="center">
				<img src="https://i.postimg.cc/SsbH31gK/67f98983-bbd1-421f-82b5-109573544dc7.jpg" width="200">
				<br>
	Exceptionally fast, outperforming other databases with similar features in terms of performance.
		</td>
		<td align="center">
				<img src="https://i.postimg.cc/K8nPQ93f/6720d792-94d2-4047-b6ee-1918c92365bf.jpg" width="200">
				<br>
	Lightweight, below 50K (minified and gzipped)
		</td>
	</tr>
</table>
<table>
	<tr>
		<td width="50%" align="center">
				<img src="https://i.postimg.cc/xdn7nxwp/a010cbc1-ed9d-4b50-8c75-bd14bdbaa30d.jpg" width="200">
				<br>
				Mongo-like (MQL) query language (a subset, almost identical)
		</td>
		<td align="center">
				<img src="https://i.postimg.cc/J025Wb66/cdc1cd27-c609-430b-b726-8aaa43a6fa59.jpg" width="200">
				<br>
	Strongly-typed query language. Leveraging typescript for a very strict queries even on deep fields
		</td>
	</tr>
</table>
<table>
	<tr>
		<td width="50%" align="center">
				<img src="https://i.postimg.cc/rz6drrcs/31e9df31-b757-40e3-87dc-3e4ba3080276.jpg" width="200">
				<br>
				Live queries (reactive queries) are supported, i.e. can be used directly as a state-manager for react/angular/svelte/vue …etc.
		</td>
		<td align="center">
				<img src="https://i.postimg.cc/CMmyvgfP/9a4d131e-d642-4aad-afad-d2d41359f437.jpg" width="200">
				<br>
	Built-in object modelling, query caching, data encoding and a lot more.
		</td>
	</tr>
</table>

### Comparision with other databases

|Feature		|LocalForage|PouchDB		|Dexie.js	|XWebDB			|
|-				|			|				|			|				|
|Size			|29KB		|142KB			|80KB		|48KB			|
|Performance^	|good		|good			|good		|fastest		|
|Query Language	|Key/value	|Map/Reduce		|Mongo-like	|Mongo-like		|
|Sync			|no sync	|CouchDB sync	|Paid/Server|Serverless services (free)|
|Live Queries	|unsupported|unsupported	|Supported	|supported		|

### A Word on Performance
[Benchmark](https://alexcorvi.github.io/xwebdb/_benchmark/index.html)
XWebDB has a pretty good performance. It has the fastest insert, bulk-insert, update, delete, and read times even with large databases.

<p align="center">
	<img src="https://i.postimg.cc/G26JVwr9/image.png" width="450px">
	<br>
	<br>
</p>

It's backed by a simple, yet efficient [caching mechanism](https://github.com/alexcorvi/xwebdb/blob/master/src/core/cache.ts), and a [custom data structure](https://github.com/alexcorvi/xwebdb/blob/master/src/core/dictionary.ts) (similar to sorted dictionary in C#) that has been designed to perform well on various data types and sizes.

However, it is important to note that achieving such high-performance results requires maintaining a complete copy of the database in memory. While this approach may seem unconventional, it poses no significant issues for the intended use cases of this database, particularly given today's standards. The memory footprint for storing 10,000 2KB documents is nearly 20MB, which is considered manageable.

#### Data Complexity
- Get `O(1)`
- Insert `O(log n)`
- Delete `O(log n)`

----

#### A word of caution
While XWebDB may appear to be a promising choice for your next project compared to other databases, it is essential to carefully weigh your decision. Other solutions have undergone rigorous testing, have been battle-tested, and enjoy robust support from larger communities. This is not to discourage you from using XWebDB; in fact, I am currently using it in multiple projects myself. However, it's important to acknowledge that XWebDB is a relatively new project. With time, it is expected to mature and improve. I hope that in the future, this cautionary section can be removed from the documentation. Until then, it is advisable to thoroughly consider your options before making a final decision.

## Quick start

### Installation
Install using npm
```
npm install xwebdb
```
You can also include the pre-built and minified file:
```html
<script src="https://unpkg.com/xwebdb/dist/xwebdb.min.js"></script>
```

### Database Creation & Configuration

```typescript
import {Database} from "xwebdb";
let db = new Database({
	// ref is the only required property of the configuration
	ref: 'mydatabase1'
});
```
The above example serves as a basic starting point, refer to [Configuration section below](#Configuration) for more elaborate example.

### Object Mapping

```typescript
import {Database, Doc} from "xwebdb";

class Person extends Doc {
	firstName: string = '';
	lastName: string = '';
	get fullName() {
		return this.firstName + " " + this.lastName
	}
}

let db = new Database<Person>({
    ref: 'mydatabase1',
	model: Person
});
```

### Operations
```typescript
// creating
db.insert(Person.new({firstName: "Ali"}))
// finding
db.find({ firstName: "Ali" })
// using operators
db.find({ firstName: { $eq: "Ali" } })
// updating
db.update({{ firstName: "Ali" }}, {$set: { firstName: "Dina" }})
// deleting
db.delete({ firstName: { $eq: "Ali" } })
```
### Live Queries
```typescript
let res1 = await db.live({ firstName: "Ali" });
let res2 = await db.live({ firstName: "Ali" });
let res3 = await db.find({ firstName: "Ali" })
res1[0].firstName = 'Mario';
```
The last line of the above example updates the database in addition to `res1`. So it is equivalent to:
```
db.update({firstName: 'Ali'},{$set: firstName: 'Mario'})
```
Also, `res2` will have an updated value (automatically), but `res3` will have the old value since it has been called with `find` instead of `live`.

----
# Deep Dive
## Configuration
## Object Mapping
The advantages of defining a model:
- It will be considered as a schema for strict typing.
- `_id` field will be added automatically.
- You can set getters in the class and use them when querying.
- You can set default values for properties.
- Properties with default values will be stripped on persistence so your documents will take less size and send less data when syncing.
## Query API & Operators
## Update API & Operators
## Synchronization
## Live Queries & Frontend Frameworks
Live queries features enable you to query a set of documents as an observable array. Meaning, that the query value will change once the database has been updated and any modification you do on the query result will also be reflected on the database. Think of it like a two-way data-binding but for databases.
## Deeply nested documents
## Best Practices
## Benchmarks


### Current progress
- [x] Split database options into fields
- [x] indexing as an option on creation
- [x] AVLTree & Indexing
	- [ ] test sorted dictionary
- [x] Modelling system
- [x] Query API
- [x] Persistence
- [x] Strong-typing
- [ ] Sync Adapters
	- [x] Memory (for testing)
	- [x] Cloudflare KV Adapter
	- [ ] CosmosDB Adapter
	- [ ] DynamoDB Adapter
	- [ ] Firestore Adapter
	- [ ] S3 Adapter (not advised)
- [x] Replication/sync system
	- [ ] Get all keys might be too expensive?
	- [x] Basic functional sync functionality
	- [x] Memory adapter (for demo & tests)
	- [x] Write tests
		- [x] Sync Integration
		- [x] Check sync function step (diff) on all tests
	- [x] Work with conflicts
	- [x] transaction log truncation (deleted? updated again?)
	- [x] idb operations in bulk for perf improvements
	- [x] invalidate $H ? `Math.floor(new Date() / (1000 * 60 * 20))`
	- [x] force sync (regardless of ongoing/hash)
	- [x] test devalidation
- [ ] Setup Sync demo
- [ ] Split optional functionalities into modules
	- [ ] Extensibility (hooks?)
	- [ ] Adapters (each)
	- [ ] Syncing
	- [ ] e2e data encryption
	- [ ] Reactive
- [ ] Performance
	- [ ] loops <<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>
	- [x] q
	- [ ] $ deep?
	- [x] Defer all IndexedDB interactions and do them in bulk (especially writes & deletes)
		- [x] test
	- [ ] Compare with other DBs
	- [x] AVL Tree
- [x] Reactive
	- [x] Make observable nested arrays possible 
		- [x] TESTING REQUIRED: write unit core tests for "observable"
	- [x] use live() to return an observable result that will be consumed by the application
		- [x] TESTING REQUIRED: write integration tests for "live"
	- [x] UI frameworks state should update automatically once the database updates (if the update)
	- [x] observe this result for changes from the UI framework side and reflect those changes onto the DB
		- [x] since updates are in batch, merge multiple operations on the same document
		- [x] TESTING REQUIRED: write integration tests for "live"
	- [x] observe changes in the database and reflect them onto the live query and hence the application
		- [x] TESTING REQUIRED: write integration tests for "live"
	- [x] Ability to kill live query
- [x] Improve `Class Database` API
- [x] Strip defaults before persisting
	- [x] Test (include date objects in the test)
- [x] Test modelling (and submodelling) integration
- [ ] Implement more mongodb operators
- [x] Strong-typing of $deep and deeply nested
- [ ] Code review of all old code base
	- [ ] cursor.ts
	- [ ] datastore.ts
	- [ ] indexes.ts
- [ ] Implement pure dot notation (other than $deep)
- [ ] Examples
- [ ] Benchmark
- [ ] Docs
- [ ] Landing page


Reactive queries with UI frameworks:
TODO: react classes
// ========================
// Vue: https://codesandbox.io/s/heuristic-hamilton-w7nu1m?file=/src/components/HelloWorld.vue
// Still not reactive...
// ========================
// Angular: https://codesandbox.io/s/billowing-dream-872me1?file=/src/app/app.component.ts
// ========================
// REACT: https://codesandbox.io/s/busy-liskov-rbxlhm?file=/src/App.js
// ========================