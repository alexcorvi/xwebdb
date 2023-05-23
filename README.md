# [XWebDB](https://alexcorvi.github.io/xwebdb/#/)

_pronounced: Cross Web Database_

> Documentation work in progess

## What is this?

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

> [!WARNING]
> While XWebDB may appear to be a promising choice for your next project compared to other databases, it is essential to carefully weigh your decision. Other solutions have undergone rigorous testing, have been battle-tested, and enjoy robust support from larger communities. This is not to discourage you from using XWebDB; in fact, I am currently using it in multiple projects myself. However, it's important to acknowledge that XWebDB is a relatively new project. With time, it is expected to mature and improve. I hope that in the future, this cautionary section can be removed from the documentation. Until then, it is advisable to thoroughly consider your options before making a final decision.

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
	ref: "my-database", // Specify the reference name for the database
});
```

> [!WARNING]
> The above example is oversimplified and shouldn't be used in a real-world application as it doesn't specify the model to be used in the database for object mapping.

For more advanced configurations, please refer to the [Configuration](#Configuration) section below.

### Object Mapping

You can define a document model by extending the Doc class and specifying its properties and methods:

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
	ref: "my-database1",
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
	ref: "my-database",
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

### Sub-documents Mapping

Submodels (Child models/sub-documents) are also supported in object mapping using `SubDoc` class and `mapSubModel` function.

```typescript
import { Doc, SubDoc, mapSubModel } from "xwebdb";

