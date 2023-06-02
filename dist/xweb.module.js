/**
 * Basic custom utilities that is used around the databases
 */
const lut = [];
for (let i = 0; i < 256; i++) {
    lut[i] = (i < 16 ? "0" : "") + i.toString(16);
}
function uid() {
    let d0 = (Math.random() * 0xffffffff) | 0;
    let d1 = (Math.random() * 0xffffffff) | 0;
    let d2 = (Math.random() * 0xffffffff) | 0;
    let d3 = (Math.random() * 0xffffffff) | 0;
    return (lut[d0 & 0xff] +
        lut[(d0 >> 8) & 0xff] +
        lut[(d0 >> 16) & 0xff] +
        lut[(d0 >> 24) & 0xff] +
        "-" +
        lut[d1 & 0xff] +
        lut[(d1 >> 8) & 0xff] +
        "-" +
        lut[((d1 >> 16) & 0x0f) | 0x40] +
        lut[(d1 >> 24) & 0xff] +
        "-" +
        lut[(d2 & 0x3f) | 0x80] +
        lut[(d2 >> 8) & 0xff] +
        "-" +
        lut[(d2 >> 16) & 0xff] +
        lut[(d2 >> 24) & 0xff] +
        lut[d3 & 0xff] +
        lut[(d3 >> 8) & 0xff] +
        lut[(d3 >> 16) & 0xff] +
        lut[(d3 >> 24) & 0xff]);
}
/**
 * simple hashing function (djb2 implementation)
 */
function dHash(str) {
    var len = str.length;
    var hash = -1;
    for (var idx = 0; idx < len; ++idx) {
        hash = ((hash << 5) + hash + str.charCodeAt(idx)) & 0xFFFFFFFF;
    }
    return hash >>> 0;
}

var customUtils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    uid: uid,
    dHash: dHash
});

/**
 * Serialize an object to be persisted to a one-line string
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
function serialize(obj, ignoreCheckKey = false) {
    return JSON.stringify(obj, function (key, value) {
        if (!ignoreCheckKey)
            validateKey(key, value);
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        if (typeof this[key].getTime === "function")
            return { $$date: this[key].getTime() };
        return value;
    });
}
/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
function deserialize(rawData) {
    return JSON.parse(rawData, function (key, val) {
        if (key === "$$date")
            return new Date(val);
        let t = typeof val;
        if (t === "string" || t === "number" || t === "boolean" || val === null)
            return val;
        if (val && val.$$date)
            return val.$$date;
        return val;
    });
}

/**
 * Check a key throw an error if the key is non valid
 */
function validateKey(key, v) {
    if (typeof key === "number")
        key = key.toString();
    if (key[0] === "$" &&
        !(key === "$$date" && typeof v === "number") &&
        !(key === "$$deleted" && v === true) &&
        !(key === "$$indexCreated") &&
        !(key === "$$indexRemoved"))
        throw new Error("XWebDB: Field names cannot begin with the $ character");
    if (key.indexOf(".") !== -1)
        throw new Error("XWebDB: Field names cannot contain a .");
}
/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
function validateObject(obj) {
    if (Array.isArray(obj))
        obj.forEach((sub) => validateObject(sub));
    else if (isKeyedObject(obj) && !(obj instanceof Date))
        for (const [key, value] of Object.entries(obj)) {
            validateKey(key, value);
            validateObject(value);
        }
}
/**
 * Tells if an object is a primitive type or a "real" object
 * Arrays are considered primitive
 */
function isPrimitiveType(obj) {
    return !isKeyedObject(obj);
}
function isKeyedObject(obj) {
    return (typeof obj === "object" && obj !== null && !(obj instanceof Date) && !Array.isArray(obj));
}
/**
 * Deep copy a DB object
 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
 * where the keys are valid, i.e. don't begin with $ and don't contain a dot
 */
function clone(obj, model, strictKeys = false) {
    let t = typeof obj;
    if (t === "boolean" || t === "number" || t === "string")
        return obj;
    if (obj === null || obj instanceof Date)
        return obj;
    if (Array.isArray(obj))
        return obj.map((sub) => clone(sub, model, strictKeys));
    if (typeof obj === "object") {
        let res = {};
        for (const [key, val] of Object.entries(obj)) {
            if (!strictKeys || (key[0] !== "$" && key.indexOf(".") === -1)) {
                res[key] = clone(val, model, strictKeys);
            }
        }
        if (res.hasOwnProperty("_id")) {
            return model.new(res);
        }
        else {
            return res;
        }
    }
    return JSON.parse(JSON.stringify({ temp: obj })).temp;
}
function fromDotNotation(obj, field) {
    const fieldParts = typeof field === "string" ? field.split(".") : field;
    // field cannot be empty so that means we should return undefined so that nothing can match
    if (!obj)
        return undefined;
    if (fieldParts.length === 0)
        return obj;
    // got it
    if (fieldParts.length === 1)
        return obj[fieldParts[0]];
    if (Array.isArray(obj[fieldParts[0]])) {
        // If the next field is an integer, return only this item of the array
        let i = parseInt(fieldParts[1], 10);
        if (typeof i === "number" && !isNaN(i)) {
            return fromDotNotation(obj[fieldParts[0]][i], fieldParts.slice(2));
        }
        // Return the array of values
        let objects = new Array();
        for (let i = 0; i < obj[fieldParts[0]].length; i += 1) {
            objects.push(fromDotNotation(obj[fieldParts[0]][i], fieldParts.slice(1)));
        }
        return objects;
    }
    else {
        return fromDotNotation(obj[fieldParts[0]], fieldParts.slice(1));
    }
}
function toDotNotation(input) {
    const output = {};
    function flattenObject(obj, prefix = "") {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const nestedKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                /**
                 * Recursion should stop at
                 * 1. arrays
                 * 2. empty objects
                 * 3. objects that have operators
                 * 4. Null values
                 */
                if (!Array.isArray(value) &&
                    typeof value === "object" &&
                    value !== null &&
                    Object.keys(value).length &&
                    Object.keys(value).join("").indexOf("$") === -1)
                    flattenObject(value, nestedKey);
                else
                    output[nestedKey] = value;
            }
        }
    }
    flattenObject(input.$deep);
    const result = Object.assign(input, output);
    delete result.$deep;
    return result;
}
function equal(a, b) {
    let ta = typeof a;
    let tb = typeof b;
    // Strings, booleans, numbers, null
    if (a === null || ta === "string" || ta === "boolean" || ta === "number")
        return a === b;
    if (b === null || tb === "string" || tb === "boolean" || tb === "number")
        return a === b;
    // Dates
    if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    }
    // Arrays (no match since arrays are used as a $in)
    // undefined (no match since they mean field doesn't exist and can't be serialized)
    if ((!(Array.isArray(a) && Array.isArray(b)) && (Array.isArray(a) || Array.isArray(b))) ||
        a === undefined ||
        b === undefined) {
        return false;
    }
    // objects are checked by serialization, placing inside temp to prevent any possible runtime errors
    let aS = serialize({ temp: a }, true);
    let bS = serialize({ temp: b }, true);
    return aS === bS; // TODO: what if the order was incorrect? https://www.npmjs.com/package/json-stable-stringify
}
function comparable(a, b) {
    let ta = typeof a;
    let tb = typeof b;
    if (ta !== "string" &&
        ta !== "number" &&
        tb !== "string" &&
        tb !== "number" &&
        !(a instanceof Date) &&
        !(b instanceof Date)) {
        return false;
    }
    if (ta !== tb) {
        return false;
    }
    return true;
}

function compareNSB(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
function compareArrays(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        let comp = compare(a[i], b[i]);
        if (comp !== 0) {
            return comp;
        }
    }
    // Common section was identical, longest one wins
    return compareNSB(a.length, b.length);
}
/**
 * Compare anything
 * type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
 * Return -1 if a < b, 1 if a > b and 0 if a === b
 * (note that equality here is NOT the same as defined in areThingsEqual!)
 */
function compare(a, b) {
    // undefined
    if (a === undefined)
        return b === undefined ? 0 : -1;
    if (b === undefined)
        return 1; // "a" is defined
    // null
    if (a === null)
        return b === null ? 0 : -1;
    if (b === null)
        return 1; // "a" isn't null or any of the above
    // other types
    let ta = typeof a;
    let tb = typeof b;
    // Numbers
    if (ta === "number")
        return typeof b === "number" ? compareNSB(a, b) : -1;
    if (tb === "number")
        return 1; // "a" isn't a number or any of the above
    // Strings
    if (ta === "string")
        return tb === "string" ? compareNSB(a, b) : -1;
    if (tb === "string")
        return 1; // "a" isn't a string or any of the above
    // Booleans
    if (ta === "boolean")
        return tb === "boolean" ? compareNSB(a, b) : -1;
    if (tb === "boolean")
        return 1; // "a" isn't a boolean or any of the above
    // Dates
    if (a instanceof Date)
        return b instanceof Date ? compareNSB(a.getTime(), b.getTime()) : -1;
    if (b instanceof Date)
        return 1; // "a" isn't Date or any of the above
    // Arrays (first element is most significant and so on)
    if (Array.isArray(a))
        return Array.isArray(b) ? compareArrays(a, b) : -1;
    if (Array.isArray(b))
        return 1; // "a" isn't an array or any of the above
    // Objects
    let aKeys = Object.keys(a).sort();
    let bKeys = Object.keys(b).sort();
    for (let i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
        let comp = compare(a[aKeys[i]], b[bKeys[i]]);
        if (comp !== 0)
            return comp; // first key wins
    }
    return compareNSB(aKeys.length, bKeys.length); // by keys length if common part is the same
}

const arrComparison = {
    // Specific to arrays
    $size: function (arr, size) {
        if (!Array.isArray(arr))
            return false;
        if (typeof size !== "number" || size % 1 !== 0)
            throw new Error("XWebDB: $size operator called without an integer");
        return arr.length === size;
    },
    $elemMatch: function (obj, value) {
        if (!Array.isArray(obj))
            return false;
        let i = obj.length;
        while (i--)
            if (match(obj[i], value))
                return true;
        return false;
    },
    $all: function (a, b) {
        if (!Array.isArray(a))
            throw new Error("XWebDB: $all must be applied on fields of type array");
        if (!Array.isArray(b))
            throw new Error("XWebDB: $all must be supplied with argument of type array");
        for (let i = 0; i < b.length; i++)
            if (a.indexOf(b[i]) === -1)
                return false;
        return true;
    },
};
const comparisonFunctions = {
    $type: function (a, b) {
        if (["number", "boolean", "string", "undefined"].indexOf(b) > -1)
            return typeof a === b;
        else if (b === "array")
            return Array.isArray(a);
        else if (b === "null")
            return a === null;
        else if (b === "date")
            return a instanceof Date;
        else if (b === "object")
            return (typeof a === "object" &&
                !(a instanceof Date) &&
                !(a === null) &&
                !Array.isArray(a));
        else
            return false;
    },
    $not: (a, b) => !match({ k: a }, { k: b }),
    $eq: (a, b) => equal(a, b),
    $lt: (a, b) => comparable(a, b) && a < b,
    $lte: (a, b) => comparable(a, b) && a <= b,
    $gt: (a, b) => comparable(a, b) && a > b,
    $gte: (a, b) => comparable(a, b) && a >= b,
    $mod: function (a, b) {
        if (!Array.isArray(b)) {
            throw new Error("XWebDB: malformed mod, must be supplied with an array");
        }
        if (b.length !== 2) {
            throw new Error("XWebDB: malformed mod, array length must be exactly two, a divisor and a remainder");
        }
        return a % b[0] === b[1];
    },
    $ne: function (a, b) {
        if (a === undefined)
            return true;
        return !equal(a, b);
    },
    $in: function (a, b) {
        if (!Array.isArray(b))
            throw new Error("XWebDB: $in operator called with a non-array");
        for (let i = 0; i < b.length; i += 1)
            if (equal(a, b[i]))
                return true;
        return false;
    },
    $nin: function (a, b) {
        if (!Array.isArray(b))
            throw new Error("XWebDB: $nin operator called with a non-array");
        return !comparisonFunctions.$in(a, b);
    },
    $regex: function (a, b) {
        if (!(b instanceof RegExp))
            throw new Error("XWebDB: $regex operator called with non regular expression");
        if (typeof a !== "string")
            return false;
        else
            return b.test(a);
    },
    $exists: function (value, exists) {
        if (exists || exists === "")
            exists = true;
        else
            exists = false;
        if (value === undefined)
            return !exists;
        else
            return exists;
    },
    ...arrComparison,
};
function logicalOperator(operator, obj, query) {
    if (!Array.isArray(query)) {
        throw new Error("XWebDB: $or/$nor/$and operators should be used with an array");
    }
    for (let i = 0; i < query.length; i += 1) {
        const matched = match(obj, query[i]);
        if (matched) {
            if (operator === "$or")
                return true;
            if (operator === "$nor")
                return false;
        }
        else if (operator === "$and")
            return false;
    }
    return operator === "$or" ? false : true;
}
const logicalOperators = {
    $and: (obj, query) => logicalOperator("$and", obj, query),
    $nor: (obj, query) => logicalOperator("$nor", obj, query),
    $or: (obj, query) => logicalOperator("$or", obj, query),
    $where: (obj, fn) => {
        if (typeof fn !== "function")
            throw new Error("XWebDB: $where operator used without a function");
        let result = fn.call(obj);
        if (typeof result !== "boolean")
            throw new Error("XWebDB: $where function must return boolean");
        return result;
    },
};
function match(obj, query) {
    // edge-case: if query contains $operators that are comparison
    // then it should be treated as if it's a pr
    // this enables queries like: $eq $ne to be applied to objects
    let fieldLevel$ = false;
    let queryKeys = Object.keys(query);
    for (let index = 0; index < queryKeys.length; index++) {
        const key = queryKeys[index];
        if (comparisonFunctions[key]) {
            fieldLevel$ = true;
            break;
        }
    }
    // Primitive query against a primitive type
    if (isPrimitiveType(obj) || isPrimitiveType(query) || fieldLevel$)
        return matchSegment({ TMP: obj }, "TMP", query);
    // Normal query
    for (let i = 0; i < queryKeys.length; i += 1) {
        let queryKey = queryKeys[i];
        let queryValue = query[queryKey];
        if (queryKey[0] === "$") {
            let logOperatorF = logicalOperators[queryKey];
            if (!logOperatorF)
                throw new Error("XWebDB: Unknown logical operator " + queryKey);
            if (!logOperatorF(obj, queryValue))
                return false;
        }
        else if (!matchSegment(obj, queryKey, queryValue))
            return false;
    }
    return true;
}
/**
 * Match an object against a specific { key: value } part of a query
 * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
 */
