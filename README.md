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

|Feature |LocalForage|PouchDB |Dexie.js |XWebDB |
|- | | | | |
|Size |29KB |142KB |80KB |48KB |
|Performance^ |good |good |good |fastest |
|Query Language |Key/value |Map/Reduce |Mongo-like |Mongo-like |
|Sync |no sync |CouchDB sync |Paid/Server|Serverless services (free)|
|Live Queries |unsupported|unsupported |Supported |supported |

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

-   Get `O(1)`
-   Insert `O(log n)`
-   Delete `O(log n)`

---

#### A word of caution

While XWebDB may appear to be a promising choice for your next project compared to other databases, it is essential to carefully weigh your decision. Other solutions have undergone rigorous testing, have been battle-tested, and enjoy robust support from larger communities. This is not to discourage you from using XWebDB; in fact, I am currently using it in multiple projects myself. However, it's important to acknowledge that XWebDB is a relatively new project. With time, it is expected to mature and improve. I hope that in the future, this cautionary section can be removed from the documentation. Until then, it is advisable to thoroughly consider your options before making a final decision.

## Quick start

### Installation

Install using npm

```
npm install xwebdb
```

Alternatively, you can include the pre-built and minified file in your HTML:

```html
<script src="https://unpkg.com/xwebdb/dist/xwebdb.min.js"></script>
```

### Database Creation and Configuration

To create a database, you need to instantiate the Database class with a configuration object. The only required property is ref, which specifies the reference name of the database.

```typescript
import { Database } from "xwebdb";

// Database creation and configuration
let db = new Database({
	ref: "mydatabase1", // Specify the reference name for the database
});
```