/**
 * Toy is a sub-document of a sub-document of a document
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
 * Child is a sub-document of a document
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

1. First one: is model definition of the sub-document.
2. Second one: is the default value for this property/field.

### Inserting documents

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

### How would it look when persisiting?

When persisting data, only the actual fields (neither getters nor methods) will be persisted. Using the stripDefaults option on database instantiation will also remove the default values from the persisted data ([StripDefaults](#stripdefaultsboolean-defaults-to-false)).

### Best practices

-   Define getters instead of functions and methods. This enables you to query documents using the getter value, use them as indexes, and simplifies your queries.

```typescript
class Child extends Doc {
	age: number = 9;
	oldToys: Toy[] = mapSubModel(Toy, []);
	newToys: Toy[] = mapSubModel(Toy, []);
	get numberOfToys() {
		return this.oldToys.length + this.newToys.length;
	}
	get toyEachYear() {
		return this.numberOfToys / this.age > 1;
	}
}
let childrenDB = new Database<Child>({ ref: "children", model: Child });
// simple query
childrenDB.find({ toyEachYear: { $gt: 2 } });
// if you wouldn't use the computed property
// your query will be very complex
// having to use many operators
// like: $or, $size, $gt and maybe even more.
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

## Inserting

To insert documents in the database use the `insert` method (or alias: `create`), which can either take single document or an array of documents. Remember to always use the `Model.new()` when inserting document.

```typescript
import { Database, Doc } from "xwebdb";

class Person extends Doc {
	name: string = "";
	age: number = 0;
}

let db = new Database<Person>({ ref: "database", model: Person });

// insert an empty document (with default values)
db.insert(Person.new({}));

// insert a document with fields
db.insert(
	Person.new({
		name: "ali",
		age: 12,
	})
);

db.insert(
	Person.new({
		name: "ali",
		// age field will have the default value
	})
);

// inserting multiple documents at once
db.insert([Person.new({ name: "ali" }), Person.new({ name: "dina" })]);
```

The insert method will return a promise that resolves to the number of inserted documents and an array of the inserted documents. The last line of the above example will return a promise that resolves to the following:

```typescript
{
	number: 2,
	docs: [
		{
			_id: "ad9436a8-ef8f-4f4c-b051-aa7c7d26a20e",
			name: "ali",
			age: 0,
		},
		{
			_id: "38ae1bbd-60a7-4980-bbe9-fce3ffaec51c",
			name: "dina",
			age: 0,
		}
	]
}
```

## Reading

Reading from the database using `read` (alias: `find`):

```typescript
db.read({ name: "ali" });
db.find({ name: "ali" }); // alias
```

The `read` (or `find`) method takes two arguments:

1. The first one is the read query (resembles MongoDB).
2. The second one is an object that you can use to `skip`, `limit`, `sort`, and `project` the matched documents.

Here's a more elaborate example:

```typescript
db.read(
	{ name: "ali" }, // query
	{
		skip: 2, // skip the first two matches
		limit: 10, // limit matches to 10 results
		project: {
			// pick-type projection
			// result will only have
			// the following props
			name: 1,
			age: 1,

			// omit-type projection
			// result will not have
			// the following props
			address: 0,
			email: 0,

			// NOTE: you can either use
			// pick-type or omit-type projection
			// except for _id which is by default
			// always returned and which you can choose to omit
		},
		sort: {
			name: 1, // ascending sort by name
			age: -1, // descending sort by age
			// single or multiple sort elements
			// can be specified at the same time
		},
	}
);
```

The Query API (first argument of `read`) closely resembles [MongoDB MQL](https://docs.mongodb.com/manual/tutorial/query-documents/). You can query documents based on field equality or utilize a range of comparison operators such as `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$ne`, and `$eq`. Additionally, logical operators like `$or`, `$and`, `$not`, and `$where` are available for more complex querying capabilities.

1. **Field equality**, e.g. `{name:"Ali"}`
2. **Field level operators** (comparison at field level), e.g. `{age:{$gt:10}}`
3. **Top level operators** (logical at top level), e.g. `{$and:[{age:10},{name:"Ali"}]`.

### 1. Field Level Equality

To specify equality conditions in a query filter document, you can use `{ <FieldName> : <Value> }` expressions. This allows you to find documents that match specific field values. Here are some examples:

```typescript
// Select all documents where the name is "ali"
db.find({ name: "ali" });

// Select all documents where the age is exactly 27
// and the height is exactly 180
db.find({
	age: 27,
	height: 180,
});
```

In these examples, the filter field is used to specify the equality conditions for the query. You can provide multiple field-value pairs to further refine the query.

However, like MongoDB, when dealing with deeply nested objects, simple field-level equality may not work as expected. Consider the following example:

```typescript
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

#### 2.1. Comparison Operators

##### `$eq`

Specifies equality condition. The $eq operator matches documents where the value of a field equals the specified value. It is equivalent to `{ <FieldName> : <Value> }`.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $eq: <value> } }`

###### **Example**

```typescript
// Example
db.find({ name: { $eq: "ali" } });
// same as:
db.find({ name: "ali" });
```

<!-- tabs:end -->

##### `$ne`

$ne selects the documents where the value of the field is not equal to the specified value. This includes documents that do not contain the field.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $ne: <value> } }`

###### **Example**

```typescript
// selecting all documents where "name"
// does not equal "ali"
db.find({ name: { $ne: "ali" } });
```

<!-- tabs:end -->

##### `$gt`

selects those documents where the value of the field is greater than (i.e. `>`) the specified value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax: `{ <fieldName> : { $gt: <value> } }`

###### **Example**

```typescript
// applied on a number field
db.find({ year: { $gt: 9 } });

// applied on a date field
db.find({
	createdAt: { $gt: new Date(1588134729462) },
});
```

<!-- tabs:end -->

##### `$lt`

selects those documents where the value of the field is less than (i.e. `<`) the specified value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax: `{ <fieldName> : { $lt: <value> } }`

###### **Example**

```typescript
// applied on a number field
db.find({ year: { $lt: 9 } });

// applied on a date field
db.find({
	createdAt: { $lt: new Date(1588134729462) },
});
```

<!-- tabs:end -->

##### `$gte`

selects those documents where the value of the field is greater than or equal to (i.e. `>=`) the specified value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax: `{ <fieldName> : { $gte: <value> } }`

###### **Example**

```typescript
// applied on a number field
db.find({ year: { $gte: 9 } });

// applied on a date field
db.find({
	createdAt: { $gte: new Date(1588134729462) },
});
```

##### `$lte`

selects those documents where the value of the field is less than or equal to (i.e. `<=`) the specified value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax: `{ <fieldName> : { $lte: <value> } }`

###### **Example**

```typescript
// applied on a number field
db.find({ year: { $lte: 9 } });

// applied on a date field
db.find({
	createdAt: { $lte: new Date(1588134729462) },
});
```

<!-- tabs:end -->

##### `$in`

The `$in` operator selects the documents where the value of a field equals any value in the specified array.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $in: [<value1>, <value2>, ... etc] } }`

###### **Example**

```typescript
// find documents where the "name"
// field is one of the specified
// in the array
db.find({ name: { $in: ["ali", "john", "dina"] } });
```

<!-- tabs:end -->

##### `$nin`

The `$nin` operator (opposite of `$in`) selects the documents where the value of a field **doesn't** equals any value in the specified array.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $nin: [<value1>, <value2>, ... etc] } }`

###### **Example**

```typescript
// find documents where the "name"
// field is one of the specified
// in the array
db.find({ name: { $nin: ["ali", "john", "dina"] } });
```

<!-- tabs:end -->

#### 2.2 Element operators

##### `$exists`

When `<boolean>` is passed and is `true`, `$exists` matches the documents that contain the field, including documents where the field value is null. If `<boolean>` is `false`, the query returns only the documents that do not contain the field.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $exists: <boolean> } }`

###### **Example**

```typescript
// select documents where the "name"
// field is defined, even if it is null
db.find({ name: { $exists: true } });

// select documents where the "name"
// field is not defined
db.find({ name: { $exists: false } });
```

<!-- tabs:end -->

##### `$type`

`$type` selects documents where the value of the field is an instance of the specified type. Type specification can be one of the following:

-   `"string"`
-   `"number"`
-   `"boolean"`
-   `"undefined"`
-   `"array"`
-   `"null"`
-   `"date"`
-   `"object"`

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Any field type`
-   Syntax: `{ <fieldName> : { $type: <spec> } }`

###### **Example**

```typescript
// find documents where the "name" field
// is a string.
db.find({ name: { $type: "string" } });
```

<!-- tabs:end -->

#### 2.3 Evaluation operators

##### `$mod`

Select documents where the value of a field divided by a divisor has the specified remainder (i.e. perform a modulo operation to select documents).

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax: `{ <fieldName> : { $mod: [divisor, remainder] } }`

###### **Example**

```typescript
// select documents where the "years" field
// is an even number
db.find({
	years: {
		$mod: [2, 0],
	},
});

// select documents where the "years" field
// is an odd number
db.find({
	years: {
		$mod: [2, 1],
	},
});
```

##### `$regex`

Selects documents which tests true for a given regular expression.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `string` fields
-   Syntax: `{ <fieldName> : { $regex: <RegExp> } }`

###### **Example**

```typescript
// select documents where the "name"
// field starts with either "a" or "A".
db.find({ name: { $regex: /^a/i } });
```

<!-- tabs:end -->

#### 2.4 Array operators

##### `$all`

The `$all` operator selects the documents where the value of a field is an array that contains all the specified elements.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `array` fields
-   Syntax: `{ <fieldName> : { $all: [<value1>, <value2>,...etc] } }`

###### **Example**

```typescript
// select documents where the "tags" field
// is an array that has "music" & "art"
db.find({ tags: { $all: ["music", "art"] } });
```

<!-- tabs:end -->

##### `$elemMatch`

The `$elemMatch` operator matches documents that contain an array field with at least one element that matches all the specified query criteria.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `array` fields
-   Syntax: `{{<fieldName>:{$elemMatch:{<query1>,<query2>,...etc}}}`

###### **Example**

```typescript
// select documents where the "price" field
// is an array field that has an element
// matching the following criteria
// has an even number
// less than 8
// and greater than 0
db.find({
	price: {
		$elemMatch: {
			$mod: [2, 0],
			$lt: 8,
			$gt: 0,
		},
	},
});
```

<!-- tabs:end -->

##### `$size`

The `$size` operator matches any array with the number of elements (length of the array) specified by the argument.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `array` fields
-   Syntax: `{ <fieldName> : { $size: number } }`

###### **Example**

```typescript
// select documents where the "tags"
// field is an array that has 10 elements.
db.find({ tags: { $size: 10 } });
```

<!-- tabs:end -->

##### Other operators behavior on arrays

The array fields has the operators `$all`, `$elemMatch` and `$size` specific for them. However, all the operators mentioned earlier can also be applied to arrays, and they will return true if any element in the array matches the specified condition.

Here is a summary of how the operators work when applied to arrays:

-   `$eq`: Matches an array if it contains an element equal to the value specified by the operator.
-   `$ne`: Matches an array if it contains an element different from the value specified by the operator.
-   `$gt`: Matches an array if it contains a number greater than the value specified by the operator.
-   `$lt`: Matches an array if it contains a number less than the value specified by the operator.
-   `$gte`: Matches an array if it contains a number greater than or equal to the value specified by the operator.
-   `$lte`: Matches an array if it contains a number less than or equal to the value specified by the operator.
-   `$in`: Matches an array if it contains any of the values specified by the operator.
-   `$nin`: Matches an array if it contains none of the values specified by the operator.
-   `$mod`: Matches an array if it contains a number that, when divided by the divisor specified by the operator, yields the remainder specified by the operator.
-   `$regex`: Matches an array if it contains a string that matches the regular expression specified by the operator.
-   `$exists`: Matches any given array.
-   `$type`: Matches an array if the array itself is of the type "array" as specified by the operator.

These operators provide flexibility for querying and filtering arrays based on various conditions.

#### 2.5 Negation operator

All the above operators can be negated using the `$not` operator.

```typescript
// find all documents
// where they have "tags" that is not of length 10
db.find({ tags: { $not: { $size: 10 } } });

// similar to $ne
db.find({ name: { $not: { $eq: "ali" } } });

// find documents where the "name" field
// is a not a string
db.find({ name: { $not: { $type: "string" } } });

// select documents where the "tags"
// field is an array that doesn't have "music" & "art"
db.find({ tags: { $not: { $all: ["music", "art"] } } });

// select documents where the "years" field
// is an even number
db.find({
	years: {
		$not: {
			$mod: [2, 1],
		},
	},
});

// ...etc
```

### 3. Top-level operators

##### `$and`

`$and` performs a logical AND operation on an array of two or more expressions (e.g. `<field level query 1>`, `<field level query 2>` , etc.) and selects the documents that satisfy all the expressions in the array. The `$and` operator uses short-circuit evaluation. If the first expression (e.g. `<field level query 1>`) evaluates to false, XWebDB will not evaluate the remaining expressions.

<!-- tabs:start -->

###### **Specification**

**Syntax**

```typescript
{
    $and: [
        <query1>,
        <query2>,
        <query3>,
        ...etc
    ]
}
```

###### **Example**

```typescript
/**
 * Select a document where the name
 * isn't equal to "ali" and the property exists
 */