function matchSegment(obj, queryKey, qVal, treatObjAsValue) {
    const oVal = fromDotNotation(obj, queryKey);
    /**
     * A. Dealing with arrays, unless forced to be treated as a values
     * oVal = [1,2,3]
     * if qVal = [1,2,3] .. we should skip this and go to an exact match
     * if qVal is an object:
     * 						1. is there an array comparison function? -> we should skip this and go to (B)
     * 						e.g. qVal = { $size: 1 } // find a document that has a specified array of size 1
     * 						2. there's a $ne/$nin check against values one by one (MongoDB behaves like this check: https://stackoverflow.com/questions/10907843/mongo-ne-query-with-an-array-not-working-as-expected for explanation)
     * 						e.g. qVal = { $ne: 2 } // find a document that has a specified array that doesn't have an element "2"
     * 						3. then match each element of the array and one of them must match, if none matches return false
     * 						e.g. qVal = { $eq: 3 } // find a document that has a specified array that has an element "3"
     */
    if (Array.isArray(oVal) && !treatObjAsValue) {
        // If the queryValue is an array, try to perform an exact match
        // e.g. qVal = {a: [1,2,3]} where oVal = [1,2,3] 
        if (Array.isArray(qVal))
            return matchSegment(obj, queryKey, qVal, true);
        // Check if we are using an array-specific comparison function
        // e.g. qVal = {a: { $size: 3 }}
        if (qVal !== null && typeof qVal === "object" && !(qVal instanceof RegExp)) {
            let keys = Object.keys(qVal);
            for (let i = 0; i < keys.length; i += 1) {
                if (arrComparison[keys[i]]) {
                    return matchSegment(obj, queryKey, qVal, true);
                }
            }
        }
        // edge case: using $ne on array
        if (qVal["$ne"])
            if (oVal.indexOf(qVal["$ne"]) !== -1)
                return false;
        // edge case: using $nin on array
        if (Array.isArray(qVal["$nin"]))
            if (qVal["$nin"].filter((v) => -1 !== oVal.indexOf(v)).length)
                return false;
        // If not, treat it as an array of { obj, query } where there needs to be at least one match
        for (let i = 0; i < oVal.length; i += 1)
            if (matchSegment({ TMP: oVal[i] }, "TMP", qVal))
                return true;
        return false;
    }
    /**
     * B. Dealing with objects of $operators: queryValue is an actual object.
     * e.g. qVal = { $lt: 1 }
     * 			If there's $operator + regular fields, will throw an error
     * 			If there's no $operator will skip this block and go to basic matching
     */
    if (typeof qVal === "object" &&
        qVal !== null &&
        !(qVal instanceof RegExp) &&
        !Array.isArray(qVal)) {
        let keys = Object.keys(qVal);
        let firstChars = keys.map((item) => item[0]);
        let dollarFirstChars = firstChars.filter((c) => c === "$");
        if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
            throw new Error("XWebDB: You cannot mix operators and normal fields");
        }
        if (dollarFirstChars.length > 0) {
            for (let i = 0; i < keys.length; i += 1) {
                if (!comparisonFunctions[keys[i]]) {
                    throw new Error("XWebDB: Unknown comparison function " + keys[i]);
                }
                if (!comparisonFunctions[keys[i]](oVal, qVal[keys[i]])) {
                    return false;
                }
            }
            return true;
        }
    }
    /**
     * C. Dealing with RegExp
     * e.g. { a: /abc/ }
     */
    if (qVal instanceof RegExp) {
        return comparisonFunctions.$regex(oVal, qVal);
    }
    /**
     * D. Basic equality matching
     * e.g. { n: 12 }
     * e.g. { a: [ 1, 2, 3 ] }
     * e.g. { o: { k:1 } }
     */
    if (!equal(oVal, qVal)) {
        return false;
    }
    return true;
}

/**
 * The signature of modifier functions is as follows
 * Their structure is always the same: recursively follow the dot notation while creating
 * the nested documents if needed, then apply the "last step modifier"
 * to know what each operator does: https://www.mongodb.com/docs/manual/reference/operator/update/
 */
const lastStepModifierFunctions = {
    $set: function (obj, field, value) {
        if (!obj)
            return;
        obj[field] = value;
    },
    $mul: function (obj, field, value) {
        let base = obj[field];
        if (typeof value !== "number" || typeof base !== "number") {
            throw new Error("XWebDB: Multiply operator works only on numbers");
        }
        obj[field] = base * value;
    },
    $unset: function (obj, field) {
        if (Array.isArray(obj)) {
            obj.splice(Number(field), 1);
            return;
        }
        delete obj[field];
    },
    $push: function (obj, field, query) {
        // Setup
        if (!obj.hasOwnProperty(field))
            obj[field] = [];
        if (!Array.isArray(obj[field]))
            throw new Error("XWebDB: Can't $push an element on non-array values");
        if (query !== null &&
            typeof query === "object" &&
            query.$slice &&
            query.$each === undefined)
            query.$each = [];
        // with modifiers
        if (query !== null && typeof query === "object" && query.$each) {
            const eachVal = query.$each;
            const sliceVal = query.$slice;
            const posVal = query.$position;
            const sortVal = query.$sort;
            const allKeys = Object.keys(query);
            // checking modifiers
            if (allKeys.length > 1 &&
                allKeys.filter((x) => {
                    return ["$each", "$slice", "$position", "$sort"].indexOf(x) === -1;
                }).length)
                throw new Error("XWebDB: Can only use the known modifiers $slice, $position and $sort in conjunction with $each when $push to array");
            else if (!Array.isArray(eachVal))
                throw new Error("XWebDB: $each requires an array value");
            else if (sliceVal !== undefined && typeof sliceVal !== "number")
                throw new Error("XWebDB: $slice requires a number value");
            // pushing with $position
            if (posVal)
                for (let i = 0; i < eachVal.length; i++)
                    obj[field].splice(posVal + i, 0, eachVal[i]);
            // pushing without $position
            else
                eachVal.forEach((v) => obj[field].push(v));
            // $applying sort
            if (sortVal) {
                if (typeof sortVal === "number") {
                    if (sortVal === 1)
                        obj[field].sort((a, b) => compare(a, b));
                    else
                        obj[field].sort((a, b) => compare(b, a));
                }
                else {
                    obj[field].sort((a, b) => {
                        const keys = Object.keys(sortVal);
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            const order = sortVal[key];
                            if (order === 1) {
                                const comp = compare(a[key], b[key]);
                                if (comp)
                                    return comp;
                            }
                            else {
                                const comp = compare(b[key], a[key]);
                                if (comp)
                                    return comp;
                            }
                        }
                        return 0;
                    });
                }
            }
            // applying $slice
            if (sliceVal === 0) {
                obj[field] = [];
            }
            else if (typeof sliceVal === "number") {
                let start = 0;
                let end = 0;
                let n = obj[field].length;
                if (sliceVal < 0) {
                    start = Math.max(0, n + sliceVal);
                    end = n;
                }
                else if (sliceVal > 0) {
                    start = 0;
                    end = Math.min(n, sliceVal);
                }
                obj[field] = obj[field].slice(start, end);
            }
        }
        // without modifiers
        else {
            obj[field].push(query);
        }
    },
    $addToSet: function (obj, field, query) {
        // setup
        if (!obj.hasOwnProperty(field)) {
            obj[field] = [];
        }
        if (!Array.isArray(obj[field])) {
            throw new Error("XWebDB: Can't $addToSet an element on non-array values");
        }
        const eachVal = query ? query.$each : undefined;
        // adding
        if (query !== null && typeof query === "object" && eachVal) {
            if (Object.keys(query).length > 1)
                throw new Error("XWebDB: Can't use another field in conjunction with $each on $addToSet modifier");
            if (!Array.isArray(eachVal))
                throw new Error("XWebDB: $each requires an array value");
            eachVal.forEach((val) => lastStepModifierFunctions.$addToSet(obj, field, val));
        }
        else {
            let addToSet = true;
            for (let index = 0; index < obj[field].length; index++) {
                const element = obj[field][index];
                if (compare(element, query) === 0) {
                    addToSet = false;
                    break;
                }
            }
            if (addToSet) {
                obj[field].push(query);
            }
        }
    },
    $pop: function (obj, field, value) {
        if (!Array.isArray(obj[field]))
            throw new Error("XWebDB: Can't $pop an element from non-array values");
        if (typeof value !== "number" || value % 1 !== 0)
            throw new Error("XWebDB: " + value + " isn't an integer, can't use it with $pop");
        if (value === 0)
            return;
        if (value > 0)
            obj[field] = obj[field].slice(0, obj[field].length - 1);
        else
            obj[field] = obj[field].slice(1);
    },
    $pull: function (obj, field, value) {
        if (!Array.isArray(obj[field]))
            throw new Error("XWebDB: Can't $pull an element from non-array values");
        let arr = obj[field];
        for (let i = arr.length - 1; i >= 0; i -= 1)
            if (match(arr[i], value))
                arr.splice(i, 1);
    },
    $pullAll: function (obj, field, value) {
        if (!Array.isArray(obj[field]))
            throw new Error("XWebDB: Can't $pull an element from non-array values");
        let arr = obj[field];
        for (let i = arr.length - 1; i >= 0; i -= 1)
            for (let j = 0; j < value.length; j++)
                if (match(arr[i], value[j]))
                    arr.splice(i, 1);
    },
    $inc: function (obj, field, value) {
        if (typeof value !== "number")
            throw new Error("XWebDB: " + value + " must be a number");
        if (typeof obj[field] !== "number") {
            if (!obj.hasOwnProperty(field))
                obj[field] = value;
            else
                throw new Error("XWebDB: Can't use the $inc modifier on non-number fields");
        }
        else
            obj[field] = obj[field] + value;
    },
    $max: function (obj, field, value) {
        if (typeof obj[field] === "undefined")
            obj[field] = value;
        else if (value > obj[field])
            obj[field] = value;
    },
    $min: function (obj, field, value) {
        if (typeof obj[field] === "undefined")
            obj[field] = value;
        else if (value < obj[field])
            obj[field] = value;
    },
    $currentDate: function (obj, field, value) {
        if (value === true)
            obj[field] = new Date();
        else if (value.$type && value.$type === "timestamp")
            obj[field] = Date.now();
        else if (value.$type && value.$type === "date")
            obj[field] = new Date();
        else
            throw new Error("XWebDB: Malformed $currentDate update query");
    },
    $rename: function (obj, field, value) {
        if (Array.isArray(obj)) {
            // this is not supported by MongoDB
            // However, I've decided to support it
            let to = Number(value);
            let from = Number(field);
            obj.splice(to, 0, obj.splice(from, 1)[0]);
            return;
        }
        obj[value] = obj[field];
        delete obj[field];
    },
    $setOnInsert: function () {
        // if the operator reached here
        // it means that the update was not actually an insertion.
        // this operator is being dealt with at the datastore.ts file
    },
};
// to work down on $operators with dot notation (or not)
// we have to chase down the field recursively until not "." exists in it
// this is done throw this singleton and function
const modifierFunctions = {};
const modifiersKeys = Object.keys(lastStepModifierFunctions);
for (let index = 0; index < modifiersKeys.length; index++) {
    const $name = modifiersKeys[index];
    modifierFunctions[$name] = (obj, field, query) => {
        var fieldParts = typeof field === "string" ? field.split(".") : field;
        // reached target
        if (fieldParts.length === 1) {
            lastStepModifierFunctions[$name](obj, field, query);
        }
        // still following dot notation
        else {
            if (obj[fieldParts[0]] === undefined) {
                if ($name === "$unset")
                    return; // already unset
                obj[fieldParts[0]] = {}; // create it
            }
            let next = fieldParts.slice(1).join(".");
            modifierFunctions[$name](obj[fieldParts[0]], next, query);
        }
    };
}
/**
 * Modify a DB object according to an update query
 */
function modify(obj, updateQuery, model) {
    const keys = Object.keys(updateQuery);
    const firstChars = keys.map((x) => x.charAt(0));
    const dollarFirstChars = firstChars.filter((x) => x === "$");
    if (keys.indexOf("_id") !== -1 && updateQuery._id !== obj._id)
        throw new Error("XWebDB: You cannot change a document's _id");
    if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length)
        throw new Error("XWebDB: You cannot mix modifiers and normal fields");
    let newDoc;
    if (dollarFirstChars.length === 0) {
        // Simply replace the object with the update query contents
        newDoc = clone(updateQuery, model);
        newDoc._id = obj._id;
    }
    else {
        // Apply modifiers
        const modifiers = Array.from(new Set(keys));
        newDoc = clone(obj, model);
        for (let index = 0; index < modifiers.length; index++) {
            const modifier = modifiers[index];
            const modArgument = updateQuery[modifier];
            if (!modifierFunctions[modifier])
                throw new Error("XWebDB: Unknown modifier " + modifier);
            if (typeof modArgument !== "object")
                throw new Error("XWebDB: Modifier " + modifier + "'s query must be an object");
            const fields = Object.keys(modArgument);
            for (let index = 0; index < fields.length; index++) {
                const field = fields[index];
                modifierFunctions[modifier](newDoc, field, modArgument[field]);
            }
        }
    }
    // Check result is valid and return it
    validateObject(newDoc);
    if (obj._id !== newDoc._id)
        throw new Error("XWebDB: You cannot change a document's _id");
    return newDoc;
}