For more advanced configurations, please refer to the [Configuration](#Configuration) section below.

### Object Mapping

You can define a document model by extending the Doc class and specifying its properties and methods. Here's an example using a Person class:

```typescript
import { Database, Doc } from "xwebdb";

// Define a document class
class Person extends Doc {
	firstName: string = ""; // Define a firstName property
	lastName: string = ""; // Define a lastName property

	get fullName() {
		return this.firstName + " " + this.lastName; // Define a computed property fullName
	}
}

// Create a database with the specified model
let db = new Database<Person>({
	ref: "mydatabase1",
	model: Person, // Specify the document model
});
```

### Operations

Once you have a database instance, you can perform various operations on it, such as creating, finding, updating, and deleting documents. Here are some examples:

```typescript
// Creating a document
db.insert(Person.new({ firstName: "Ali" }));
// Create a new document with firstName "Ali"

// Finding documents
db.find({ firstName: "Ali" });
// Find documents with firstName "Ali"

// Using operators in queries
db.find({ firstName: { $eq: "Ali" } });
// Find documents with firstName equal to "Ali"

// Updating documents
db.update({ firstName: "Ali" }, { $set: { firstName: "Dina" } });
// Update firstName from "Ali" to "Dina"

// Deleting documents
db.delete({ firstName: { $eq: "Ali" } });
// Delete documents with firstName "Ali"
```

### Live Queries

You can also perform live queries that automatically update when the underlying data in the database changes, and also changes the database when it updates. Here's an example:

```typescript
// Perform a live query
let res1 = await db.live({ firstName: "Ali" });
// Get live results for documents with firstName "Ali"
let res2 = await db.live({ firstName: "Ali" });
// Get live results for documents with firstName "Ali" (second query)
let res3 = await db.find({ firstName: "Ali" });
// Get regular non-live results for documents with firstName "Ali"

res1[0].firstName = "Mario";
// Update the firstName property

// The above line updates the database and 'res1'
// it is equivalent to:
// db.update({ firstName: 'Ali' }, { $set: { firstName: 'Mario' } });

// 'res2' will have the updated value automatically
// 'res3' will retain the old value
// since it was obtained using 'find' instead of 'live'
```

---

# Deep Dive

## Configuration

```typescript
import { Database, Doc } from "xwebdb";

// Model/Schema
class Person extends Doc {
	firstName: string = "";
	lastName: string = "";
	get fullName() {
		return this.firstName + " " + this.lastName;
	}
}

// Database Creation and Configuration
let db = new Database<Person>({
	ref: "mydatabase",
	// Define a reference to be used as a database name for IndexedDB
	model: Person,
	// Define model for object mapping
	timestampData: true,
	// Include "createdAt" and "updatedAt" fields in documents
	stripDefaults: true,
	// Remove default values from the IndexedDB and remote database
	corruptAlertThreshold: 0.2,
	// Set tolerance level for data corruption
	deferPersistence: 500,
	// Resolve promises before persisting operations to IndexedDB
	indexes: ["firstName"],
	// Define non-unique indexes
	cacheLimit: 1000,
	// Set cache limit to avoid overwhelming memory
	encode: (obj) => JSON.stringify(obj),
	// Implement encryption for data persistence
	decode: (str) => JSON.parse(str),
	// Implement decryption for data retrieval
});
```

###### `ref`:_`string`_ (Required, no default value)

-   The provided string will serve as the name for both the database and table in IndexedDB. Ensure uniqueness for each database to avoid data sharing and unexpected behavior.

###### `model`:`a class that extends Doc` (Defaults to Doc)

-   The model represents the schema and type declaration for your data. It should be a class that extends Doc. The properties of this model define the document's schema, and the values assigned to these properties act as defaults. Using the model ensures consistency and adherence to the schema when creating new documents.

```typescript
import { Doc } from "xwebdb";

class Person extends Doc {
	firstName: string = "default name";
	// Default value for 'firstName'
	age: number = 25;
	// Default value for 'age'
}

// Create a document using .new
Person.new({ firstName: "Ali" });
// The above returns a document
// with the default value for 'age'
// and "Ali" as the value for 'firstName'
```

-   Strong typing for querying and modification comes from the type declarations of this class.

###### `timestampData`:`boolean` (Defaults to false)

-   When set to true, the database automatically includes "createdAt" and "updatedAt" fields in documents with their respective values as Date objects.

###### `stripDefaults`:`boolean` (Defaults to false)

-   By default, both the IndexedDB database and the remote database contain all properties of the documents. However, when the property is set to true, default values are stripped during persistence. These default values will be added back through the object mapping mechanism, ensuring the integrity of the data is preserved. It is important to note that if a different model is used that either does not include those default values or includes different ones, the behavior may vary.

###### `corruptAlertThreshold`:`number` (Defaults to 0)

-   Set a value between 0 and 1 to introduce tolerance for data corruption. A value greater than 0 allows a level of tolerance for corrupted data. The default value of 0 indicates no tolerance for data corruption.

###### `deferPersistence`:`false | number` (Defaults to false)

-   During document insertion, updating, or deletion, these operations are initially performed on the in-memory copy of the database, subsequently, the changes are reflected in the persisted database, then the promises associated with these operations are resolved. However, if you set this property to a numeric value, the promises will be resolved before the operations are persisted to the IndexedDB database. After a specified number of milliseconds (determined by the value you provided) the operations will be persisted to IndexedDB.
-   This approach can offer optimal performance for applications that prioritize speed, since performance bottleneck is actually IndexedDB transactions. But it should be noted that consistency between the in-memory and persisted copies of the database may be compromised due to the time delay. Eventual consistency will occur, unless script execution stopped (like page reload or exit).

###### `indexes`:`Array<string>` (Defaults to an empty array)

-   This is a way to define the indexes of your database. It's equivalent to calling `db.ensureIndex` However, it offers less options. For example, the indexes created using this approach will not be unique by default. If you require unique indexes, you would need to recreate them using `db.ensureIndex` and explicitly define them as unique (check `ensureIndex` below for more information).
-   Nevertheless, it can be considered as a shortcut for defining non-unique database indexes.

###### `cacheLimit`:`number` (Defaults to 1000)

-   To avoid overwhelming user memory with cached data, a cache limit must be set. defaults to 1000 (read more about caching mechanism below).

###### `encode`:`(input:string)=>string` (Defaults to undefined)

###### `decode`:`(input:string)=>string` (Defaults to undefined)

-   Implement the encode and decode methods as reverse functions of each other. By default, documents are persisted as JavaScript objects in the IndexedDB database and sent to the remote database as stringified versions of those objects. Use these methods to implement encryption or other transformations for data persistence and retrieval.

```typescript
import { Database } from "xwebdb";

function encrypt() {
	/* encrpytion code */
}
function decrypt() {
	/* decrpytion code */
}

let db = new Database({
	ref: "database",
	encode: (input: string) => encrpyt(input),
	decode: (input: string) => decrypt(input),
});
```

## Object Mapping

Object mapping is mechanism by which you define a structure for your data using JavaScript classes.

```typescript
import { Doc } from "xwebdb";
class Person extends Doc {
	firstName: string = "";
	lastName: string = "";
	birth: number = 20;
	// getters
	get fullName() {
		return this.firstName + " " + this.lastName;
	}
	get age() {
		new Date().getFullYear() - this.birth;
	}
	// alias
	name = fullname;
	// helper method
	setBirthByAge(age: number) {
		this.birth = new Date().getFullYear() - age;
	}
}
```

From the above example you can see the following advantages when defining your model:

-   You can set **getters** in the class and use them when querying.
-   You can use **aliases** for properties.
-   You can use **helper methods** as part of your document.
-   You can set **default values** for properties.

The model class extends Doc, which is mandatory because:

-   `_id` field will be added automatically. XWebDB, by default uses UUID generator that is even faster than the native `crypto.randomUUID()`.
-   Properties with default values will be stripped on persistence so your documents will take less size and send less data when syncing. If `stripDefaults` options is set to true on database instantiation.

Having your model as a class allows for more creativity and flexibility, the following example implements a basic level of hierarchy in model definition, since two models share similar type of values:

```typescript
import { Doc } from "xwebdb";
class Person extends Doc {
	// overwrites the default _id generator
	_id: string = crypto.randomUUID();
	firstName: string = "";
	lastName: string = "";
	get fullName() {
		return this.firstName + " " + this.lastName;
	}
}

class Doctor extends Person {
	speciality: string = "";
}

class Patient extends Person {
	illness: string = "";
}

let doctorsDB = new Database<Doctor>({
	model: Doctor,
	ref: "doctors",
});

let patientsDB = new Database<Patient>({
	model: Patient,
	ref: "patients",
});
```

You can explore more advanced concepts such as OOP, modularity, dependency injection, decorators, mixins, and more.

#### Subdocuments Mapping

Submodels (Child models/subdocuments) are also supported in object mapping using `SubDoc` class and `mapSubModel` function.

```typescript
import { Doc, SubDoc, mapSubModel } from "xwebdb";

/**
 * Toy is a subdocument of a subdocument of a document
 * Sub document definintion must extend "SubDoc"
 */
class Toy extends SubDoc {
	name: string = "";
	price: number = 0;
	get priceInUSD() {
		return this.price * 1.4;
	}
}

/**
 * Child is a subdocument of a document
 * Sub document definintion must extend "SubDoc"
 */
class Child extends SubDoc {
	name: string;
	age: number = 0;
	toys: Toy[] = mapSubModel(Toy, []);
	favoriteToy: Toy = mapSubModel(Toy, Toy.new({}));
	get numberOfToys() {
		return this.toys.length;
	}
}

class Parent extends Doc {
	name: string = "";
	age: number = 9;
	male: boolean = false;
	mainChild: Child = mapSubModel(Child, Child.new({}));
	children: Child[] = mapSubModel(Child, []);
	get female() {
		return !this.male;
	}
}
```

From the above example you can see that `mapSubModel` takes two arguments:

1. First one: is model definition of the subdocument.
2. Second one: is the default value for this property/field.

#### Inserting documents

When trying to insert/create a new document use the `.new()` method.

```typescript
db.insert(Parent.new());
// inserts a new "Parent" document.
// fields/properties of the document will all be the default values.
// to define properties other than the defaults
// you can pass them as a plain JS object.
db.insert(
	Parent.new({
		name: "Ali",
		age: 31,
		male: true,
		mainChild: Child.new({
			name: "Kiko",
		}),
		// properties that are not
		// mentioned in this object
		// will be the defaults defined
		// in the class above
	})
);

// Note that the .new() method
// doesn't actually insert a new document.
// it merely returns a document in preparation for insertion.
```

#### How would it look when persisiting?

When persisting data, only the actual fields (neither getters nor methods) will be persisted. Using the stripDefaults option on database instantiation will also remove the default values from the persisted data ([StripDefaults](#stripdefaultsboolean-defaults-to-false)).

#### Best practices

-   Define getters instead of functions and methods. This enables you to query documents using the getter value, use them as indexes, and simplifies your queries.

```typescript
class Parent extends Doc {
	age: number = 9;
	maleChildren: Child[] = mapSubModel(Child, []);
	femaleChildren: Child[] = mapSubModel(Child, []);
	get numberOfChildren() {
		return this.maleChildren.length + this.femaleChildren.length;
	}
	get fertility() {
		this.numberOfChildren / this.age;
	}
}
let parentsDB = new Database<Parent>({ ref: "parents", model: Parent });
// simple query
parentsDB.find({ fertility: { $gt: 2 } });
// if you wouldn't use the computed property your query will be very complex having to use many operators like: $or, $size, $gt and maybe even more.
```

-   Always use the static Model.new to prepare new documents before insertion.

```typescript
// all fields have default values
db.insert(Parent.new());
// all fields have default values except 'age'
db.insert(Parent.new({ age: 30 }));
```

-   Define createdAt and updatedAt in your model when you're using them in you database.
-   Never try to directly set a computed property or update it via the update operators.
-   Use Model.new in conjugation with the upsert operator `$setOnInsert` (more on upserting in the examples below).
-   Always define defaults for your fields in the model.

## Query API & Operators

The Query API closely resembles [MongoDB MQL](https://docs.mongodb.com/manual/tutorial/query-documents/). You can query documents based on field equality or utilize a range of comparison operators such as `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$ne`, and `$eq`. Additionally, logical operators like `$or`, `$and`, `$not`, and `$where` are available for more complex querying capabilities.

1. **Field equality**, e.g. `{name:"Ali"}`
2. **Comparison operators** (at field level), e.g. `{age:{$gt:10}}`
3. **logical operators** (at top level), e.g. `{$and:[{age:10},{name:"Ali"}]`.

### 1. Field Level Equality

To specify equality conditions in a query filter document, you can use `{ <FieldName> : <Value> }` expressions. This allows you to find documents that match specific field values. Here are some examples:

```javascript
// Select all documents where the name is "ozzy"
db.find({ filter: { name: "ozzy" } });

// Select all documents where the age is exactly 27
// and the height is exactly 180
db.find({
	filter: {
		age: 27,
		height: 180,
	},
});
```

In these examples, the filter field is used to specify the equality conditions for the query. You can provide multiple field-value pairs to further refine the query.

However, like MongoDB, when dealing with deeply nested objects, simple field-level equality may not work as expected. Consider the following example:

```javascript
// Suppose you have the following document:
{
    item: "Box",
    dimensions: {
        height: 30,
        width: 20,
        weight: 100
    }
}

// The following queries won't match:
db.find({
    dimensions: { height: 30 }
});

db.find({
    dimensions: { height: 30, width: 20 }
});

// The following query will match:
db.find({
    dimensions: { height: 30, width: 20, weight: 100 }
});
```

In the case of deeply nested objects, using field-level equality alone will not work. To query deeply nested documents, you need to use the `$deep` operator. The `$deep` operator allows you to specify nested fields and their values in a query. More information about the `$deep` operator can be found below.

### 2. Field-level operators

Syntax: `{ <fieldName>: { <operator>: <specification> } }`

#### 2.1. Comparision Operators

| `$eq`||
|-|-|
| Applies to  | `Any field type`                                                                                                                                                         |
| Syntax      | `{ <fieldName> : { $eq: <value> } }`                                                                                                                                     |
| Explanation | Specifies equality condition. The $eq operator matches documents where the value of a field equals the specified value. It is equivalent to `{ <FieldName> : <Value> }`. |

```typescript
// Example
db.find({ filter: { name: { $eq: "ozzy" } } });
// same as:
db.find({ filter: { name: "ozzy" } });
```

##### `$in`

##### `$in`

## Update API & Operators

## Synchronization

## Live Queries & Frontend Frameworks

Live queries features enable you to query a set of documents as an observable array. Meaning, that the query value will change once the database has been updated and any modification you do on the query result will also be reflected on the database. Think of it like a two-way data-binding but for databases.

## Deeply nested documents

## Caching

### Current progress

-   [x] Split database options into fields
-   [x] indexing as an option on creation
-   [x] AVLTree & Indexing
    -   [ ] test sorted dictionary
-   [x] Modelling system
-   [x] Query API
-   [x] Persistence
-   [x] Strong-typing
-   [ ] Sync Adapters
    -   [x] Memory (for testing)
    -   [x] Cloudflare KV Adapter
    -   [ ] CosmosDB Adapter
    -   [ ] DynamoDB Adapter
    -   [ ] Firestore Adapter
    -   [ ] S3 Adapter (not advised)
-   [x] Replication/sync system
    -   [ ] Get all keys might be too expensive?
    -   [x] Basic functional sync functionality
    -   [x] Memory adapter (for demo & tests)
    -   [x] Write tests
        -   [x] Sync Integration
        -   [x] Check sync function step (diff) on all tests
    -   [x] Work with conflicts
    -   [x] transaction log truncation (deleted? updated again?)
    -   [x] idb operations in bulk for perf improvements
    -   [x] invalidate $H ? `Math.floor(new Date() / (1000 * 60 * 20))`
    -   [x] force sync (regardless of ongoing/hash)
    -   [x] test devalidation
-   [ ] Setup Sync demo
-   [ ] Split optional functionalities into modules
    -   [ ] Extensibility (hooks?)
    -   [ ] Adapters (each)
    -   [ ] Syncing
    -   [ ] e2e data encryption
    -   [ ] Reactive
-   [ ] Performance
    -   [ ] loops <<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>
    -   [x] q
    -   [ ] $ deep?
    -   [x] Defer all IndexedDB interactions and do them in bulk (especially writes & deletes)
        -   [x] test
    -   [ ] Compare with other DBs
    -   [x] AVL Tree
-   [x] Reactive
    -   [x] Make observable nested arrays possible
        -   [x] TESTING REQUIRED: write unit core tests for "observable"
    -   [x] use live() to return an observable result that will be consumed by the application
        -   [x] TESTING REQUIRED: write integration tests for "live"
    -   [x] UI frameworks state should update automatically once the database updates (if the update)
    -   [x] observe this result for changes from the UI framework side and reflect those changes onto the DB
        -   [x] since updates are in batch, merge multiple operations on the same document
        -   [x] TESTING REQUIRED: write integration tests for "live"
    -   [x] observe changes in the database and reflect them onto the live query and hence the application
        -   [x] TESTING REQUIRED: write integration tests for "live"
    -   [x] Ability to kill live query
-   [x] Improve `Class Database` API
-   [x] Strip defaults before persisting
    -   [x] Test (include date objects in the test)
-   [x] Test modelling (and submodelling) integration
-   [ ] Implement more mongodb operators
-   [x] Strong-typing of $deep and deeply nested
-   [ ] Code review of all old code base
    -   [ ] cursor.ts
    -   [ ] datastore.ts
    -   [ ] indexes.ts
-   [ ] Implement pure dot notation (other than $deep)
-   [ ] Examples
-   [ ] Benchmark
-   [ ] Docs
-   [ ] Landing page

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