db.find({
	$and: [{ $name: { $ne: "ali" } }, { $name: { $exists: true } }],
});
```

<!-- tabs:end -->

##### `$nor`

`$nor` performs a logical NOR operation on an array of one or more query expression and selects the documents that fail all the query expressions in the array.

<!-- tabs:start -->

###### **Specification**

**Syntax**

```typescript
{
    $nor: [
        <query1>,
        <query2>,
        <query3>,
        ...etc
    ]
}
```

###### **Example**

```typescript
/**
 * Select a document where the "name" is not "alex"
 * and the age is not 13
 */
db.find({
	$nor: [{ $name: "alex" }, { $age: 13 }],
});
```

<!-- tabs:end -->

##### `$or`

The `$or` operator performs a logical OR operation on an array of two or more expressions and selects the documents that satisfy at least one of the expressions.

<!-- tabs:start -->

###### **Specification**

**Syntax**

```typescript
{
    $or: [
        <query1>,
        <query2>,
        <query3>,
        ...etc
    ]
}
```

###### **Example**

```typescript
/**
 * Select a document where the "name" is not "ali"
 * or the age is not 13
 */

db.find({
	$or: [{ name: "ali" }, { $age: 13 }],
});
```

<!-- tabs:end -->

##### `$where`

Matches the documents that when evaluated by the given function would return true.

> [!WARNING]
> The `$where` provides greatest flexibility, but requires that the database processes the JavaScript expression or function for each document in the collection. It's highly advisable to avoid using the `$where` operator and instead use indexed getters as explained in the object mapping section of this documentation.

<!-- tabs:start -->

###### **Specification**

**Syntax**

```typescript
{
	$where: (this: Model) => boolean;
}
```

###### **Example**

```typescript
/**
 * Select a document where the "name"
 * is 5 characters long and ends with "x"
 */