function sort(documents, criteria) {
    return documents.sort((a, b) => {
        // for each sorting criteria
        // if it's either -1 or 1 return it
        // if it's neither try the next one
        for (const [key, direction] of Object.entries(criteria || {})) {
            let compareRes = direction * compare(fromDotNotation(a, key), fromDotNotation(b, key));
            if (compareRes !== 0) {
                return compareRes;
            }
        }
        // no difference found in any criteria
        return 0;
    });
}

/**
 * Base model: of which all documents extend (Main documents & Sub-documents)
*/
class BaseModel {
    /**
     * Use this method to create a new document before insertion/update into the database
     * This is where the actual mapping of pure JS object values get mapped into the model
     * It models the document and all of its sub-documents even if they are in an array
    */
    static new(data) {
        const instance = new this();
        if (typeof data !== "object" || data === null) {
            return instance;
        }
        const keys = Object.keys({ ...instance, ...data });
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let insVal = instance[key];
            let dataVal = data[key];
            if (insVal && insVal["_$SHOULD_MAP$_"]) {
                if (dataVal === undefined) {
                    instance[key] = insVal["def"];
                }
                else if (Array.isArray(dataVal)) {
                    instance[key] = dataVal.map((x) => insVal.ctr.new(x));
                }
                else {
                    instance[key] = insVal.ctr.new(dataVal);
                }
            }
            else {
                instance[key] = dataVal === undefined ? insVal : dataVal;
            }
        }
        return instance;
    }
    /**
     * Strips default values from the model,
     * so it can be written to the persistence layer with the least amount of space
     * and it can be sent over the network with the least amount of size
    */
    _stripDefaults() {
        // maintain a cache of defaults
        if (!this.constructor._$def) {
            this.constructor._$def = this.constructor.new({});
        }
        let def = this.constructor._$def;
        const newData = {};
        for (const [key, oldV] of Object.entries(this)) {
            const defV = def[key];
            // handling arrays of sub-documents
            if (Array.isArray(oldV) && oldV[0] && oldV[0]._stripDefaults) {
                newData[key] = oldV.map((sub) => sub._stripDefaults());
                if (newData[key].length === 0)
                    delete newData[key]; // disregard empty arrays
            }
            // handling direct child sub-document
            else if (typeof oldV === "object" &&
                oldV !== null &&
                oldV._stripDefaults) {
                newData[key] = oldV._stripDefaults();
                if (Object.keys(newData[key]).length === 0)
                    delete newData[key]; // disregard empty objects
            }
            // handling non-sub-document values
            // we're converting to a string to eliminate non-primitive
            else if (JSON.stringify(defV) !== JSON.stringify(oldV))
                newData[key] = oldV;
        }
        return newData;
    }
}
/**
 * Main document in the database extends this class:
 * A. Gets an ID
 * B. Gets timestamp data if the options is used in the database configuration
 * C. gets Model.new() and model._stripDefaults() methods
*/
class Doc extends BaseModel {
    constructor() {
        super(...arguments);
        this._id = uid();
    }
}
/**
 * Sub-documents extends this class:
 * gets Model.new() and model._stripDefaults() methods
*/
class SubDoc extends BaseModel {
}
function mapSubModel(ctr, def) {
    return {
        _$SHOULD_MAP$_: true,
        def,
        ctr,
    };
}

function project(documents, criteria, model = Doc) {
    // no projection criteria defined: return same
    if (criteria === undefined || Object.keys(criteria).length === 0)
        return documents;
    let res = [];
    // exclude _id from consistency checking
    let keepId = criteria._id !== 0;
    delete criteria._id;
    let keys = Object.keys(criteria);
    // Check for consistency
    // either all are 0, or all are -1
    let actions = keys.map((k) => criteria[k]).sort();
    if (actions[0] !== actions[actions.length - 1]) {
        throw new Error("XWebDB: Can't both keep and omit fields except for _id");
    }
    // Do the actual projection
    for (let index = 0; index < documents.length; index++) {
        const doc = documents[index];
        let toPush = {};
        if (actions[0] === 1) {
            // pick-type projection
            toPush = { $set: {} };
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                toPush.$set[key] = fromDotNotation(doc, key);
                if (toPush.$set[key] === undefined) {
                    delete toPush.$set[key];
                }
            }
            toPush = modify({}, toPush, model);
        }
        else {
            // omit-type projection
            toPush = { $unset: {} };
            keys.forEach((k) => (toPush.$unset[k] = true));
            toPush = modify(doc, toPush, model);
        }
        if (keepId) {
            // by default will keep _id
            toPush._id = doc._id;
        }
        else {
            // unless defined otherwise
            delete toPush._id;
        }
        res.push(toPush);
    }
    return res;
}

var modelling = /*#__PURE__*/Object.freeze({
    __proto__: null,
    toDotNotation: toDotNotation,
    serialize: serialize,
    deserialize: deserialize,
    clone: clone,
    validateObject: validateObject,
    isPrimitiveType: isPrimitiveType,
    modify: modify,
    fromDotNotation: fromDotNotation,
    match: match,
    compare: compare,
    modifiersKeys: modifiersKeys,
    equal: equal,
    sort: sort,
    project: project
});

/**
 * Cursor class is responsible for querying documents
 * as well as sorting, skipping, limiting, and projections
 */
class Cursor {
    constructor(db, query) {
        this.db = db;
        this._query = query || {};
    }
    /**
     * Set a limit to the number of results
     */
    limit(limit) {
        this._limit = limit;
        return this;
    }
    /**
     * Skip a the number of results
     */
    skip(skip) {
        this._skip = skip;
        return this;
    }
    /**
     * Sort results of the query
     */
    sort(sortQuery) {
        this._sort = sortQuery;
        return this;
    }
    /**
     * Add the use of a projection
     */
    project(projection) {
        this._proj = projection;
        return this;
    }
    /**
     * Apply the projection
     */
    _doProject(documents) {
        if (this._proj === undefined || Object.keys(this._proj).length === 0)
            return documents;
        return project(documents, this._proj, this.db.model);
    }
    /**
     * Apply sorting
     */
    _doSort(documents) {
        if (this._sort === undefined || Object.keys(this._sort).length === 0)
            return documents;
        return sort(documents, this._sort);
    }
    /**
     * Executes the query
     * Will return pointers to matched elements (shallow copies)
     * hence its called "unsafe"
     */
    __exec_unsafe() {
        let res = [];
        // try cached
        let cached = this.db.cache.get(this._query);
        if (!cached) {
            // no cached: match candidates
            const candidates = this.db.getCandidates(this._query);
            for (let i = 0; i < candidates.length; i++) {
                if (match(candidates[i], this._query)) {
                    res.push(candidates[i]);
                }
            }
            // store in cache
            this.db.cache.storeOrProspect(this._query, res);
        }
        // cached found: use it
        else
            res = cached;
        // Apply all sorts
        if (this._sort) {
            res = this._doSort(res);
        }
        // Applying limit and skip
        if (this._limit || this._skip) {
            const limit = this._limit || res.length;
            const skip = this._skip || 0;
            res = res.slice(skip, skip + limit);
        }
        // Apply projection
        if (this._proj) {
            res = this._doProject(res);
        }
        return res;
    }
    /**
     * Executes the query safely (i.e. cloning documents)
     */
    exec() {
        const originalsArr = this.__exec_unsafe();
        const res = [];
        for (let index = 0; index < originalsArr.length; index++) {
            res.push(clone(originalsArr[index], this.db.model));
        }
        return res;
    }
}

/**
 * This is a data structure that is much similar to SortedDictionary in C#
 * Except for minor differences.
 * 		1.	It can hold multiple values per key
 * 		2.	Binary search for insertion & deletion
 * 		3.	Doesn't use red-black tree
 *
 * Complexity Notations:
 * 		# Get: O(1)
 * 		# Insert: O(log n)
 * 		# Delete: O(log n)
 *
 *
 * It supports duplicate keys, range queries, and custom comparator function.
 */