db.find({
	$where: function () {
		// DO NOT use arrow function here
		return this.name.length === 5 && this.name.endsWith("x");
	},
});
```

<!-- tabs:end -->

##### `$deep`

The `$deep` operator is the only operator in XWebDB that doesn't exist in MongoDB. It has been introduced as an alternative to the dot notation to match deep fields in sub-documents.

Take the following document for example:

```typescript
{
	item: "box",
	dimensions: {
		height: 100,
		width: 50
	}
}
```

The following queries will behave as follows:

```typescript
db.find({ dimensions: { height: 100 } });
// will not match, because field-level literal equality
// requires the query object to exactly equal the document object

db.find({ $deep: { dimensions: { height: 100 } } });
// the above query will match the document
```

The reason that the `$deep` operator has been added is to keep strict typing even when querying deeply nested objects. Since it is not possible (in typescript) to define strict typings for the dot notation.

<!-- tabs:start -->

###### **Specification**

**Syntax**

```typescript
{
    $deep: <query>
}
```

###### **Example**

Basic example:

```typescript
// document
{
	item: "box",
	dimensions: {
		height: 100,
		width: 50
	}
}

db.find({ $deep: { dimensions: { height: 100 } } });
```

You can specify multiple deep fields:

```typescript
//documents
{
	name: {
		first: "ali",
		last: "saleem",
	}
}
{
	name: {
		first: "john",
		last: "cena",
	}
}

db.find({
	$deep: {
		name: {
			first: { $in: ["ali", "john"] },
			last: { $in: ["saleem", "cena"] },
		},
	}
});
```

You can use the `$deep` operator even in array elements by defining their index:

```typescript
// document:
{
	name: "ali",
	children: [
		{
			name: "keko",
			age: 2,
		},
		{
			name: "kika",
			age: 1,
		}
	]
}

db.find({
	$deep: {
		children: {
			0: {
				age: { $gt : 1 }
			}
		}
	}
})
```

<!-- tabs:end -->

## Counting

To count the number of documents matching a specific query use the `count` method.

Count method always returns a promise that resolves to a number.

```typescript
// count number of documents
// that has "ali" in the "name" field
db.count({ name: "ali" });

// count number of documents
// that has age greater than 20
db.count({ age: { $gt: 20 } });
```

The query API in the `count` method is the same as the query API in `read` method, which in turn very similar to MongoDB query language.

## Updating

To update documents in the database use the `update` method.

```typescript
db.update(
	// first argument is the find query
	// matching target documents
	// to be updated
	{
		name: "ali",
	},
	// second argument is the update
	// must be supplied with one of the update operators
	{
		$set: {
			age: 32,
		},
	},
	// third argument is a boolean
	// whether to update multiple documents
	// or to update the first match only
	// defaults to "false"
	// i.e. update first match only
	false
);
```

The first argument of the update method takes a query with the same syntax as the `find` & `count` methods as explained above. The second argument must be supplied with the update operators.

> [!INFO]
> Although it is possible in MongoDB to use the direct field updates (no operator, `{age:5}`), this is not supported in XWebDB to enforce a more strict type declaration.

The update operators are:

1. Field operators
2. Mathematical operators
3. Array operators

### 1. Field Update Operators

##### `$set`

Sets the value of a field in a document to a specified value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `any field type`
-   Syntax

```typescript
{
    $set: {
        <fieldName1>: <value1>,
        <fieldName2>: <value2>,
        ...etc
    }
}
```

###### **Example**

```typescript
/**
 * update the name "ali" to "dina"
 */