// handles conversion of keys into strings if they aren't of a comparable type
function unify(key) {
    let t = typeof key;
    if (t === "number" || t === "string" || t === "bigint") {
        return key;
    }
    else
        return JSON.stringify([[[key]]]);
}
class Dictionary {
    constructor({ fieldName, unique, c, }) {
        this.keys = [];
        this.documents = new Map();
        this.unique = false;
        this.fieldName = fieldName;
        this.comparator = c;
        this.unique = unique;
    }
    has(key) {
        return this.documents.has(unify(key));
    }
    insert(key, document) {
        key = unify(key);
        let list = this.documents.get(key);
        if (list && this.unique) {
            const err = new Error(`XWebDB: Can't insert key ${key}, it violates the unique constraint`);
            err.key = key;
            err.prop = this.fieldName;
            err.errorType = "uniqueViolated";
            throw err;
        }
        const index = this.findInsertionIndex(key);
        if (this.keys[index] !== key) {
            this.keys.splice(index, 0, key);
        }
        if (!list) {
            list = [];
            this.documents.set(key, list);
        }
        list.push(document);
    }
    get(key) {
        if (Array.isArray(key))
            return key.map((x) => this.get(unify(x))).flat(1);
        return this.documents.get(unify(key)) || [];
    }
    delete(key, document) {
        key = unify(key);
        const index = this.binarySearch(key);
        if (index === -1) {
            return false;
        }
        const bucket = this.documents.get(key) || [];
        bucket.splice(bucket.indexOf(document), 1);
        if (bucket.length === 0) {
            this.keys.splice(index, 1);
            this.documents.delete(key);
        }
        return true;
    }
    findInsertionIndex(key) {
        key = unify(key);
        let low = 0;
        let high = this.keys.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (this.comparator(this.keys[mid], key) === -1) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    binarySearch(key) {
        key = unify(key);
        let low = 0;
        let high = this.keys.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.comparator(this.keys[mid], key) === 0) {
                return mid;
            }
            else if (this.comparator(this.keys[mid], key) === -1) {
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        return -1;
    }
    $in(keys) {
        keys = keys.map((x) => unify(x));
        let matched = [];
        for (let index = 0; index < keys.length; index++) {
            let key = unify(keys[index]);
            matched = matched.concat(this.get(key));
        }
        return matched.filter((x, i) => matched.indexOf(x) === i);
    }
    $nin(dismissKeys) {
        dismissKeys = dismissKeys.map((x) => unify(x));
        let values = [];
        for (let index = 0; index < this.keys.length; index++) {
            let k = unify(this.keys[index]);
            if (!dismissKeys.includes(k))
                values = values.concat(this.get(k));
        }
        return values;
    }
    $ne(dismissKey) {
        dismissKey = unify(dismissKey);
        let values = [];
        for (let index = 0; index < this.keys.length; index++) {
            const k = unify(this.keys[index]);
            if (this.comparator(dismissKey, k) !== 0)
                values = values.concat(this.get(k));
        }
        return values;
    }
    betweenBounds(gt, gtInclusive, lt, ltInclusive) {
        let startIndex = 0;
        let endIndex = this.keys.length - 1;
        let matchedIndexes = [];
        while (startIndex <= endIndex) {
            let midIndex = Math.floor((startIndex + endIndex) / 2);
            let current = this.keys[midIndex];
            if (current < gt || (!gtInclusive && current === gt)) {
                startIndex = midIndex + 1;
            }
            else if (current > lt || (!ltInclusive && current === lt)) {
                endIndex = midIndex - 1;
            }
            else {
                // Found a value in range
                matchedIndexes.push(midIndex);
                // Look for more values in range to the left of the current index
                for (let i = midIndex - 1; i >= startIndex; i--) {
                    let current = this.keys[i];
                    if (current < gt || (!gtInclusive && current === gt)) {
                        break;
                    }
                    matchedIndexes.push(i);
                }
                // Look for more values in range to the right of the current index
                for (let i = midIndex + 1; i <= endIndex; i++) {
                    let current = this.keys[i];
                    if (current > lt || (!ltInclusive && current === lt)) {
                        break;
                    }
                    matchedIndexes.push(i);
                }
                break;
            }
        }
        matchedIndexes.sort((a, b) => a === b ? 0 : a > b ? 1 : -1);
        let data = [];
        for (let i = 0; i < matchedIndexes.length; i++) {
            const foundIndex = matchedIndexes[i];
            data = data.concat(this.get(this.keys[foundIndex]));
        }
        return data;
    }
    boundedQuery(query) {
        return this.betweenBounds(query["$gt"] || query["$gte"], !!query["$gte"], query["$lt"] || query["$lte"], !!query["$lte"]);
    }
    get all() {
        return Array.from(this.documents.values()).flat();
    }
    get numberOfKeys() {
        return this.keys.length;
    }
    get size() {
        return this.all.length;
    }
}

/**
 * Type-aware projection
 */
function projectForUnique(elt) {
    if (elt === null) {
        return "$NU";
    }
    if (typeof elt === "string") {
        return "$ST" + elt;
    }
    if (typeof elt === "boolean") {
        return "$BO" + elt;
    }
    if (typeof elt === "number") {
        return "$NO" + elt;
    }
    if (elt instanceof Date) {
        return "$DA" + elt.getTime();
    }
    return elt; // Arrays and objects, will check for pointer equality
}
function uniqueProjectedKeys(key) {
    return Array.from(new Set(key.map((x) => projectForUnique(x)))).map((key) => {
        if (typeof key === "string") {
            return key.substring(3);
        }
        else
            return key;
    });
}
class Index {
    constructor({ fieldName, unique, sparse, }) {
        this.unique = false;
        this.sparse = false;
        this.fieldName = fieldName;
        this.unique = !!unique;
        this.sparse = !!sparse;
        this.dict = new Dictionary({
            unique: this.unique,
            c: compare,
            fieldName: this.fieldName,
        });
    }
    /**
     * Resetting an index: i.e. removing all data from it
     */
    reset() {
        this.dict = new Dictionary({
            unique: this.unique,
            c: compare,
            fieldName: this.fieldName,
        });
    }
    /**
     * Insert a new document in the index
     * If an array is passed, we insert all its elements (if one insertion fails the index is not modified, atomic)
     * O(log(n))
     */
    insert(doc) {
        if (Array.isArray(doc)) {
            return this.insertMultipleDocs(doc);
        }
        let key = fromDotNotation(doc, this.fieldName);
        // We don't index documents that don't contain the field if the index is sparse
        if (key === undefined && this.sparse) {
            return;
        }
        if (!Array.isArray(key)) {
            this.dict.insert(key, doc);
        }
        else {
            // if key is an array we'll consider each item as a key, and the document will be on each of them
            // If an insert fails due to a unique constraint, roll back all inserts before it
            let keys = uniqueProjectedKeys(key);
            let error;
            let failingIndex = -1;
            for (let i = 0; i < keys.length; i++) {
                try {
                    this.dict.insert(keys[i], doc);
                }
                catch (e) {
                    error = e;
                    failingIndex = i;
                    break;
                }
            }
            if (error) {
                for (let i = 0; i < failingIndex; i++) {
                    this.dict.delete(keys[i], doc);
                }
                throw error;
            }
        }
    }
    /**
     * Insert an array of documents in the index
     * If a constraint is violated, the changes should be rolled back and an error thrown
     *
     */
    insertMultipleDocs(docs) {
        let error;
        let failingI = -1;
        for (let i = 0; i < docs.length; i++) {
            try {
                this.insert(docs[i]);
            }
            catch (e) {
                error = e;
                failingI = i;
                break;
            }
        }
        if (error) {
            for (let i = 0; i < failingI; i++) {
                this.remove(docs[i]);
            }
            throw error;
        }
    }
    /**
     * Remove a document from the index
     * If an array is passed, we remove all its elements
     * The remove operation is safe with regards to the 'unique' constraint
     * O(log(n))
     */
    remove(doc) {
        if (Array.isArray(doc)) {
            return doc.forEach((d) => this.remove(d));
        }
        let key = fromDotNotation(doc, this.fieldName);
        if (key === undefined && this.sparse) {
            return;
        }
        if (!Array.isArray(key)) {
            this.dict.delete(key, doc);
        }
        else {
            uniqueProjectedKeys(key).forEach((_key) => this.dict.delete(_key, doc));
        }
    }
    /**
     * Update a document in the index
     * If a constraint is violated, changes are rolled back and an error thrown
     * Naive implementation, still in O(log(n))
     */
    update(oldDoc, newDoc) {
        if (Array.isArray(oldDoc)) {
            this.updateMultipleDocs(oldDoc);
            return;
        }
        else if (newDoc) {
            this.remove(oldDoc);
            try {
                this.insert(newDoc);
            }
            catch (e) {
                this.insert(oldDoc);
                throw e;
            }
        }
    }
    /**
     * Update multiple documents in the index
     * If a constraint is violated, the changes need to be rolled back
     * and an error thrown
     */
    updateMultipleDocs(pairs) {
        let failingI = -1;
        let error;
        for (let i = 0; i < pairs.length; i++) {
            this.remove(pairs[i].oldDoc);
        }
        for (let i = 0; i < pairs.length; i++) {
            try {
                this.insert(pairs[i].newDoc);
            }
            catch (e) {
                error = e;
                failingI = i;
                break;
            }
        }
        // If an error was raised, roll back changes in the inverse order
        if (error) {
            for (let i = 0; i < failingI; i++) {
                this.remove(pairs[i].newDoc);
            }
            for (let i = 0; i < pairs.length; i++) {
                this.insert(pairs[i].oldDoc);
            }
            throw error;
        }
    }
    /**
     * Revert an update
     */
    revertUpdate(oldDoc, newDoc) {
        var revert = [];
        if (!Array.isArray(oldDoc) && newDoc) {
            this.update(newDoc, oldDoc);
        }
        else if (Array.isArray(oldDoc)) {
            oldDoc.forEach((pair) => {
                revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
            });
            this.update(revert);
        }
    }
}

/**
 * Promise-base interface for interacting with indexedDB
 * This is where actual operations to IndexedDB occurs
 */
class IDB {
    constructor(name) {
        const request = indexedDB.open(name);
        request.onupgradeneeded = function () {
            this.result.createObjectStore(name).createIndex("idIndex", "_id", { unique: true });
        };
        const dbp = this.pr(request);
        this.store = (txMode, callback) => dbp.then((db) => callback(db.transaction(name, txMode, { durability: "relaxed" }).objectStore(name)));
    }
    /**
     * Converts IDB requests/transactions to promises.
     */
    pr(req) {
        return new Promise((resolve, reject) => {
            // @ts-ignore - file size hacks
            req.oncomplete = req.onsuccess = () => resolve(req.result);
            // @ts-ignore - file size hacks
            req.onabort = req.onerror = () => reject(req.error);
        });
    }
    /**
     * Converts cursor iterations to promises
     */
    eachCursor(store, callback) {
        store.openCursor().onsuccess = function () {
            if (!this.result)
                return;
            callback(this.result);
            this.result.continue();
        };
        return this.pr(store.transaction);
    }
    /**
     * Get a value by its key.
     */
    get(key) {
        return this.store("readonly", (store) => this.pr(store.get(key)));
    }
    /**
     * Get values for a given set of keys
    */
    async getBulk(keys) {
        return this.store("readonly", async (store) => {
            return Promise.all(keys.map((x) => this.pr(store.get(x))));
        });
    }
    /**
     * Set a value with a key.
     */
    set(key, value) {
        return this.store("readwrite", (store) => {
            store.put(value, key);
            return this.pr(store.transaction);
        });
    }
    /**
     * Set multiple values at once. This is faster than calling set() multiple times.
     * It's also atomic – if one of the pairs can't be added, none will be added.
     */
    setBulk(entries) {
        return this.store("readwrite", (store) => {
            entries.forEach((entry) => store.put(entry[1], entry[0]));
            return this.pr(store.transaction);
        });
    }
    /**
     * Delete multiple keys at once.
     *
     */
    delBulk(keys) {
        return this.store("readwrite", (store) => {
            keys.forEach((key) => store.delete(key));
            return this.pr(store.transaction);
        });
    }
    /**
     * Clear all values in the store.
     *
     */
    clear() {
        return this.store("readwrite", (store) => {
            store.clear();
            return this.pr(store.transaction);
        });
    }
    /**
     * Get all keys in the store.
     */
    keys() {
        return this.store("readonly", async (store) => {
            // Fast path for modern browsers
            if (store.getAllKeys) {
                return this.pr(store.getAllKeys());
            }
            const items = [];
            await this.eachCursor(store, (cursor) => items.push(cursor.key));
            return items;
        });
    }
    /**
     * Get all documents in the store.
     */
    documents() {
        return this.store("readonly", async (store) => {
            // Fast path for modern browsers
            if (store.getAll) {
                return this.pr(store.getAll());
            }
            const items = [];
            await this.eachCursor(store, (cursor) => items.push(cursor.value));
            return items;
        });
    }
    /**
     * Get key by ID (since keys are ID_REV)
     */
    async byID(_id) {
        return this.store("readonly", (store) => {
            return this.pr(store.index("idIndex").getKey(_id));
        });
    }
    /**
     * Get length of the DB
     */
    async length() {
        return (await this.keys()).length;
    }
}

/**
 * This is the synchronization class that uses the remote sync adapter
 * to send and receive data.
 * How it does it:
 *
 * Considering that the persistence layer is actually a key/value store
 * It sets the key to: {ID}_{Rev}
 * where 	{ID}: is document ID
 * 			{Rev}: is document revision
 *
 * And each database (local & remote) has a special document ($H)
 * where it stores a value that once not equal between two DBs they should sync
 *
 * When calling the _sync() method:
 * 1. it compares the local and remote $H if they are equal, it stops
 * 2. gets the difference between the two databases
 * 3. resolves conflicts by last-write wins algorithm (can't be otherwise)
 * 4. resolves errors that can be caused by unique violation constraints (also by last-write wins)
 * 5. uploads and downloads documents
 * 6. documents that win overwrite documents that lose
 * 7. sets local and remote $H
 *
 * This is a very simple synchronization protocol, but it has the following advantages
 * 		A. it uses the least amount of data overhead
 * 			i.e. there's no need for compression, logs, compaction...etc.
 * 		B. there's no need for custom conflict resolution strategies
 *
 * However, there's drawbacks:
 * 		A. Can't use custom conflict resolution strategies if there's a need
 * 		B. updates on different fields of the documents can't get merged (last write-wins always)
 * 		C. Can't get a history of the document (do we need it?)
 */
const asc = (a, b) => (a > b ? 1 : -1);
class Sync {
    constructor(persistence, rdata) {
        this.p = persistence;
        this.rdata = rdata;
    }
    // set local $H
    async setL$(unique) {
        await this.p.data.set("$H", { _id: "$H" + unique });
    }
    // set remote $H
    async setR$(unique) {
        await this.rdata.set("$H", JSON.stringify({ _id: "$H" + unique }));
    }
    // uniform value for both local and remote $H
    async unify$H() {
        const unique = Math.random().toString(36).substring(2);
        await this.setL$(unique);
        await this.setR$(unique);
    }
    /**
     * This method sits in-front of the actually _sync method
     * It checks whether there's an already a sync in progress
     * and whether there are deferred writes or deletes
     */
    sync() {
        if (this.p.syncInProgress || // should not sync when there's already a sync in progress
            this.p.db.deferredDeletes.length + this.p.db.deferredWrites.length // should not sync when there's deferred write/deletes about to happen
        ) {
            return new Promise((resolve) => {
                setTimeout(() => resolve(this.sync()), 0);
            });
        }
        else
            return new Promise((resolve, reject) => {
                this.p.syncInProgress = true;
                this._sync()
                    .then((sRes) => {
                    resolve(sRes);
                })
                    .catch(reject)
                    .finally(() => {
                    this.p.syncInProgress = false;
                });
            });
    }
    /**
     * When finding a diff, decide what to do with it:
     * "this" means docs that should be uploaded
     * "that" means docs that should be downloaded		--> or vice versa
     * A. if there's a conflict (a key should be downloaded & uploaded at the same sync instance)
     * 		Decide a winner:
     * 			"this" wins: remove it from "that" and add it to "this"
     * 			"that" wins: don't do anything
     * B. No conflict: add it regularly
     *
     * in total: this adds and removes from two arrays,
     * one array is of docs that should be uploaded
     * and one of docs that should be downloaded
     */
    async decide(key, thisDiffs, thatDiffs) {
        const _id = key.split("_")[0];
        const rev = key.split("_")[1];
        const thisTime = Number(rev.substring(2));
        const conflictingIndex = thatDiffs.findIndex((x) => x.startsWith(_id + "_"));
        if (conflictingIndex > -1) {
            const conflicting = thatDiffs[conflictingIndex];
            const conflictingRev = conflicting.split("_")[1];
            const conflictingTime = Number(conflictingRev.substring(2));
            if (thisTime > conflictingTime) {
                // this wins
                thatDiffs.splice(conflictingIndex, 1); // removing that
                thisDiffs.push(key);
            }
            // else { }
            // otherwise .. don't add this diff, and keep that diff
            // (i.e. do nothing here, no else)
        }
        else {
            thisDiffs.push(key);
        }
    }
    /**
     * This checks whether an update would cause a unique constraint violation
     * by actually adding to indexes (if it's a doc)
     * or by creating a new index (if it's an index)
     */
    UCV(input) {
        try {
            if (!input.$$indexCreated) {
                input = clone(input, this.p._model);
                // i.e. document
                // don't cause UCV by _id (without this line all updates would trigger UCV)
                // _id UCVs conflicts are only natural
                // and solved by the fact that they are persisted on the same key
                input._id = uid();
                this.p.db.addToIndexes(input);
                this.p.db.removeFromIndexes(input);
            }
            else {
                this.p.db.indexes[input.$$indexCreated.fieldName] = new Index(input.$$indexCreated);
                this.p.db.indexes[input.$$indexCreated.fieldName].insert(this.p.db.getAllData());
                delete this.p.db.indexes[input.$$indexCreated.fieldName];
            }
        }
        catch (e) {
            if (!input.$$indexCreated) {
                return {
                    type: "doc",
                    prop: e.prop,
                    value: e.key,
                };
            }
            else {
                delete this.p.db.indexes[input.$$indexCreated.fieldName];
                return {
                    type: "index",
                    fieldName: input.$$indexCreated.fieldName,
                    sparse: !!input.$$indexCreated.sparse,
                };
            }
        }
        return false;
    }
    /**
     * Compare the local and remote $H
     * if there's a difference:
     * 		A. get a diff of the keys
     * 		B. decide which documents to upload and to download (using the above strategy)
     * 		C. Sets remote and local $H
     * 		D. returns the number of sent and received documents
     * 			in addition to a number indicating whether this method actually did a sync
     * 			-1: $H are equal, didn't do anything
     * 			0: $H are different, but keys are equal, just updated the $H
     * 			1: found a diff in documents and did a full synchronization process.
     */
    async _sync(force = false) {
        const r$H = (await this.rdata.get("$H")) || "0";
        const l$H = JSON.stringify((await this.p.data.get("$H")) || 0);
        if (!force && (l$H === r$H || (l$H === "0" && (r$H || "").indexOf("10009") > -1))) {
            return { sent: 0, received: 0, diff: -1 };
        }
        const remoteKeys = (await this.rdata.keys()).sort(asc);
        const localKeys = (await this.p.data.keys()).sort(asc);
        remoteKeys.splice(remoteKeys.indexOf("$H"), 1); // removing $H
        localKeys.splice(localKeys.indexOf("$H"), 1);
        const remoteDiffsKeys = [];
        const localDiffsKeys = [];
        const rl = remoteKeys.length;
        let ri = 0;
        const ll = localKeys.length;
        let li = 0;
        while (ri < rl || li < ll) {
            let rv = remoteKeys[ri];
            let lv = localKeys[li];
            if (rv === lv) {
                ri++;
                li++;
                continue;
            }
            else if (li === ll || asc(lv, rv) > 0) {
                ri++;
                await this.decide(rv, remoteDiffsKeys, localDiffsKeys);
            }
            else {
                li++;
                await this.decide(lv, localDiffsKeys, remoteDiffsKeys);
            }
        }
        if (remoteDiffsKeys.length === 0 && localDiffsKeys.length === 0) {
            // set local $H to remote $H value
            await this.setL$(r$H.replace(/.*\$H(.*)"}/, "$1"));
            return { sent: 0, received: 0, diff: 0 };
        }
        // downloading
        const downRemove = [];
        const downSetValues = remoteDiffsKeys.length
            ? (await this.rdata.getBulk(remoteDiffsKeys)).map((x) => deserialize(this.p.decode(x || "{}")))
            : [];
        const downSet = [];
        for (let index = 0; index < remoteDiffsKeys.length; index++) {
            const diff = remoteDiffsKeys[index];
            const UCV = this.UCV(downSetValues[index]);
            // if unique constraint violations occurred
            // make the key non-unique
            // any other implementation would result in unjustified complexity
            if (UCV && UCV.type === "doc") {
                const uniqueProp = UCV.prop;
                await this.p.data.set(localKeys.find((x) => x.startsWith(uniqueProp + "_")) || "", {
                    _id: uniqueProp,
                    $$indexCreated: {
                        fieldName: uniqueProp,
                        unique: false,
                        sparse: this.p.db.indexes[uniqueProp].sparse,
                    },
                });
            }
            else if (UCV && UCV.type === "index") {
                downSetValues[index] = {
                    $$indexCreated: {
                        fieldName: UCV.fieldName,
                        unique: false,
                        sparse: UCV.sparse,
                    },
                    _id: UCV.fieldName,
                };
            }
            const diff_id_ = diff.split("_")[0] + "_";
            const oldIDRev = localKeys.find((key) => key.startsWith(diff_id_)) || "";
            if (oldIDRev)
                downRemove.push(oldIDRev);
            downSet.push([diff, downSetValues[index]]);
        }
        await this.p.data.delBulk(downRemove);
        await this.p.data.setBulk(downSet);
        // uploading
        const upRemove = [];
        const upSetValues = localDiffsKeys.length
            ? await this.p.data.getBulk(localDiffsKeys)
            : [];
        const upSet = [];
        for (let index = 0; index < localDiffsKeys.length; index++) {
            const diff = localDiffsKeys[index];
            const diff_id_ = diff.split("_")[0] + "_";
            const oldIDRev = remoteKeys.find((key) => key.startsWith(diff_id_)) || "";
            if (oldIDRev)
                upRemove.push(oldIDRev);
            upSet.push([
                diff,
                upSetValues[index]
                    ? this.p.encode(serialize(upSetValues[index]))
                    : "",
            ]);
        }
        await this.rdata.delBulk(upRemove);
        await this.rdata.setBulk(upSet);
        await this.p.db.loadDatabase();
        try {
            this.p.db.live.update();
        }
        catch (e) {
            console.error(`XWebDB: Could not do live updates due to an error:`, e);
        }
        await this.unify$H();
        return {
            sent: localDiffsKeys.length,
            received: remoteDiffsKeys.length,
            diff: 1,
        };
    }
}

/**
 * Persistence layer class
 * Actual IndexedDB operations are in "idb.ts"
 * This class mainly process data and prepares it prior idb.ts
 */
/**
 * Create a new Persistence object for database options.db
 */
class Persistence {
    constructor(options) {
        this.ref = "";
        this.syncInterval = 0;
        this.syncInProgress = false;
        this.corruptAlertThreshold = 0.1;
        this.encode = (s) => s;
        this.decode = (s) => s;
        this.stripDefaults = false;
        this._model = Doc;
        this.shouldEncode = false;
        this._model = options.model || this._model;
        this.db = options.db;
        this.ref = this.db.ref;
        this.data = new IDB(this.ref);
        this.stripDefaults = options.stripDefaults || false;
        this.RSA = options.syncToRemote;
        this.syncInterval = options.syncInterval || 0;
        if (this.RSA) {
            const remoteData = this.RSA(this.ref);
            this.sync = new Sync(this, remoteData);
        }
        if (this.RSA && this.syncInterval) {
            setInterval(async () => {
                if (!this.syncInProgress) {
                    let err = undefined;
                    this.syncInProgress = true;
                    try {
                        await this.sync._sync();
                    }
                    catch (e) {
                        err = e;
                    }
                    this.syncInProgress = false;
                    if (err)
                        throw new Error(err);
                }
            }, this.syncInterval);
        }
        this.corruptAlertThreshold =
            options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;
        // encode and decode hooks with some basic sanity checks
        if (options.encode && !options.decode) {
            throw new Error("XWebDB: encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent data loss");
        }
        if (!options.encode && options.decode) {
            throw new Error("XWebDB: decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent data loss");
        }
        this.encode = options.encode || this.encode;
        this.decode = options.decode || this.decode;
        let randomString = uid();
        if (this.decode(this.encode(randomString)) !== randomString) {
            throw new Error("XWebDB: encode is not the reverse of decode, cautiously refusing to start data store to prevent data loss");
        }
        this.shouldEncode = !!options.encode && !!options.decode;
    }
    /**
     * serializes & writes a new index using the $$ notation.
     */
    async writeNewIndex(newIndexes) {
        return await this.writeData(newIndexes.map((x) => [
            x.$$indexCreated.fieldName,
            { _id: x.$$indexCreated.fieldName, ...x },
        ]));
    }
    /**
     * Copies, strips all default data, and serializes documents then writes it.
     */
    async writeNewData(newDocs) {
        // stripping defaults
        newDocs = deserialize(serialize({ t: newDocs })).t; // avoid triggering live queries when stripping default
        for (let index = 0; index < newDocs.length; index++) {
            let doc = newDocs[index];
            if (doc._stripDefaults) {
                newDocs[index] = doc._stripDefaults();
            }
        }
        return await this.writeData(newDocs.map((x) => [x._id, x]));
    }
    /**
     * Load the database
     * 1. Reset all indexes
     * 2. Create all indexes
     * 3. Add data to indexes
     */
    async loadDatabase() {
        this.db.q.pause();
        this.db.resetIndexes(true);
        let corrupt = 0;
        let processed = 0;
        const data = [];
        const persisted = await this.readData();
        for (let index = 0; index < persisted.length; index++) {
            processed++;
            const line = persisted[index];
            if (line === null) {
                corrupt++;
                continue;
            }
            if (line.$$indexCreated) {
                this.db.indexes[line.$$indexCreated.fieldName] = new Index({
                    fieldName: line.$$indexCreated.fieldName,
                    unique: line.$$indexCreated.unique,
                    sparse: line.$$indexCreated.sparse,
                });
            }
            else {
                data.push(this._model.new(line));
            }
        }
        for (let index = 0; index < data.length; index++) {
            const line = data[index];
            this.db.addToIndexes(line);
        }
        if (processed > 0 && corrupt / processed > this.corruptAlertThreshold) {
            throw new Error(`XWebDB: More than ${Math.floor(100 * this.corruptAlertThreshold)}% of the data file is corrupt, the wrong decode hook might have been used. Cautiously refusing to start Datastore to prevent dataloss`);
        }
        this.db.q.start();
        return true;
    }
    /**
     * Reads data from the database
     * (excluding $H and documents that actually $deleted)
     */
    async readData() {
        let all = await this.data.documents();
        let res = [];
        for (let index = 0; index < all.length; index++) {
            let line = all[index];
            // corrupt
            if (typeof line !== "object" || line === null) {
                res.push(null);
                continue;
            }
            // skip $H & deleted documents
            if ((line._id && line._id.startsWith("$H")) || line.$$deleted)
                continue;
            // skip lines that is neither an index nor document
            if (line._id === undefined && line.$$indexCreated === undefined)
                continue;
            // decode encoded
            if (line._encoded)
                line = deserialize(this.decode(line._encoded));
            res.push(line);
        }
        return res;
    }
    /**
     * Given that IndexedDB documents ID has the following structure:
     * {ID}_{Rev}
     * 		where 	{ID} is the actual document ID
     * 				{Rev} is a random string of two characters + timestamp
     *
     * Deletes data (in bulk)
     * by
     * 		1. getting all the document (or index) old revisions and deleting them
     * 		2. then setting a new document with the same ID but a newer rev with the $deleted value
     * 		3. then setting $H to a value indicating that a sync operation should progress
     */
    async deleteData(_ids) {
        if (!this.RSA) {
            await this.data.delBulk(_ids);
            return _ids;
        }
        const oldIDRevs = [];
        const newIDRevs = [];
        for (let index = 0; index < _ids.length; index++) {
            const _id = _ids[index];
            const oldIDRev = (await this.data.byID(_id)) || "";
            const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
            const newIDRev = _id + "_" + newRev;
            oldIDRevs.push(oldIDRev.toString());
            newIDRevs.push([newIDRev, { _id, _rev: newRev, $$deleted: true }]);
        }
        await this.data.delBulk(oldIDRevs);
        await this.data.setBulk(newIDRevs);
        if (this.sync)
            await this.sync.setL$("updated");
        return _ids;
    }
    /**
     * Given that IndexedDB documents ID has the following structure:
     * {ID}_{Rev}
     * 		where 	{ID} is the actual document ID
     * 				{Rev} is a random string of two characters + timestamp
     *
     * writes data (in bulk) (inserts & updates)
     * by: 	1. getting all the document (or index) old revisions and deleting them
     * 		2. then setting a new document with the same ID but a newer rev with the new value
     * 			(i.e. a serialized version of the document)
     * 		3. then setting $H to a value indicating that a sync operation should progress
     */
    async writeData(input) {
        if (!this.RSA) {
            if (this.shouldEncode)
                input = input.map((x) => [
                    x[0],
                    { _id: x[1]._id, _encoded: this.encode(serialize(x[1])) },
                ]);
            await this.data.setBulk(input);
            return input.map((x) => x[0]);
        }
        const oldIDRevs = [];
        const newIDRevsData = [];
        for (let index = 0; index < input.length; index++) {
            const element = input[index];
            const oldIDRev = (await this.data.byID(element[0])) || "";
            const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
            const newIDRev = element[0] + "_" + newRev;
            element[1]._rev = newRev;
            oldIDRevs.push(oldIDRev.toString());
            if (this.shouldEncode) {
                element[1] = {
                    _encoded: this.encode(serialize(element[1])),
                    _id: element[1]._id,
                    _rev: element[1]._rev,
                };
            }
            newIDRevsData.push([newIDRev, element[1]]);
        }
        await this.data.delBulk(oldIDRevs);
        await this.data.setBulk(newIDRevsData);
        if (this.sync)
            await this.sync.setL$("updated");
        return input.map((x) => x[0]);
    }
    /**
     * Deletes all data
     * deletions will NOT sync
     */
    async deleteEverything() {
        await this.data.clear();
    }
}

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

/**
 * Updates the observable array (i.e. live query)
 * when a database change occurs, only if the query would give a different result
 * It basically achieves that by having an array of all the live queries taken from the database
 * Then on every update (insert/update/delete ... check datastore.ts) it checks the old result
 * and updates the observable array (live query result) if they're not the same
*/
function hash(res) {
    return dHash(JSON.stringify(res));
}
class Live {
    constructor(db) {
        this.queries = [];
        this.db = db;
    }
    addLive(q) {
        q.id = uid();
        this.queries.push(q);
        return q.id;
    }
    async update() {
        for (let index = 0; index < this.queries.length; index++) {
            const q = this.queries[index];
            this.db.cache.evict();
            const newRes = await this.db.find(q.query);
            const newHash = hash(newRes);
            const oldHash = hash(q.observable.observable);
            if (newHash === oldHash)
                continue;
            let u = await q.observable.unobserve(q.toDBObserver);
            q.observable.observable.splice(0);
            q.observable.observable.push(...newRes);
            if (u.length)
                q.observable.observe(q.toDBObserver);
        }
    }
    kill(uid) {
        const index = this.queries.findIndex((q) => q.id === uid);
        if (index > -1) {
            this.queries.splice(index, 1);
        }
    }
}

/**
 * Caching class
 * using a javascript Map, dHash of the query as a key, result (and usage counter) as value
 * call "get" to get from cache (would return undefined) if not found
 * call "storeOrProspect" on every query that hasn't been found in cache
 * call "evict" to validate specific query or all queries from this cache
 */
class Cache {
    constructor(limit = 1000) {
        this.cached = new Map();
        this.prospected = {};
        this.limit = limit;
    }
    /**
     * Generates a unique cache key for a given query.
     * @param query The query object.
     * @returns The cache key.
     */
    toKey(query) {
        return dHash(JSON.stringify(query));
    }
    /**
     * Retrieves the cached results for a given query.
     * @param query The query object.
     * @returns The cached results or undefined if not found.
     */
    get(query) {
        let hashed = this.toKey(query);
        let cached = this.cached.get(hashed);
        if (cached) {
            this.prospected[hashed]++;
            return cached;
        }
        else
            return undefined;
    }
    /**
     * Stores or prospects a query and its results in the cache.
     * @param query The query object.
     * @param res The results to be cached.
     */
    storeOrProspect(query, res) {
        let newHashed = this.toKey(query);
        if (this.cached.has(newHashed)) {
            return;
        }
        if (this.prospected[newHashed]) {
            this.prospected[newHashed]++;
            this.cached.set(newHashed, res);
            if (this.cached.size > this.limit) {
                let leastUsed = { usage: Infinity, key: 0 };
                for (const key of this.cached.keys()) {
                    // if it's just 2, then it has only prospected then added
                    if (this.prospected[key] === 2 && key !== newHashed) {
                        this.cached.delete(key);
                        leastUsed.key = 0;
                        break;
                    }
                    else if (this.prospected[key] < leastUsed.usage) {
                        leastUsed.usage = this.prospected[key];
                        leastUsed.key = key;
                    }
                }
                if (leastUsed.key !== 0)
                    this.cached.delete(leastUsed.key);
            }
        }
        else {
            this.prospected[newHashed] = 1;
        }
    }
    /**
     * Evicts the cached results for a given query or clears the entire cache.
     * @param query Optional query object to evict specific results.
     */
    evict(query) {
        if (query) {
            this.cached.delete(this.toKey(query));
        }
        else {
            this.cached.clear();
        }
    }
}

class Datastore {
    constructor(options) {
        this.ref = "db";
        this.timestampData = false;
        this.live = new Live(this);
        // rename to something denotes that it's an internal thing
        this.q = new Q(1);
        this.indexes = {
            _id: new Index({ fieldName: "_id", unique: true }),
        };
        this.initIndexes = [];
        this.defer = false;
        this.deferredWrites = [];
        this.deferredDeletes = [];
        this.model = options.model || Doc;
        if (options.ref) {
            this.ref = options.ref;
        }
        this.cache = new Cache(options.cacheLimit);
        // Persistence handling
        this.persistence = new Persistence({
            db: this,
            model: options.model,
            encode: options.encode,
            decode: options.decode,
            corruptAlertThreshold: options.corruptAlertThreshold || 0,
            syncToRemote: options.syncToRemote,
            syncInterval: options.syncInterval,
            stripDefaults: options.stripDefaults,
        });
        this.initIndexes = options.indexes || [];
        this.timestampData = !!options.timestampData;
        if (typeof options.defer === "number" && !isNaN(options.defer)) {
            this.defer = true;
            setInterval(async () => {
                if (this.persistence.syncInProgress)
                    return; // should not process deferred while sync in progress
                else
                    this._processDeferred();
            }, options.defer);
        }
    }
    async _processDeferred() {
        if (this.deferredDeletes.length) {
            try {
                const done = await this.persistence.deleteData(this.deferredDeletes);
                this.deferredDeletes = this.deferredDeletes.filter((_id) => done.indexOf(_id) === -1);
            }
            catch (e) {
                console.error("XWebDB: processing deferred deletes error", e);
                await this.loadDatabase();
            }
        }
        if (this.deferredWrites.length) {
            try {
                const done = await this.persistence.writeNewData(this.deferredWrites);
                this.deferredWrites = this.deferredWrites.filter((doc) => done.indexOf(doc._id || "") === -1);
            }
            catch (e) {
                console.error("XWebDB: processing deferred writes error", e);
                await this.loadDatabase();
            }
        }
    }
    /**
     * Load the database from indexedDB, and trigger the execution of buffered commands if any
     */
    async loadDatabase() {
        const loaded = await this.persistence.loadDatabase();
        for (let index = 0; index < this.initIndexes.length; index++) {
            const fieldName = this.initIndexes[index];
            if (!this.indexes[fieldName]) {
                await this.ensureIndex({ fieldName });
            }
        }
        this.cache.evict();
        return loaded;
    }
    /**
     * Get an array of all the data in the database
     */
    getAllData() {
        return this.indexes._id.dict.all;
    }
    /**
     * Reset all currently defined indexes
     */
    resetIndexes(alsoDelete = false) {
        Object.keys(this.indexes).forEach((i) => {
            if (alsoDelete && i !== "_id")
                return delete this.indexes[i];
            this.indexes[i].reset();
        });
    }
    /**
     * Ensure an index is kept for this field. Same parameters as lib/indexes
     * For now this function is synchronous, we need to test how much time it takes
     * We use an async API for consistency with the rest of the code
     */
    async ensureIndex(options) {
        options = options || {};
        if (!options.fieldName) {
            let err = new Error("XWebDB: Cannot create an index without a fieldName");
            err.missingFieldName = true;
            throw err;
        }
        if (this.indexes[options.fieldName] &&
            this.indexes[options.fieldName].unique === options.unique) {
            return { affectedIndex: options.fieldName };
        }
        this.indexes[options.fieldName] = new Index(options);
        // Index data
        try {
            this.indexes[options.fieldName].insert(this.getAllData());
        }
        catch (e) {
            delete this.indexes[options.fieldName];
            throw e;
        }
        // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
        await this.persistence.writeNewIndex([{ $$indexCreated: options }]);
        return {
            affectedIndex: options.fieldName,
        };
    }
    /**
     * Remove an index
     */
    async removeIndex(fieldName) {
        delete this.indexes[fieldName];
        await this.persistence.deleteData([fieldName]);
        return {
            affectedIndex: fieldName,
        };
    }
    /**
     * Add one or several document(s) to all indexes
     */
    addToIndexes(doc) {
        let failingIndex = -1;
        let error;
        const keys = Object.keys(this.indexes);
        for (let i = 0; i < keys.length; i++) {
            try {
                this.indexes[keys[i]].insert(doc);
            }
            catch (e) {
                failingIndex = i;
                error = e;
                break;
            }
        }
        // If an error happened, we need to rollback the insert on all other indexes
        if (error) {
            for (let i = 0; i < failingIndex; i++) {
                this.indexes[keys[i]].remove(doc);
            }
            throw error;
        }
    }
    /**
     * Remove one or several document(s) from all indexes
     */
    removeFromIndexes(doc) {
        Object.keys(this.indexes).forEach((i) => {
            this.indexes[i].remove(doc);
        });
    }
    updateIndexes(oldDoc, newDoc) {
        let failingIndex = -1;
        let error;
        const keys = Object.keys(this.indexes);
        for (let i = 0; i < keys.length; i++) {
            try {
                this.indexes[keys[i]].update(oldDoc, newDoc);
            }
            catch (e) {
                failingIndex = i;
                error = e;
                break;
            }
        }
        // If an error happened, we need to rollback the update on all other indexes
        if (error) {
            for (let i = 0; i < failingIndex; i++) {
                this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
            }
            throw error;
        }
    }
    fromDict(query) {
        let qClone = JSON.parse(JSON.stringify(query));
        let entries = Object.entries(qClone);
        if (entries.length && entries[0][0][0] !== "$")
            qClone = { $noTL: [qClone] };
        for (let [topLevel, arr] of Object.entries(qClone)) {
            if (topLevel !== "$noTL" && topLevel !== "$and")
                continue;
            for (let index = 0; index < arr.length; index++) {
                const segment = arr[index];
                for (let [field, v] of Object.entries(segment)) {
                    let index = this.indexes[field];
                    if (!index)
                        continue;
                    if (!v || Object.keys(v).length === 0 || Object.keys(v)[0][0] !== "$")
                        v = { $eq: v };
                    let entries = Object.entries(v);
                    for (let [o, c] of entries) {
                        if (o === "$not" &&
                            c !== null &&
                            typeof c == "object" &&
                            Object.keys(c)) {
                            // negate and put outside $not
                            if (c["$eq"])
                                (o = "$ne") && (c = c["$eq"]);
                            if (c["$ne"])
                                (o = "$eq") && (c = c["$ne"]);
                            if (c["$in"])
                                (o = "$nin") && (c = c["$in"]);
                            if (c["$nin"])
                                (o = "$in") && (c = c["$nin"]);
                            if (c["$gt"])
                                (o = "$lte") && (c = c["$gt"]) && (v["$lte"] = c);
                            if (c["$lte"])
                                (o = "$gt") && (c = c["$lte"]) && (v["$gt"] = c);
                            if (c["$lt"])
                                (o = "$gte") && (c = c["$lt"]) && (v["$gte"] = c);
                            if (c["$gte"])
                                (o = "$lt") && (c = c["$gte"]) && (v["$lt"] = c);
                        }
                        // use dict functions
                        if (o === "$eq")
                            return index.dict.get(c);
                        if (o === "$in")
                            return index.dict.$in(c);
                        if (v["$gt"] || v["$lt"] || v["$gte"] || v["lte"]) {
                            // if there are bounding matchers skip $ne & $nin
                            // since bounded matchers should technically be less & faster
                            continue;
                        }
                        if (o === "$ne")
                            return index.dict.$ne(c);
                        if (o === "$nin")
                            return index.dict.$nin(c);
                    }
                    if (v["$gt"] || v["$lt"] || v["$gte"] || v["lte"]) {
                        return index.dict.betweenBounds(v["$gt"] || v["$gte"], !!v["$gte"], v["$lt"] || v["$lte"], !!v["$lte"]);
                    }
                }
            }
        }
        return null;
    }
    /**
     * Return the list of candidates for a given query
     * Crude implementation for now, we return the candidates given by the first usable index if any
     * We try the following query types, in this order: basic match, $in match, comparison match
     * One way to make it better would be to enable the use of multiple indexes if the first usable index
     * returns too much data. I may do it in the future.
     *
     * Returned candidates will be scanned to find and remove all expired documents
     */
    getCandidates(query) {
        return this.fromDict(query) || this.getAllData();
    }
    /**
     * Insert a new document
     */
    async insert(newDoc) {
        // unify input to array
        let w = Array.isArray(newDoc) ? newDoc : [newDoc];
        /**
         * Clone all documents, add _id, add timestamps and validate
         * then add to indexes
         * if an error occurred rollback everything
         */
        let cloned = [];
        let failingI = -1;
        let error;
        for (let index = 0; index < w.length; index++) {
            cloned[index] = clone(w[index], this.model);
            if (cloned[index]._id === undefined) {
                cloned[index]._id = this.createNewId();
            }
            if (this.timestampData) {
                let now = new Date();
                if (cloned[index].createdAt === undefined) {
                    cloned[index].createdAt = now;
                }
                if (cloned[index].updatedAt === undefined) {
                    cloned[index].updatedAt = now;
                }
            }
            validateObject(cloned[index]);
            try {
                this.addToIndexes(cloned[index]);
            }
            catch (e) {
                error = e;
                failingI = index;
                break;
            }
        }
        if (error) {
            for (let i = 0; i < failingI; i++) {
                this.removeFromIndexes(cloned[i]);
            }
            throw error;
        }
        this.cache.evict();
        try {
            this.live.update();
        }
        catch (e) {
            console.error(`XWebDB: Could not do live updates due to an error:`, e);
        }
        if (this.defer)
            this.deferredWrites.push(...cloned);
        else
            await this.persistence.writeNewData(cloned);
        return {
            docs: clone(cloned, this.model),
            number: cloned.length,
        };
    }
    /**
     * Create a new _id that's not already in use
     */
    createNewId() {
        let newID = uid();
        if (this.indexes._id.dict.has(newID)) {
            newID = this.createNewId();
        }
        return newID;
    }
    /**
     * Count all documents matching the query
     */
    async count(query) {
        const cursor = new Cursor(this, query);
        return (await cursor.exec()).length;
    }
    /**
     * Find all documents matching the query
     */
    async find(query) {
        const cursor = new Cursor(this, query);
        const docs = await cursor.exec();
        return docs;
    }
    /**
     * Find all documents matching the query
     */
    cursor(query) {
        const cursor = new Cursor(this, query);
        return cursor;
    }
    /**
     * Update all docs matching query
     */
    async _update(query, updateQuery, options) {
        let multi = options.multi !== undefined ? options.multi : false;
        let upsert = options.upsert !== undefined ? options.upsert : false;
        const cursor = new Cursor(this, query);
        cursor.limit(1);
        const res = cursor.__exec_unsafe();
        if (res.length > 0) {
            let numReplaced = 0;
            const candidates = this.getCandidates(query);
            const modifications = [];
            // Preparing update (if an error is thrown here neither the datafile nor
            // the in-memory indexes are affected)
            for (let i = 0; i < candidates.length; i++) {
                if ((multi || numReplaced === 0) && match(candidates[i], query)) {
                    numReplaced++;
                    let createdAt = candidates[i].createdAt;
                    let modifiedDoc = modify(candidates[i], updateQuery, this.model);
                    if (createdAt) {
                        modifiedDoc.createdAt = createdAt;
                    }
                    if (this.timestampData &&
                        updateQuery.updatedAt === undefined &&
                        (!updateQuery.$set || updateQuery.$set.updatedAt === undefined)) {
                        modifiedDoc.updatedAt = new Date();
                    }
                    modifications.push({
                        oldDoc: candidates[i],
                        newDoc: modifiedDoc,
                    });
                }
            }
            // Change the docs in memory
            this.updateIndexes(modifications);
            this.cache.evict();
            try {
                this.live.update();
            }
            catch (e) {
                console.error(`XWebDB: Could not do live updates due to an error:`, e);
            }
            // Update indexedDB
            const updatedDocs = modifications.map((x) => x.newDoc);
            if (this.defer)
                this.deferredWrites.push(...updatedDocs);
            else
                await this.persistence.writeNewData(updatedDocs);
            return {
                number: updatedDocs.length,
                docs: updatedDocs.map((x) => clone(x, this.model)),
                upsert: false,
            };
        }
        else if (res.length === 0 && upsert) {
            if (!updateQuery.$setOnInsert) {
                throw new Error("XWebDB: $setOnInsert modifier is required when upserting");
            }
            let toBeInserted = clone(updateQuery.$setOnInsert, this.model, true);
            const newDoc = await this.insert(toBeInserted);
            return { ...newDoc, upsert: true };
        }
        else {
            return {
                number: 0,
                docs: [],
                upsert: false,
            };
        }
    }
    async update(query, updateQuery, options) {
        return await this.q.add(() => this._update(query, updateQuery, options));
    }
    /**
     * Remove all docs matching the query
     * For now very naive implementation (similar to update)
     */
    async _remove(query, options) {
        let numRemoved = 0;
        const removedDocs = [];
        const removedFullDoc = [];
        let multi = options ? !!options.multi : false;
        const candidates = this.getCandidates(query);
        candidates.forEach((d) => {
            if (match(d, query) && (multi || numRemoved === 0)) {
                numRemoved++;
                removedFullDoc.push(clone(d, this.model));
                removedDocs.push({ $$deleted: true, _id: d._id });
                this.removeFromIndexes(d);
            }
        });
        this.cache.evict();
        try {
            this.live.update();
        }
        catch (e) {
            console.error(`XWebDB: Could not do live updates due to an error:`, e);
        }
        let d = removedDocs.map((x) => x._id || "");
        if (this.defer)
            this.deferredDeletes.push(...d);
        else
            await this.persistence.deleteData(d);
        return {
            number: numRemoved,
            docs: removedFullDoc,
        };
    }
    async remove(query, options) {
        return this.q.add(() => this._remove(query, options));
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

/**
 * Creating an an observable array
*/
const INSERT = "insert";
const UPDATE = "update";
const DELETE = "delete";
const REVERSE = "reverse";
const SHUFFLE = "shuffle";
const oMetaKey = Symbol.for("object-observer-meta-key-0");
function findGrandParent(observable) {
    if (observable.parent)
        return findGrandParent(observable.parent);
    else
        return observable;
}
function copy(v) {
    return JSON.parse(JSON.stringify({ tmp: v })).tmp;
}
function prepareObject(source, oMeta, visited) {
    const target = {};
    target[oMetaKey] = oMeta;
    for (const key in source) {
        target[key] = getObservedOf(source[key], key, oMeta, visited);
    }
    return target;
}
function prepareArray(source, oMeta, visited) {
    let l = source.length;
    const target = new Array(l);
    target[oMetaKey] = oMeta;
    for (let i = 0; i < l; i++) {
        target[i] = getObservedOf(source[i], i, oMeta, visited);
    }
    return target;
}
function callObserverSafe(listener, changes) {
    try {
        listener(changes);
    }
    catch (e) {
        console.error(`XWebDB: Failed to notify listener ${listener} with ${changes}`, e);
    }
}
function callObserversFromMT() {
    const batches = this.batches;
    this.batches = [];
    for (const [listener, changes] of batches) {
        callObserverSafe(listener, changes);
    }
}
function callObservers(oMeta, changes) {
    let currentObservable = oMeta;
    const l = changes.length;
    do {
        let observers = currentObservable.observers;
        let i = observers.length;
        while (i--) {
            let target = observers[i];
            if (changes.length) {
                if (currentObservable.batches.length === 0) {
                    // @ts-ignore
                    queueMicrotask(callObserversFromMT.bind(currentObservable));
                }
                let rb;
                for (const batch of currentObservable.batches) {
                    if (batch[0] === target) {
                        rb = batch;
                        break;
                    }
                }
                if (!rb) {
                    rb = [target, []];
                    currentObservable.batches.push(rb);
                }
                Array.prototype.push.apply(rb[1], changes);
            }
        }
        //	cloning all the changes and notifying in context of parent
        const parent = currentObservable.parent;
        if (parent) {
            for (let j = 0; j < l; j++) {
                const change = changes[j];
                changes[j] = new Change(change.type, [currentObservable.ownKey, ...change.path], change.value, change.oldValue, change.object, copy(findGrandParent(currentObservable).proxy));
            }
            currentObservable = parent;
        }
        else {
            currentObservable = null;
        }
    } while (currentObservable);
}
function getObservedOf(item, key, parent, visited) {
    if (visited !== undefined && visited.has(item)) {
        return null;
    }
    else if (typeof item !== "object" || item === null) {
        return item;
    }
    else if (Array.isArray(item)) {
        return new ArrayOMeta({
            target: item,
            ownKey: key,
            parent: parent,
            visited,
        }).proxy;
    }
    else if (item instanceof Date) {
        return item;
    }
    else {
        return new ObjectOMeta({
            target: item,
            ownKey: key,
            parent: parent,
            visited,
        }).proxy;
    }
}
function proxiedPop() {
    const oMeta = this[oMetaKey], target = oMeta.target, poppedIndex = target.length - 1;
    let popResult = target.pop();
    if (popResult && typeof popResult === "object") {
        const tmpObserved = popResult[oMetaKey];
        if (tmpObserved) {
            popResult = tmpObserved.detach();
        }
    }
    const changes = [new Change(DELETE, [poppedIndex], undefined, popResult, this, copy(this))];
    callObservers(oMeta, changes);
    return popResult;
}
function proxiedPush() {
    const oMeta = this[oMetaKey], target = oMeta.target, l = arguments.length, pushContent = new Array(l), initialLength = target.length;
    for (let i = 0; i < l; i++) {
        pushContent[i] = getObservedOf(arguments[i], initialLength + i, oMeta);
    }
    const pushResult = Reflect.apply(target.push, target, pushContent);
    const changes = [];
    for (let i = initialLength, j = target.length; i < j; i++) {
        changes[i - initialLength] = new Change(INSERT, [i], target[i], undefined, this, copy(this));
    }
    callObservers(oMeta, changes);
    return pushResult;
}
function proxiedShift() {
    const oMeta = this[oMetaKey], target = oMeta.target;
    let shiftResult, i, l, item, tmpObserved;
    shiftResult = target.shift();
    if (shiftResult && typeof shiftResult === "object") {
        tmpObserved = shiftResult[oMetaKey];
        if (tmpObserved) {
            shiftResult = tmpObserved.detach();
        }
    }
    //	update indices of the remaining items
    for (i = 0, l = target.length; i < l; i++) {
        item = target[i];
        if (item && typeof item === "object") {
            tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                tmpObserved.ownKey = i;
            }
        }
    }
    const changes = [new Change(DELETE, [0], undefined, shiftResult, this, copy(this))];
    callObservers(oMeta, changes);
    return shiftResult;
}
function proxiedUnshift() {
    const oMeta = this[oMetaKey], target = oMeta.target, al = arguments.length, unshiftContent = new Array(al);
    for (let i = 0; i < al; i++) {
        unshiftContent[i] = getObservedOf(arguments[i], i, oMeta);
    }
    const unshiftResult = Reflect.apply(target.unshift, target, unshiftContent);
    for (let i = 0, l = target.length, item; i < l; i++) {
        item = target[i];
        if (item && typeof item === "object") {
            const tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                tmpObserved.ownKey = i;
            }
        }
    }
    //	publish changes
    const l = unshiftContent.length;
    const changes = new Array(l);
    for (let i = 0; i < l; i++) {
        changes[i] = new Change(INSERT, [i], target[i], undefined, this, copy(this));
    }
    callObservers(oMeta, changes);
    return unshiftResult;
}
function proxiedReverse() {
    const oMeta = this[oMetaKey], target = oMeta.target;
    let i, l, item;
    target.reverse();
    for (i = 0, l = target.length; i < l; i++) {
        item = target[i];
        if (item && typeof item === "object") {
            const tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                tmpObserved.ownKey = i;
            }
        }
    }
    const changes = [new Change(REVERSE, [], undefined, undefined, this, copy(this))];
    callObservers(oMeta, changes);
    return this;
}
function proxiedSort(comparator) {
    const oMeta = this[oMetaKey], target = oMeta.target;
    let i, l, item;
    target.sort(comparator);
    for (i = 0, l = target.length; i < l; i++) {
        item = target[i];
        if (item && typeof item === "object") {
            const tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                tmpObserved.ownKey = i;
            }
        }
    }
    const changes = [new Change(SHUFFLE, [], undefined, undefined, this, copy(this))];
    callObservers(oMeta, changes);
    return this;
}
function proxiedFill(filVal, start, end) {
    const oMeta = this[oMetaKey], target = oMeta.target, changes = [], tarLen = target.length, prev = target.slice(0);
    start =
        start === undefined
            ? 0
            : start < 0
                ? Math.max(tarLen + start, 0)
                : Math.min(start, tarLen);
    end =
        end === undefined
            ? tarLen
            : end < 0
                ? Math.max(tarLen + end, 0)
                : Math.min(end, tarLen);
    if (start < tarLen && end > start) {
        target.fill(filVal, start, end);
        let tmpObserved;
        for (let i = start, item, tmpTarget; i < end; i++) {
            item = target[i];
            target[i] = getObservedOf(item, i, oMeta);
            if (i in prev) {
                tmpTarget = prev[i];
                if (tmpTarget && typeof tmpTarget === "object") {
                    tmpObserved = tmpTarget[oMetaKey];
                    if (tmpObserved) {
                        tmpTarget = tmpObserved.detach();
                    }
                }
                changes.push(new Change(UPDATE, [i], target[i], tmpTarget, this, copy(this)));
            }
            else {
                changes.push(new Change(INSERT, [i], target[i], undefined, this, copy(this)));
            }
        }
        callObservers(oMeta, changes);
    }
    return this;
}
function proxiedCopyWithin(dest, start, end) {
    const oMeta = this[oMetaKey], target = oMeta.target, tarLen = target.length;
    dest = dest < 0 ? Math.max(tarLen + dest, 0) : dest;
    start =
        start === undefined
            ? 0
            : start < 0
                ? Math.max(tarLen + start, 0)
                : Math.min(start, tarLen);
    end =
        end === undefined
            ? tarLen
            : end < 0
                ? Math.max(tarLen + end, 0)
                : Math.min(end, tarLen);
    const len = Math.min(end - start, tarLen - dest);
    if (dest < tarLen && dest !== start && len > 0) {
        const prev = target.slice(0), changes = [];
        target.copyWithin(dest, start, end);
        for (let i = dest, nItem, oItem, tmpObserved; i < dest + len; i++) {
            //	update newly placed observables, if any
            nItem = target[i];
            if (nItem && typeof nItem === "object") {
                nItem = getObservedOf(nItem, i, oMeta);
                target[i] = nItem;
            }
            //	detach overridden observables, if any
            oItem = prev[i];
            if (oItem && typeof oItem === "object") {
                tmpObserved = oItem[oMetaKey];
                if (tmpObserved) {
                    oItem = tmpObserved.detach();
                }
            }
            if (typeof nItem !== "object" && nItem === oItem) {
                continue;
            }
            changes.push(new Change(UPDATE, [i], nItem, oItem, this, copy(this)));
        }
        callObservers(oMeta, changes);
    }
    return this;
}
function proxiedSplice() {
    const oMeta = this[oMetaKey], target = oMeta.target, splLen = arguments.length, spliceContent = new Array(splLen), tarLen = target.length;
    //	make newcomers observable
    for (let i = 0; i < splLen; i++) {
        spliceContent[i] = getObservedOf(arguments[i], i, oMeta);
    }
    //	calculate pointers
    const startIndex = splLen === 0
        ? 0
        : spliceContent[0] < 0
            ? tarLen + spliceContent[0]
            : spliceContent[0], removed = splLen < 2 ? tarLen - startIndex : spliceContent[1], inserted = Math.max(splLen - 2, 0), spliceResult = Reflect.apply(target.splice, target, spliceContent), newTarLen = target.length;
    //	re-index the paths
    let tmpObserved;
    for (let i = 0, item; i < newTarLen; i++) {
        item = target[i];
        if (item && typeof item === "object") {
            tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                tmpObserved.ownKey = i;
            }
        }
    }
    //	detach removed objects
    let i, l, item;
    for (i = 0, l = spliceResult.length; i < l; i++) {
        item = spliceResult[i];
        if (item && typeof item === "object") {
            tmpObserved = item[oMetaKey];
            if (tmpObserved) {
                spliceResult[i] = tmpObserved.detach();
            }
        }
    }
    const changes = [];
    let index;
    for (index = 0; index < removed; index++) {
        if (index < inserted) {
            changes.push(new Change(UPDATE, [startIndex + index], target[startIndex + index], spliceResult[index], this, copy(this)));
        }
        else {
            changes.push(new Change(DELETE, [startIndex + index], undefined, spliceResult[index], this, copy(this)));
        }
    }
    for (; index < inserted; index++) {
        changes.push(new Change(INSERT, [startIndex + index], target[startIndex + index], undefined, this, copy(this)));
    }
    callObservers(oMeta, changes);
    return spliceResult;
}
const proxiedArrayMethods = {
    pop: proxiedPop,
    push: proxiedPush,
    shift: proxiedShift,
    unshift: proxiedUnshift,
    reverse: proxiedReverse,
    sort: proxiedSort,
    fill: proxiedFill,
    copyWithin: proxiedCopyWithin,
    splice: proxiedSplice,
};
class Change {
    constructor(type, path, value, oldValue, object, snapshot) {
        this.type = type;
        this.path = path;
        this.value = copy(value);
        this.oldValue = copy(oldValue);
        this.object = object;
        this.snapshot = snapshot;
    }
}
class OMetaBase {
    constructor(properties, cloningFunction) {
        this.observers = [];
        this.batches = [];
        const { target, parent, ownKey, visited = new Set() } = properties;
        if (parent && ownKey !== undefined) {
            this.parent = parent;
            this.ownKey = ownKey;
        }
        else {
            this.parent = null;
            this.ownKey = "";
        }
        visited.add(target);
        const targetClone = cloningFunction(target, this, visited);
        visited.delete(target);
        this.revocable = Proxy.revocable(targetClone, this);
        this.proxy = this.revocable.proxy;
        this.target = targetClone;
        this.batches = [];
    }
    detach() {
        this.parent = null;
        return this.target;
    }
    set(target, key, value) {
        let oldValue = target[key];
        if (value !== oldValue) {
            const newValue = getObservedOf(value, key, this);
            target[key] = newValue;
            if (oldValue && typeof oldValue === "object") {
                const tmpObserved = oldValue[oMetaKey];
                if (tmpObserved) {
                    oldValue = tmpObserved.detach();
                }
            }
            const changes = oldValue === undefined
                ? [
                    new Change(INSERT, [key], newValue, undefined, this.proxy, copy(this.proxy)),
                ]
                : [
                    new Change(UPDATE, [key], newValue, oldValue, this.proxy, copy(this.proxy)),
                ];
            callObservers(this, changes);
        }
        return true;
    }
    deleteProperty(target, key) {
        let oldValue = target[key];
        delete target[key];
        if (oldValue && typeof oldValue === "object") {
            const tmpObserved = oldValue[oMetaKey];
            if (tmpObserved) {
                oldValue = tmpObserved.detach();
            }
        }
        const changes = [
            new Change(DELETE, [key], undefined, oldValue, this.proxy, copy(this.proxy)),
        ];
        callObservers(this, changes);
        return true;
    }
}
class ObjectOMeta extends OMetaBase {
    constructor(properties) {
        super(properties, prepareObject);
    }
}
class ArrayOMeta extends OMetaBase {
    constructor(properties) {
        super(properties, prepareArray);
    }
    get(target, key) {
        return proxiedArrayMethods[key] || target[key];
    }
}
function observable(target) {
    const o = isObservable(target)
        ? target
        : new ArrayOMeta({
            target: target,
            ownKey: "",
            parent: null,
        }).proxy;
    async function unobserve(observers) {
        if (!observers)
            return await __unobserve(o);
        else if (Array.isArray(observers))
            return await __unobserve(o, observers);
        else
            return await __unobserve(o, [observers]);
    }
    function observe(observer) {
        __observe(o, observer);
    }
    async function silently(work) {
        const observers = await unobserve();
        await work(o);
        observers.forEach((x) => observe(x));
    }
    return {
        observe,
        unobserve,
        silently,
        observable: o,
    };
}
function isObservable(input) {
    return !!(input && input[oMetaKey]);
}
function __observe(observable, observer) {
    const observers = observable[oMetaKey].observers;
    if (!observers.some((o) => o === observer)) {
        observers.push(observer);
    }
}
async function __unobserve(observable, observers) {
    if (observable instanceof Promise)
        observable = await Promise.resolve(observable);
    const existingObs = observable[oMetaKey].observers;
    let length = existingObs.length;
    if (!length) {
        return [];
    }
    if (!observers) {
        return existingObs.splice(0);
    }
    let spliced = [];
    for (let index = 0; index < observers.length; index++) {
        const observer = observers[index];
        const i = existingObs.indexOf(observer);
        if (i > -1) {
            spliced.push(existingObs.splice(i, 1)[0]);
        }
    }
    return spliced;
}

var observable$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    observable: observable,
    isObservable: isObservable,
    Change: Change
});

class Aggregate {
    constructor(subjects) {
        this.subjects = [];
        this.subjects = subjects;
    }
    removeUnusedID(arr) {
        return arr.map((item) => {
            if (item._id === undefined)
                delete item._id;
            return item;
        });
    }
    $match(filter) {
        return new Aggregate(this.subjects.filter((subject) => match(subject, filter)));
    }
    $group({ _id, reducer }) {
        const groupsObj = {};
        this.subjects.forEach((subject) => {
            const propertyValue = JSON.stringify({ tmp: subject[_id] });
            if (!groupsObj[propertyValue])
                groupsObj[propertyValue] = [];
            groupsObj[propertyValue].push(subject);
        });
        return new Aggregate(Object.values(groupsObj).map(reducer));
    }
    $limit(limit) {
        return new Aggregate(this.subjects.slice(0, limit));
    }
    $skip(skip) {
        return new Aggregate(this.subjects.slice(skip));
    }
    $addFields(adder) {
        return new Aggregate(this.subjects.map((subject) => ({
            ...subject,
            ...adder(subject),
        })));
    }
    $sort(sortCriteria) {
        return new Aggregate(sort(this.subjects.slice(0), sortCriteria));
    }
    $project(project$1) {
        return new Aggregate(this.removeUnusedID(project(this.subjects, project$1)));
    }
    $unwind(fieldName) {
        const unwoundSubjects = [];
        for (let index = 0; index < this.subjects.length; index++) {
            const subject = this.subjects[index];
            const fieldArray = subject[fieldName];
            if (Array.isArray(fieldArray)) {
                for (const element of fieldArray) {
                    const unwoundSubject = { ...subject, [fieldName]: element };
                    unwoundSubjects.push(unwoundSubject);
                }
            }
            else {
                unwoundSubjects.push(subject);
            }
        }
        return new Aggregate(unwoundSubjects);
    }
    toArray() {
        return this.subjects;
    }
}