db.update(
	{
		name: "ali",
	},
	{
		$set: {
			name: "dina",
		},
	}
);
```

<!-- tabs:end -->

##### `$unset`

Sets the value of a field in a document to `undefined`.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `any field type`
-   Syntax

```typescript
{
    $unset: {
        <fieldName1>: "",
        <fieldName2>: "",
        ...etc
    }
}
```

###### **Example**

```typescript
/**
 * setting the name "ali" to undefined
 */
db.update(
	{
		name: "ali",
	},
	{
		$unset: {
			name: "",
		},
	}
);
```

<!-- tabs:end -->

##### `$currentDate`

Sets the value of a field in a document to a `Date` object or a timestamp `number` representing the current date.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Date` & `number` fields
-   Syntax

```typescript
{
    $currentDate: {
		// date object (applies to Date fields)
        <fieldName1>: true,
		// date object (alternative syntax)
        <fieldName2>: { $type: "date" },
        // timestamp (applies to number fields)
		<fieldName3>: { $type: "timestamp" },
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * setting the name "ali" to undefined
 */
db.update(
	{
		name: "ali",
	},
	{
		$currentDate: {
			lastLogin: true,
			lastLoginTimestamp: {
				$type: "timestamp",
			},
		},
	}
);
```

<!-- tabs:end -->

##### `$rename`

Renames a property name to a different one while keeping the value the same.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `any field type`
-   Syntax

```typescript
{
    $rename: {
        <fieldName1>: <newName1>,
        <fieldName2>: <newName2>,
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * setting the property name "name" to "firstName"
 */
db.update(
	{
		name: "ali",
	},
	{
		$rename: {
			name: "firstName",
		},
	}
);
```

<!-- tabs:end -->

### 2. Mathematical Update Operators

##### `$inc`