/**
 * Main user API to the database
 * exposing only strongly typed methods and relevant configurations
 */
let deepOperators = modifiersKeys;
class Database {
    constructor(options) {
        /**
         * Create document
         */
        this.create = this.insert;
        /**
         * Find documents that meets a specified criteria
         */
        this.find = this.read;
        /**
         * Count the documents matching the specified criteria
         */
        this.number = this.count;
        /**
         * Delete document(s) that meets the specified criteria
         */
        this.remove = this.delete;
        /**
         * Create an index specified by options
         */
        this.ensureIndex = this.createIndex;
        this.model = options.model || Doc;
        this.ref = options.ref;
        this._datastore = new Datastore({
            ref: this.ref,
            model: this.model,
            indexes: options.indexes,
            encode: options.encode,
            decode: options.decode,
            corruptAlertThreshold: options.corruptAlertThreshold,
            timestampData: options.timestampData,
            syncToRemote: options.sync ? options.sync.syncToRemote : undefined,
            syncInterval: options.sync ? options.sync.syncInterval : undefined,
            defer: options.deferPersistence,
            stripDefaults: options.stripDefaults || false,
            cacheLimit: options.cacheLimit,
        });
        this.loaded = this._datastore.loadDatabase();
    }
    /**
     * insert documents
     */
    async insert(docs) {
        await this.loaded;
        const res = await this._datastore.insert(docs);
        return res;
    }
    /**
     * Get live queries (observable)
     * can be bidirectionally live (to and from DB)
     * or either from or to DB
     */
    async live(filter = {}, { skip = 0, limit = 0, project = {}, sort = {}, toDB = true, fromDB = true, } = {}) {
        await this.loaded;
        const res = await this.read(...arguments);
        const ob = observable(res);
        let toDBObserver = () => undefined;
        let fromDBuid = "";
        if (toDB) {
            toDBObserver = (changes) => {
                let operations = {};
                for (let i = 0; i < changes.length; i++) {
                    const change = changes[i];
                    if (change.path.length === 0 ||
                        change.type === "shuffle" ||
                        change.type === "reverse") {
                        continue;
                    }
                    else if (change.path.length === 1 && change.type === "update") {
                        let doc = change.snapshot[change.path[0]];
                        let _id = change.oldValue._id;
                        operations[_id] = () => this.update({ _id: _id }, {
                            $set: doc,
                        });
                    }
                    else if (change.path.length > 1 || change.type === "update") {
                        // updating specific field in document
                        let doc = change.snapshot[change.path[0]];
                        let _id = doc._id;
                        operations[_id] = () => this.upsert({ _id: _id }, {
                            $set: doc,
                            $setOnInsert: doc,
                        });
                    }
                    else if (change.type === "delete") {
                        // deleting
                        let doc = change.oldValue;
                        let _id = doc._id;
                        operations[_id] = () => this.delete({ _id });
                    }
                    else if (change.type === "insert") {
                        // inserting
                        let doc = change.value;
                        let _id = doc._id;
                        operations[_id] = () => this.insert(doc);
                    }
                }
                const results = Object.values(operations).map((operation) => operation());
                Promise.all(results).catch((e) => {
                    this._datastore.live.update(); // reversing updates to observable
                    console.error(`XWebDB: Reflecting observable changes to database couldn't complete due to an error:`, e);
                });
            };
            ob.observe(toDBObserver);
        }
        if (fromDB) {
            fromDBuid = this._datastore.live.addLive({
                query: filter,
                toDBObserver,
                observable: ob,
            });
        }
        return {
            ...ob,
            kill: async (w) => {
                if (w === "toDB" || !w) {
                    await ob.unobserve(toDBObserver);
                }
                if (w === "fromDB" || !w) {
                    this._datastore.live.kill(fromDBuid);
                }
            },
        };
    }
    async aggregate(filter = {}) {
        await this.loaded;
        const res = await this.read(...arguments);
        return new Aggregate(res);
    }
    /**
     * Find document(s) that meets a specified criteria
     */
    async read(filter = {}, { skip = 0, limit = 0, project = {}, sort = {}, } = {}) {
        await this.loaded;
        filter = toDotNotation(filter);
        sort = toDotNotation(sort);
        project = toDotNotation(project);
        const cursor = this._datastore.cursor(filter);
        if (sort) {
            cursor.sort(sort);
        }
        if (skip) {
            cursor.skip(skip);
        }
        if (limit) {
            cursor.limit(limit);
        }
        if (project) {
            cursor.project(project);
        }
        return await cursor.exec();
    }
    /**
     * Update document(s) that meets the specified criteria
     */
    async update(filter, update, multi = false) {
        await this.loaded;
        filter = toDotNotation(filter || {});
        for (let index = 0; index < deepOperators.length; index++) {
            const operator = deepOperators[index];
            if (update[operator]) {
                update[operator] = toDotNotation(update[operator] || {});
            }
        }
        const res = await this._datastore.update(filter, update, {
            multi,
            upsert: false,
        });
        return res;
    }
    /**
     * Update document(s) that meets the specified criteria,
     * and do an insertion if no documents are matched
     */
    async upsert(filter, update, multi = false) {
        await this.loaded;
        filter = toDotNotation(filter || {});
        for (let index = 0; index < deepOperators.length; index++) {
            const operator = deepOperators[index];
            if (update[operator]) {
                update[operator] = toDotNotation(update[operator]);
            }
        }
        const res = await this._datastore.update(filter, update, {
            multi,
            upsert: true,
        });
        return res;
    }
    /**
     * Count documents that meets the specified criteria
     */
    async count(filter = {}) {
        await this.loaded;
        filter = toDotNotation(filter || {});
        return await this._datastore.count(filter);
    }
    /**
     * Delete document(s) that meets the specified criteria
     *
     */
    async delete(filter, multi = false) {
        await this.loaded;
        filter = toDotNotation(filter || {});
        const res = await this._datastore.remove(filter, {
            multi: multi || false,
        });
        return res;
    }
    /**
     * Create an index specified by options
     */
    async createIndex(options) {
        await this.loaded;
        return await this._datastore.ensureIndex(options);
    }
    /**
     * Remove an index by passing the field name that it is related to
     */
    async removeIndex(fieldName) {
        await this.loaded;
        return await this._datastore.removeIndex(fieldName);
    }
    /**
     * Reload database from the persistence layer
     */
    async reload() {
        let promise = this._datastore.loadDatabase();
        this.loaded = promise;
        return promise;
    }
    /**
     * Synchronies the database with remote source using the remote adapter
     */
    async sync() {
        await this.loaded;
        if (!this._datastore.persistence.sync) {
            throw new Error("XWebDB: Can not perform sync operation unless provided with remote DB adapter");
        }
        return await this._datastore.persistence.sync.sync();
    }
    /**
     * Forcefully sync the database with remote source using the remote adapter
     * bypassing: 	A. a check to see whether other sync action is in progress
     * 				B. a check to see whether there are deferred writes/deletes
     * 				C. a check to see whether local DB and remote source have same $H
     * Use this with caution, and only if you know what you're doing
     */
    async forceSync() {
        if (!this._datastore.persistence.sync) {
            throw new Error("XWebDB: Can not perform sync operation unless provided with remote DB adapter");
        }
        return await this._datastore.persistence.sync._sync(true);
    }
    /**
     * true: there's a sync in progress
     * false: there's no sync in progress
     */
    get syncInProgress() {
        return this._datastore.persistence.syncInProgress;
    }
}

const _internal = {
    observable: observable$1,
    Cursor,
    customUtils,
    Datastore,
    Index,
    modelling,
    Q,
    Persistence,
    Dictionary,
    Cache,
    Aggregate,
};

export { Database, Doc, SubDoc, _internal, kvAdapter, mapSubModel };