increments the value of a field in a document to by a specific value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` fields
-   Syntax

```typescript
{
    $inc: {
        <fieldName1>: <number>,
        <fieldName2>: <number>,
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * increment the age field by 2, and the months by 24
 */
db.update(
	{
		name: "ali",
	},
	{
		$inc: {
			age: 2,
			months: 24,
		},
	}
);
```

You can also pass a negative value to decrement

```typescript
/**
 * decrement the age field by 2, and the months by 24
 */
db.update(
	{
		name: "ali",
	},
	{
		$inc: {
			age: -2,
			months: -24,
		},
	}
);
```

<!-- tabs:end -->

##### `$mul`

multiplies the value of a field in a document to by a specific value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` fields
-   Syntax

```typescript
{
    $mul: {
        <fieldName1>: <number>,
        <fieldName2>: <number>,
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * multiplies the age field by 2, and the months by 24
 */
db.update(
	{
		name: "ali",
	},
	{
		$mul: {
			age: 2,
			months: 24,
		},
	}
);
```

You can also use the `$mul` operator to do a division mathematical operation:

```typescript
/**
 * divides the age field by 2, and the months by 24
 */
db.update(
	{
		name: "ali",
	},
	{
		$mul: {
			age: 1 / 2,
			months: 1 / 24,
		},
	}
);
```

<!-- tabs:end -->

##### `$max`

Updates the field value to a new value only if the specified value is greater than the existing value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax

```typescript
{
    $max: {
        <fieldName1>: <number|Date>,
        <fieldName2>: <number|Date>,
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * sets the age field to 10 if it's less than 10
 */
db.update(
	{
		name: "ali",
	},
	{
		$max: {
			age: 10,
		},
	}
);
```

<!-- tabs:end -->

##### `$min`

Updates the field value to a new value only if the specified value is less than the existing value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `number` & `Date` fields
-   Syntax

```typescript
{
    $min: {
        <fieldName1>: <number|Date>,
        <fieldName2>: <number|Date>,
		...etc
    }
}
```

###### **Example**

```typescript
/**
 * sets the age field to 10 if it's greater than 10
 */
db.update(
	{
		name: "ali",
	},
	{
		$min: {
			age: 10,
		},
	}
);
```

<!-- tabs:end -->

### 3. Array Update Operators

##### `$addToSet`

Adds elements to an array only if they do not already exist in it.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Array` fields
-   Syntax

```typescript
{
    $addToSet: {
        // adds a single value
        <fieldName1>: <value>,
        // adds multiple values
        <fieldName2>: {
            $each: [
                <value1>,
                <value2>,
                <value3>,
                ... etc
            ]
        }
    }
}
```

###### **Example**

```typescript
/**
 * Update a document where "name" is "ali"
 * by adding the skill "javascript"
 * and adding two projects
 */
db.update(
	{ name: "ali" },
	{
		$addToSet: {
			skills: "javascript",
			projects: {
				$each: ["projectA.js", "projectB.js"],
			},
		},
	}
);
```

<!-- tabs:end -->

##### `$pop`

removes the first or last element of an array. Pass $pop a value of -1 to remove the first element of an array and 1 to remove the last element in an array.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Array` fields
-   Syntax

```typescript
{
    $pop: {
        // removes first element
        <fieldName1>: -1,
        // removes last element
        <fieldName2>: 1
    }
}
```

###### **Example**

```typescript
/**
 * Update a document where name is "ali"
 * removing last element of "skills"
 * and removes first element of "projects"
 */

db.update(
	{ name: "ali" },
	{
		$pop: {
			skills: 1,
			projects: -1,
		},
	}
);
```

<!-- tabs:end -->

##### `$pull`

Removes all array elements that match a specified query or value.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Array` fields
-   Syntax

```typescript
{
    $pull: {
        // remove by value
        <fieldName1>: <value>,
        // or remove by query
        <fieldName2>: <query>
    }
}
```

###### **Example**

```typescript
/**
 * Update a document where name is "ali"
 * removing skill "javascript"
 * and removing any project that ends with .js
 */

db.update(
	{ name: "ali" },
	{
		$pop: {
			projects: {
				$regex: /\.js$/i,
			},
			skills: "javascript",
		},
	}
);
```

<!-- tabs:end -->

##### `$pullAll`

The $pullAll operator removes all instances of the specified values from an existing array.

Unlike the $pull operator that removes elements by specifying a query, $pullAll removes elements that match the listed values.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Array` fields
-   Syntax

```typescript
{
    $pullAll: {
        <fieldName1>: [<value1>, <value2> ... etc],
        <fieldName2>: [<value1>, <value2> ... etc],
        ... etc
    }
}
```

###### **Example**

```typescript
/**
 * Update a document where name is "ali"
 * removing skills: "javascript" and "php"
 * and removes "new", "x-client"
 */

db.update(
	{ name: "ali" },
	{
		$pullAll: {
			skills: ["php", "javascript"],
		},
	}
);
```

<!-- tabs:end -->

##### `$push`

The $push operator appends a specified value to an array.

<!-- tabs:start -->

###### **Specification**

-   Applies to: `Array` fields
-   Syntax

```typescript
{
    $push: {
        <fieldName1>: <value>,
        // or
        <fieldName2>: {

            // multiple fields
            $each: [<value1>, <value2>, ...etc]

            // with modifiers
            // discussed below
            $slice: <number>,
            $position: <number>,
            $sort: <sort-specification>

        },
        ... etc
    }
}
```

###### **Example**

```typescript
/**
 * Update a document where name is "ali"
 * removing skills: "javascript" and "php"
 * and removes "new", "x-client"
 */

db.update(
	{ name: "ali" },
	{
		$push: {
			skills: "javascript",
			projects: {
				$each: ["projectA.js", "projectB.js"],
			},
		},
	}
);
```

<!-- tabs:end -->

##### `$push` with `$each` modifier

Modifies the `$push` operators to append multiple items for array updates. It can also be used with `$addToSet` operator.

```javascript
db.update(
	{ name: "ali" },
	{
		$push: {
			projects: {
				$each: ["projectA.js", "projectB.js"],
			},
		},
	}
);
```

##### `$push` with `$position` modifier

$position modifier must be supplied with a number. It specifies the location in the array at which the $push operator insert elements. Without the `$position`modifier, the`$push` operator inserts elements to the end of the array.
Must be used with `$each` modifier.

```javascript
db.update(
	{ name: "ali" },
	{
		$push: {
			projects: {
				$each: ["projectA.js", "projectB.js"],
				$position: 1,
				// the array items above will be pushed
				// starting from position 1
			},
		},
	}
);
```

If the `$position` modifier is supplied with a number larger than the length of the array the items will be pushed at the end without leaving empty or null slots.

##### `$push` with `$slice` modifier

Modifies the `$push` operator to limit the size of updated arrays.
Must be used with `$each` modifier. Otherwise it will throw. You can pass an empty array (`[ ]`) to the `$each` modifier such that only the `$slice` modifier has an effect.

```javascript
/**
 * Update a document where name is "ali"
 * by appending "a" & "b" to "tags"
 * unless the size of the array goes
 * over 6 elements
 */

db.update(
	{ name: "ali" },
	{
		$push: {
			tags: {
				$each: ["a", "b"],
				$slice: 6,
			},
		},
	}
);
```

##### `$push` with `$sort` modifier

he `$sort` modifier orders the elements of an array during a `$push` operation. Pass `1` to sort ascending and `-1` to sort descending.

Must be used with `$each` modifier. Otherwise it will throw. You can pass an empty array (`[]`) to the `$each` modifier such that only the `$sort` modifier has an effect.

Here's an elaborate example explaining all the modifiers that can be used with `$push` operator:

```javascript
/**
 * Update a document where name is "john"
 * by appending a new child to "children"
 * at the start of the array
 * then sorting the children by
 * the "age" / ascending
 * and the "name" / descending
 * then allow only 10 children in the array
 * by removing the last elements that goes
 * over 10
 */

db.update(
	{ name: "john" },
	{
		$push: {
			children: {
				$each: [{ name: "tim", age: 3 }],
				$position: 0,
				$sort: {
					age: 1,
					name: -1,
				},
				$slice: 10,
			},
		},
	}
);
```

>[!INFO]
> You can use the `$slice` and `$sort` modifiers with empty `$each` array, so they have an effect without actually pushing items to the array, i.e. only sorting (for `$sort` modifier) or only slicing (for `$slice` modifier).

## Upserting

Upserting is a combination of updating & inserting. Meaning that if the target document to be updated was found it will be updated regularly, if it's not found a new document will be inserted with a specified values.

To do upsert operations use the `upsert` method. The `upsert` method required the `$setOnInsert` operator.

## Deleting

## Indexing

## Synchronizing

## Live Queries & Frontend Frameworks

Live queries features enable you to query a set of documents as an observable array. Meaning, that the query value will change once the database has been updated and any modification you do on the query result will also be reflected on the database. Think of it like a two-way data-binding but for databases.

## Deeply nested documents

### Querying

### Updating

### Projecting

### Sorting

## Caching

---

Current progress

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

```

```
