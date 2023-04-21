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
function randomString(len = 8) {
    return Array.from(new Uint8Array(120))
        .map((x) => Math.random().toString(36))
        .join("")
        .split("0.")
        .join("")
        .substring(0, len);
}
/**
 * XXHash32
*/
function xxh(str, seed = 0) {
    const encoder = new TextEncoder();
    const input = encoder.encode(str);
    const prime = 0x9e3779b1;
    let hash = seed + 0xdeadbeef;
    let len = input.length;
    for (let i = 0; i + 4 <= len; i += 4) {
        let word = (input[i] |
            (input[i + 1] << 8) |
            (input[i + 2] << 16) |
            (input[i + 3] << 24)) >>>
            0;
        hash += word * prime;
        hash = Math.imul(hash, prime);
    }
    if (len & 3) {
        let lastBytes = input.slice(len - (len & 3));
        let word = 0;
        for (let i = 0; i < lastBytes.length; i++) {
            word += lastBytes[i] << (i * 8);
        }
        hash += word * prime;
        hash = Math.imul(hash, prime);
    }
    hash ^= hash >>> 15;
    hash = Math.imul(hash, prime);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, prime);
    hash ^= hash >>> 16;
    return hash >>> 0;
}

var customUtils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    uid: uid,
    randomString: randomString,
    xxh: xxh
});

/**
 * Check a key throw an error if the key is non valid
 * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
 * Its serialized-then-deserialized version it will transformed into a Date object
 * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
 */
function checkKey(k, v) {
    if (typeof k === "number") {
        k = k.toString();
    }
    if (k[0] === "$" &&
        !(k === "$$date" && typeof v === "number") &&
        !(k === "$$deleted" && v === true) &&
        !(k === "$$indexCreated") &&
        !(k === "$$indexRemoved")) {
        throw new Error("Field names cannot begin with the $ character");
    }
    if (k.indexOf(".") !== -1) {
        throw new Error("Field names cannot contain a .");
    }
}
/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
function checkObject(obj) {
    if (Array.isArray(obj)) {
        obj.forEach((o) => checkObject(o));
    }
    else if (typeof obj === "object" &&
        obj !== null &&
        !(obj instanceof Date)) {
        Object.keys(obj).forEach(function (k) {
            checkKey(k, obj[k]);
            checkObject(obj[k]);
        });
    }
}
/**
 * Serialize an object to be persisted to a one-line string
 * For serialization/deserialization, we use the native JSON parser and not eval or Function
 * That gives us less freedom but data entered in the database may come from users
 * so eval and the like are not safe
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
function serialize(obj) {
    var res;
    res = JSON.stringify(obj, function (k, v) {
        checkKey(k, v);
        if (v === undefined) {
            return undefined;
        }
        if (v === null) {
            return null;
        }
        // Hackish way of checking if object is Date.
        // We can't use value directly because for dates it is already string in this function (date.toJSON was already called), so we use this
        if (typeof this[k].getTime === "function") {
            return { $$date: this[k].getTime() };
        }
        return v;
    });
    return res;
}
/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
function deserialize(rawData) {
    return JSON.parse(rawData, function (k, v) {
        if (k === "$$date") {
            return new Date(v);
        }
        if (typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean" ||
            v === null) {
            return v;
        }
        if (v && v.$$date) {
            return v.$$date;
        }
        return v;
    });
}
/**
 * Deep copy a DB object
 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
 * where the keys are valid, i.e. don't begin with $ and don't contain a .
 */
function deepCopy(obj, model, strictKeys) {
    let res = undefined;
    if (typeof obj === "boolean" ||
        typeof obj === "number" ||
        typeof obj === "string" ||
        obj === null ||
        obj instanceof Date) {
        return obj;
    }
    if (Array.isArray(obj)) {
        res = [];
        obj.forEach((o) => res.push(deepCopy(o, model, strictKeys)));
        return res;
    }
    if (typeof obj === "object") {
        res = {};
        Object.keys(obj).forEach((k) => {
            if (!strictKeys || (k[0] !== "$" && k.indexOf(".") === -1)) {
                res[k] = deepCopy(obj[k], model, strictKeys);
            }
        });
        if (res.hasOwnProperty("_id")) {
            return model.new(res);
        }
        else {
            return res;
        }
    }
    return JSON.parse(JSON.stringify({ temp: obj })).temp;
}
/**
 * Tells if an object is a primitive type or a "real" object
 * Arrays are considered primitive
 */
function isPrimitiveType(obj) {
    return (typeof obj === "boolean" ||
        typeof obj === "number" ||
        typeof obj === "string" ||
        obj === null ||
        obj instanceof Date ||
        Array.isArray(obj));
}
function compareNSB(a, b) {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}
function compareArrays(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        let comp = compareThings(a[i], b[i]);
        if (comp !== 0) {
            return comp;
        }
    }
    // Common section was identical, longest one wins
    return compareNSB(a.length, b.length);
}
/**
 * Compare { things U undefined }
 * Things are defined as any native types (string, number, boolean, null, date) and objects
 * We need to compare with undefined as it will be used in indexes
 * In the case of objects and arrays, we deep-compare
 * If two objects don't have the same type, the (arbitrary) type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
 * Return -1 if a < b, 1 if a > b and 0 if a = b (note that equality here is NOT the same as defined in areThingsEqual!)
 *
 */
function compareThings(a, b, _compareStrings) {
    const compareStrings = _compareStrings || compareNSB;
    // undefined
    if (a === undefined) {
        return b === undefined ? 0 : -1;
    }
    if (b === undefined) {
        return a === undefined ? 0 : 1;
    }
    // null
    if (a === null) {
        return b === null ? 0 : -1;
    }
    if (b === null) {
        return a === null ? 0 : 1;
    }
    // Numbers
    if (typeof a === "number") {
        return typeof b === "number" ? compareNSB(a, b) : -1;
    }
    if (typeof b === "number") {
        return typeof a === "number" ? compareNSB(a, b) : 1;
    }
    // Strings
    if (typeof a === "string") {
        return typeof b === "string" ? compareStrings(a, b) : -1;
    }
    if (typeof b === "string") {
        return typeof a === "string" ? compareStrings(a, b) : 1;
    }
    // Booleans
    if (typeof a === "boolean") {
        return typeof b === "boolean" ? compareNSB(a, b) : -1;
    }
    if (typeof b === "boolean") {
        return typeof a === "boolean" ? compareNSB(a, b) : 1;
    }
    // Dates
    if (a instanceof Date) {
        return b instanceof Date ? compareNSB(a.getTime(), b.getTime()) : -1;
    }
    if (b instanceof Date) {
        return a instanceof Date ? compareNSB(a.getTime(), b.getTime()) : 1;
    }
    // Arrays (first element is most significant and so on)
    if (Array.isArray(a)) {
        return Array.isArray(b) ? compareArrays(a, b) : -1;
    }
    if (Array.isArray(b)) {
        return Array.isArray(a) ? compareArrays(a, b) : 1;
    }
    // Objects
    let aKeys = Object.keys(a).sort();
    let bKeys = Object.keys(b).sort();
    for (let i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
        let comp = compareThings(a[aKeys[i]], b[bKeys[i]]);
        if (comp !== 0) {
            return comp;
        }
    }
    return compareNSB(aKeys.length, bKeys.length);
}
// ==============================================================
// Updating documents
// ==============================================================
/**
 * The signature of modifier functions is as follows
 * Their structure is always the same: recursively follow the dot notation while creating
 * the nested documents if needed, then apply the "last step modifier"
 */
const lastStepModifierFunctions = {
    $set: function (obj, field, value) {
        if (!obj) {
            return;
        }
        obj[field] = value;
    },
    $mul: function (obj, field, value) {
        let base = obj[field];
        if (typeof value !== "number" || typeof base !== "number") {
            throw new Error("Multiply operator works only on numbers");
        }
        obj[field] = base * value;
    },
    $unset: function (obj, field) {
        delete obj[field];
    },
    /**
     * Push an element to the end of an array field
     * Optional modifier $each instead of value to push several values
     * Optional modifier $slice to slice the resulting array, see https://docs.mongodb.org/manual/reference/operator/update/slice/
     * Differences with MongoDB: if $slice is specified and not $each, we act as if value is an empty array
     */
    $push: function (obj, field, value) {
        // Create the array if it doesn't exist
        if (!obj.hasOwnProperty(field)) {
            obj[field] = [];
        }
        if (!Array.isArray(obj[field])) {
            throw new Error("Can't $push an element on non-array values");
        }
        if (value !== null &&
            typeof value === "object" &&
            value["$slice"] &&
            value["$each"] === undefined) {
            value.$each = [];
        }
        if (value !== null &&
            typeof value === "object" &&
            value["$each"]) {
            const eachVal = value["$each"];
            const sliceVal = value["$slice"];
            const posVal = value["$position"];
            const sortVal = value["$sort"];
            const allKeys = Object.keys(value);
            if (Object.keys(value).length > 1) {
                if (allKeys.filter((x) => {
                    return (["$each", "$slice", "$position", "$sort"].indexOf(x) === -1);
                }).length) {
                    throw new Error("Can only use the modifiers $slice, $position and $sort in conjunction with $each when $push to array");
                }
            }
            if (!Array.isArray(eachVal)) {
                throw new Error("$each requires an array value");
            }
            if (posVal) {
                for (let i = 0; i < eachVal.length; i++) {
                    const element = eachVal[i];
                    obj[field].splice(posVal + i, 0, element);
                }
            }
            else {
                eachVal.forEach((v) => obj[field].push(v));
            }
            if (sortVal) {
                if (typeof sortVal === "number") {
                    if (sortVal === 1)
                        obj[field].sort((a, b) => compareThings(a, b));
                    else
                        obj[field].sort((a, b) => compareThings(b, a));
                }
                else {
                    obj[field].sort((a, b) => {
                        const keys = Object.keys(sortVal);
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            const order = sortVal[key];
                            if (order === 1) {
                                const comp = compareThings(a[key], b[key]);
                                if (comp)
                                    return comp;
                            }
                            else {
                                const comp = compareThings(b[key], a[key]);
                                if (comp)
                                    return comp;
                            }
                        }
                        return 0;
                    });
                }
            }
            if (sliceVal === undefined) {
                return;
            }
            if (sliceVal !== undefined && typeof sliceVal !== "number") {
                throw new Error("$slice requires a number value");
            }
            if (sliceVal === 0) {
                obj[field] = [];
            }
            else {
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
        else {
            obj[field].push(value);
        }
    },
    /**
     * Add an element to an array field only if it is not already in it
     * No modification if the element is already in the array
     * Note that it doesn't check whether the original array contains duplicates
     */
    $addToSet: function (obj, field, value) {
        // Create the array if it doesn't exist
        if (!obj.hasOwnProperty(field)) {
            obj[field] = [];
        }
        if (!Array.isArray(obj[field])) {
            throw new Error("Can't $addToSet an element on non-array values");
        }
        const eachVal = value["$each"];
        if (value !== null && typeof value === "object" && eachVal) {
            if (Object.keys(value).length > 1) {
                throw new Error("Can't use another field in conjunction with $each on $addToSet modifier");
            }
            if (!Array.isArray(eachVal)) {
                throw new Error("$each requires an array value");
            }
            eachVal.forEach((v) => lastStepModifierFunctions.$addToSet(obj, field, v));
        }
        else {
            let addToSet = true;
            for (let index = 0; index < obj[field].length; index++) {
                const element = obj[field][index];
                if (compareThings(element, value) === 0) {
                    addToSet = false;
                    break;
                }
            }
            if (addToSet) {
                obj[field].push(value);
            }
        }
    },
    /**
     * Remove the first or last element of an array
     */
    $pop: function (obj, field, value) {
        if (!Array.isArray(obj[field])) {
            throw new Error("Can't $pop an element from non-array values");
        }
        if (typeof value !== "number") {
            throw new Error(value + " isn't an integer, can't use it with $pop");
        }
        if (value === 0) {
            return;
        }
        if (value > 0) {
            obj[field] = obj[field].slice(0, obj[field].length - 1);
        }
        else {
            obj[field] = obj[field].slice(1);
        }
    },
    /**
     * Removes all instances of a value from an existing array
     */
    $pull: function (obj, field, value) {
        if (!Array.isArray(obj[field])) {
            throw new Error("Can't $pull an element from non-array values");
        }
        let arr = obj[field];
        for (let i = arr.length - 1; i >= 0; i -= 1) {
            if (match(arr[i], value)) {
                arr.splice(i, 1);
            }
        }
    },
    /**
     * Removes all instances of a value from an existing array
     */
    $pullAll: function (obj, field, value) {
        if (!Array.isArray(obj[field])) {
            throw new Error("Can't $pull an element from non-array values");
        }
        let arr = obj[field];
        for (let i = arr.length - 1; i >= 0; i -= 1) {
            for (let j = 0; j < value.length; j++) {
                if (match(arr[i], value[j])) {
                    arr.splice(i, 1);
                }
            }
        }
    },
    /**
     * Increment a numeric field's value
     */
    $inc: function (obj, field, value) {
        if (typeof value !== "number") {
            throw new Error(value + " must be a number");
        }
        if (typeof obj[field] !== "number") {
            if (!obj.hasOwnProperty(field)) {
                obj[field] = value;
            }
            else {
                throw new Error("Can't use the $inc modifier on non-number fields");
            }
        }
        else {
            obj[field] = obj[field] + value;
        }
    },
    /**
     * Updates the value of the field, only if specified field is greater than the current value of the field
     */
    $max: function (obj, field, value) {
        if (typeof obj[field] === "undefined") {
            obj[field] = value;
        }
        else if (value > obj[field]) {
            obj[field] = value;
        }
    },
    /**
     * Updates the value of the field, only if specified field is smaller than the current value of the field
     */
    $min: function (obj, field, value) {
        if (typeof obj[field] === "undefined") {
            obj[field] = value;
        }
        else if (value < obj[field]) {
            obj[field] = value;
        }
    },
    $currentDate: function (obj, field, value) {
        if (value === true) {
            obj[field] = new Date();
        }
        else if (value.$type && value.$type === "timestamp") {
            obj[field] = Date.now();
        }
        else if (value.$type && value.$type === "date") {
            obj[field] = new Date();
        }
    },
    $rename: function (obj, field, value) {
        obj[value] = obj[field];
        delete obj[field];
    },
    $setOnInsert: function () {
        // if the operator reached here
        // it means that the update was not actually an insertion.
        // this operator is being dealt with at the datastore.ts file
    },
};
// Given its name, create the complete modifier function
function createModifierFunction(modifier) {
    return function (obj, field, value) {
        var fieldParts = typeof field === "string" ? field.split(".") : field;
        if (fieldParts.length === 1) {
            lastStepModifierFunctions[modifier](obj, field, value);
        }
        else {
            if (obj[fieldParts[0]] === undefined) {
                if (modifier === "$unset") {
                    return;
                } // Bad looking specific fix, needs to be generalized modifiers that behave like $unset are implemented
                obj[fieldParts[0]] = {};
            }
            modifierFunctions[modifier](obj[fieldParts[0]], fieldParts.slice(1).join("."), value);
        }
    };
}
const modifierFunctions = {};
// Actually create all modifier functions
Object.keys(lastStepModifierFunctions).forEach(function (modifier) {
    modifierFunctions[modifier] = createModifierFunction(modifier);
});
/**
 * Modify a DB object according to an update query
 */
function modify(obj, updateQuery, model) {
    var keys = Object.keys(updateQuery);
    let firstChars = keys.map((x) => x.charAt(0));
    let dollarFirstChars = firstChars.filter((x) => x === "$");
    if (keys.indexOf("_id") !== -1 &&
        updateQuery["_id"] !== obj._id) {
        throw new Error("You cannot change a document's _id");
    }
    if (dollarFirstChars.length !== 0 &&
        dollarFirstChars.length !== firstChars.length) {
        throw new Error("You cannot mix modifiers and normal fields");
    }
    let newDoc;
    if (dollarFirstChars.length === 0) {
        // Simply replace the object with the update query contents
        newDoc = deepCopy(updateQuery, model);
        newDoc._id = obj._id;
    }
    else {
        // Apply modifiers
        let modifiers = Array.from(new Set(keys));
        newDoc = deepCopy(obj, model);
        modifiers.forEach(function (modifier) {
            let modArgument = updateQuery[modifier];
            if (!modifierFunctions[modifier]) {
                throw new Error("Unknown modifier " + modifier);
            }
            // Can't rely on Object.keys throwing on non objects since ES6
            // Not 100% satisfying as non objects can be interpreted as objects but no false negatives so we can live with it
            if (typeof modArgument !== "object") {
                throw new Error("Modifier " + modifier + "'s argument must be an object");
            }
            let keys = Object.keys(modArgument);
            keys.forEach(function (k) {
                modifierFunctions[modifier](newDoc, k, modArgument[k]);
            });
        });
    }
    // Check result is valid and return it
    checkObject(newDoc);
    if (obj._id !== newDoc._id) {
        throw new Error("You can't change a document's _id");
    }
    return newDoc;
}
// ==============================================================
// Finding documents
// ==============================================================
/**
 * Get a value from object with dot notation
 */
function getDotValue(obj, field) {
    const fieldParts = typeof field === "string" ? field.split(".") : field;
    if (!obj) {
        return undefined;
    } // field cannot be empty so that means we should return undefined so that nothing can match
    if (fieldParts.length === 0) {
        return obj;
    }
    if (fieldParts.length === 1) {
        return obj[fieldParts[0]];
    }
    if (Array.isArray(obj[fieldParts[0]])) {
        // If the next field is an integer, return only this item of the array
        let i = parseInt(fieldParts[1], 10);
        if (typeof i === "number" && !isNaN(i)) {
            return getDotValue(obj[fieldParts[0]][i], fieldParts.slice(2));
        }
        // Return the array of values
        let objects = new Array();
        for (let i = 0; i < obj[fieldParts[0]].length; i += 1) {
            objects.push(getDotValue(obj[fieldParts[0]][i], fieldParts.slice(1)));
        }
        return objects;
    }
    else {
        return getDotValue(obj[fieldParts[0]], fieldParts.slice(1));
    }
}
/**
 * Check whether 'things' are equal
 * Things are defined as any native types (string, number, boolean, null, date) and objects
 * In the case of object, we check deep equality
 * Returns true if they are, false otherwise
 */
function areThingsEqual(a, b) {
    var aKeys, bKeys, i;
    // Strings, booleans, numbers, null
    if (a === null ||
        typeof a === "string" ||
        typeof a === "boolean" ||
        typeof a === "number" ||
        b === null ||
        typeof b === "string" ||
        typeof b === "boolean" ||
        typeof b === "number") {
        return a === b;
    }
    // Dates
    if (a instanceof Date || b instanceof Date) {
        return (a instanceof Date &&
            b instanceof Date &&
            a.getTime() === b.getTime());
    }
    // Arrays (no match since arrays are used as a $in)
    // undefined (no match since they mean field doesn't exist and can't be serialized)
    if ((!(Array.isArray(a) && Array.isArray(b)) &&
        (Array.isArray(a) || Array.isArray(b))) ||
        a === undefined ||
        b === undefined) {
        return false;
    }
    // General objects (check for deep equality)
    // a and b should be objects at this point
    try {
        aKeys = Object.keys(a);
        bKeys = Object.keys(b);
    }
    catch (e) {
        return false;
    }
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (i = 0; i < aKeys.length; i += 1) {
        if (bKeys.indexOf(aKeys[i]) === -1) {
            return false;
        }
        if (!areThingsEqual(a[aKeys[i]], b[aKeys[i]])) {
            return false;
        }
    }
    return true;
}
/**
 * Check that two values are comparable
 */
function areComparable(a, b) {
    if (typeof a !== "string" &&
        typeof a !== "number" &&
        !(a instanceof Date) &&
        typeof b !== "string" &&
        typeof b !== "number" &&
        !(b instanceof Date)) {
        return false;
    }
    if (typeof a !== typeof b) {
        return false;
    }
    return true;
}
const comparisonFunctions = {};
/**
 * Arithmetic and comparison operators
 */
comparisonFunctions.$type = function (a, b) {
    if (["number", "boolean", "string", "undefined"].indexOf(b) > -1) {
        return typeof a === b;
    }
    else if (b === "array") {
        return Array.isArray(a);
    }
    else if (b === "null") {
        return a === null;
    }
    else if (b === "date") {
        return a instanceof Date;
    }
    else if (b === "object") {
        return (typeof a === "object" &&
            !(a instanceof Date) &&
            !(a === null) &&
            !Array.isArray(a));
    }
    else
        return false;
};
comparisonFunctions.$not = function (a, b) {
    return !match({ k: a }, { k: b });
};
comparisonFunctions.$eq = function (a, b) {
    return areThingsEqual(a, b);
};
comparisonFunctions.$lt = function (a, b) {
    return areComparable(a, b) && a < b;
};
comparisonFunctions.$lte = function (a, b) {
    return areComparable(a, b) && a <= b;
};
comparisonFunctions.$gt = function (a, b) {
    return areComparable(a, b) && a > b;
};
comparisonFunctions.$gte = function (a, b) {
    return areComparable(a, b) && a >= b;
};
comparisonFunctions.$mod = function (a, b) {
    if (!Array.isArray(b)) {
        throw new Error("malformed mod, must be supplied with an array");
    }
    if (b.length !== 2) {
        throw new Error("malformed mod, array length must be exactly two, a divisor and a remainder");
    }
    return a % b[0] === b[1];
};
comparisonFunctions.$ne = function (a, b) {
    if (a === undefined) {
        return true;
    }
    return !areThingsEqual(a, b);
};
comparisonFunctions.$in = function (a, b) {
    var i;
    if (!Array.isArray(b)) {
        throw new Error("$in operator called with a non-array");
    }
    for (i = 0; i < b.length; i += 1) {
        if (areThingsEqual(a, b[i])) {
            return true;
        }
    }
    return false;
};
comparisonFunctions.$nin = function (a, b) {
    if (!Array.isArray(b)) {
        throw new Error("$nin operator called with a non-array");
    }
    return !comparisonFunctions.$in(a, b);
};
comparisonFunctions.$regex = function (a, b) {
    if (!(b instanceof RegExp)) {
        throw new Error("$regex operator called with non regular expression");
    }
    if (typeof a !== "string") {
        return false;
    }
    else {
        return b.test(a);
    }
};
comparisonFunctions.$exists = function (value, exists) {
    if (exists || exists === "") {
        // This will be true for all values of exists except false, null, undefined and 0
        exists = true; // That's strange behaviour (we should only use true/false) but that's the way Mongo does it...
    }
    else {
        exists = false;
    }
    if (value === undefined) {
        return !exists;
    }
    else {
        return exists;
    }
};
// Specific to arrays
comparisonFunctions.$size = function (obj, value) {
    if (!Array.isArray(obj)) {
        return false;
    }
    if (value % 1 !== 0) {
        throw new Error("$size operator called without an integer");
    }
    return obj.length === value;
};
comparisonFunctions.$elemMatch = function (obj, value) {
    if (!Array.isArray(obj)) {
        return false;
    }
    var i = obj.length;
    var result = false; // Initialize result
    while (i--) {
        if (match(obj[i], value)) {
            // If match for array element, return true
            result = true;
            break;
        }
    }
    return result;
};
comparisonFunctions.$all = function (a, b) {
    if (!Array.isArray(a)) {
        throw new Error("$all must be applied on fields of type array");
    }
    if (!Array.isArray(b)) {
        throw new Error("$all must be supplied with argument of type array");
    }
    for (let i = 0; i < b.length; i++) {
        const elementInArgument = b[i];
        if (a.indexOf(elementInArgument) === -1) {
            return false;
        }
    }
    return true;
};
const arrayComparisonFunctions = {};
arrayComparisonFunctions.$size = true;
arrayComparisonFunctions.$elemMatch = true;
arrayComparisonFunctions.$all = true;
const logicalOperators = {};
/**
 * Match any of the subqueries
 */
logicalOperators.$or = function (obj, query) {
    var i;
    if (!Array.isArray(query)) {
        throw new Error("$or operator used without an array");
    }
    for (i = 0; i < query.length; i += 1) {
        if (match(obj, query[i])) {
            return true;
        }
    }
    return false;
};
/**
 * Match all of the subqueries
 */
logicalOperators.$and = function (obj, query) {
    if (!Array.isArray(query)) {
        throw new Error("$and operator used without an array");
    }
    for (let i = 0; i < query.length; i += 1) {
        if (!match(obj, query[i])) {
            return false;
        }
    }
    return true;
};
/**
 * Match non of the subqueries
 */
logicalOperators.$nor = function (obj, query) {
    if (!Array.isArray(query)) {
        throw new Error("$nor operator used without an array");
    }
    for (let i = 0; i < query.length; i += 1) {
        if (match(obj, query[i])) {
            return false;
        }
    }
    return true;
};
/**
 * Use a function to match
 */
logicalOperators.$where = function (obj, fn) {
    var result;
    if (typeof fn !== "function") {
        throw new Error("$where operator used without a function");
    }
    result = fn.call(obj);
    if (typeof result !== "boolean") {
        throw new Error("$where function must return boolean");
    }
    return result;
};
/**
 * Tell if a given document matches a query
 */
function match(obj, query) {
    // Primitive query against a primitive type
    // This is a bit of a hack since we construct an object with an arbitrary key only to dereference it later
    // But I don't have time for a cleaner implementation now
    if (isPrimitiveType(obj) || isPrimitiveType(query)) {
        return matchQueryPart({ needAKey: obj }, "needAKey", query);
    }
    // Normal query
    let queryKeys = Object.keys(query);
    for (let i = 0; i < queryKeys.length; i += 1) {
        let queryKey = queryKeys[i];
        let queryValue = query[queryKey];
        if (queryKey[0] === "$") {
            if (!logicalOperators[queryKey]) {
                throw new Error("Unknown logical operator " + queryKey);
            }
            if (!logicalOperators[queryKey](obj, queryValue)) {
                return false;
            }
        }
        else {
            if (!matchQueryPart(obj, queryKey, queryValue)) {
                return false;
            }
        }
    }
    return true;
}
/**
 * Match an object against a specific { key: value } part of a query
 * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
 */
function matchQueryPart(obj, queryKey, queryValue, treatObjAsValue) {
    const objValue = getDotValue(obj, queryKey);
    // Check if the value is an array if we don't force a treatment as value
    if (Array.isArray(objValue) && !treatObjAsValue) {
        // If the queryValue is an array, try to perform an exact match
        if (Array.isArray(queryValue)) {
            return matchQueryPart(obj, queryKey, queryValue, true);
        }
        // Check if we are using an array-specific comparison function
        if (queryValue !== null &&
            typeof queryValue === "object" &&
            !(queryValue instanceof RegExp)) {
            let keys = Object.keys(queryValue);
            for (let i = 0; i < keys.length; i += 1) {
                if (arrayComparisonFunctions[keys[i]]) {
                    return matchQueryPart(obj, queryKey, queryValue, true);
                }
            }
        }
        // If not, treat it as an array of { obj, query } where there needs to be at least one match
        for (let i = 0; i < objValue.length; i += 1) {
            // edge case: using $ne on array
            if (queryValue["$ne"]) {
                if (objValue.indexOf(queryValue["$ne"]) !== -1) {
                    return false;
                }
            }
            if (Array.isArray(queryValue["$nin"])) {
                const intersection = queryValue["$nin"].filter((value) => -1 !== objValue.indexOf(value));
                if (intersection.length) {
                    return false;
                }
            }
            if (matchQueryPart({ k: objValue[i] }, "k", queryValue)) {
                return true;
            } // k here could be any string
        }
        return false;
    }
    // queryValue is an actual object. Determine whether it contains comparison operators
    // or only normal fields. Mixed objects are not allowed
    if (queryValue !== null &&
        typeof queryValue === "object" &&
        !(queryValue instanceof RegExp) &&
        !Array.isArray(queryValue)) {
        let keys = Object.keys(queryValue);
        let firstChars = keys.map((item) => item[0]);
        let dollarFirstChars = firstChars.filter((c) => c === "$");
        if (dollarFirstChars.length !== 0 &&
            dollarFirstChars.length !== firstChars.length) {
            throw new Error("You cannot mix operators and normal fields");
        }
        // queryValue is an object of this form: { $comparisonOperator1: value1, ... }
        if (dollarFirstChars.length > 0) {
            for (let i = 0; i < keys.length; i += 1) {
                if (!comparisonFunctions[keys[i]]) {
                    throw new Error("Unknown comparison function " + keys[i]);
                }
                if (!comparisonFunctions[keys[i]](objValue, queryValue[keys[i]])) {
                    return false;
                }
            }
            return true;
        }
    }
    // Using regular expressions with basic querying
    if (queryValue instanceof RegExp) {
        return comparisonFunctions.$regex(objValue, queryValue);
    }
    // queryValue is either a native value or a normal object
    // Basic matching is possible
    if (!areThingsEqual(objValue, queryValue)) {
        return false;
    }
    return true;
}

var modelling = /*#__PURE__*/Object.freeze({
    __proto__: null,
    serialize: serialize,
    deserialize: deserialize,
    deepCopy: deepCopy,
    checkObject: checkObject,
    isPrimitiveType: isPrimitiveType,
    modify: modify,
    getDotValue: getDotValue,
    match: match,
    areThingsEqual: areThingsEqual,
    compareThings: compareThings
});

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

/**
 * Create a new cursor for this collection
 */
class Cursor {
    constructor(db, query) {
        this.db = db;
        this.query = query || {};
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
    projection(projection) {
        this._projection = projection;
        return this;
    }
    /**
     * Apply the projection
     */
    _project(candidates) {
        if (this._projection === undefined ||
            Object.keys(this._projection).length === 0) {
            return candidates;
        }
        let res = [];
        let keepId = this._projection._id !== 0;
        delete this._projection._id;
        let keys = Object.keys(this._projection);
        // Check for consistency
        // either all are 0, or all are -1
        let actions = keys.map((k) => this._projection[k]).sort();
        if (actions[0] !== actions[actions.length - 1]) {
            throw new Error("Can't both keep and omit fields except for _id");
        }
        let action = actions[0];
        // Do the actual projection
        candidates.forEach((candidate) => {
            let toPush = {};
            if (action === 1) {
                // pick-type projection
                toPush = { $set: {} };
                keys.forEach((k) => {
                    toPush.$set[k] = getDotValue(candidate, k);
                    if (toPush.$set[k] === undefined) {
                        delete toPush.$set[k];
                    }
                });
                toPush = modify({}, toPush, this.db.model);
            }
            else {
                // omit-type projection
                toPush = { $unset: {} };
                keys.forEach((k) => {
                    toPush.$unset[k] = true;
                });
                toPush = modify(candidate, toPush, this.db.model);
            }
            if (keepId) {
                toPush._id = candidate._id;
            }
            else {
                delete toPush._id;
            }
            res.push(toPush);
        });
        return res;
    }
    /**
     * Get all matching elements
     * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
     *
     */
    __exec_unsafe() {
        return __awaiter(this, void 0, void 0, function* () {
            let res = [];
            let added = 0;
            let skipped = 0;
            const candidates = yield this.db.getCandidates(this.query);
            for (let i = 0; i < candidates.length; i++) {
                if (match(candidates[i], this.query)) {
                    // If a sort is defined, wait for the results to be sorted before applying limit and skip
                    if (!this._sort) {
                        if (this._skip && this._skip > skipped) {
                            skipped++;
                        }
                        else {
                            res.push(candidates[i]);
                            added++;
                            if (this._limit && this._limit <= added) {
                                break;
                            }
                        }
                    }
                    else {
                        res.push(candidates[i]);
                    }
                }
            }
            // Apply all sorts
            if (this._sort) {
                let keys = Object.keys(this._sort);
                // Sorting
                const criteria = [];
                for (let i = 0; i < keys.length; i++) {
                    let key = keys[i];
                    criteria.push({ key, direction: this._sort[key] });
                }
                res.sort((a, b) => {
                    let criterion;
                    let compare;
                    let i;
                    for (i = 0; i < criteria.length; i++) {
                        criterion = criteria[i];
                        compare =
                            criterion.direction *
                                compareThings(getDotValue(a, criterion.key), getDotValue(b, criterion.key));
                        if (compare !== 0) {
                            return compare;
                        }
                    }
                    return 0;
                });
                // Applying limit and skip
                const limit = this._limit || res.length;
                const skip = this._skip || 0;
                res = res.slice(skip, skip + limit);
            }
            // Apply projection
            res = this._project(res);
            return res;
        });
    }
    _exec() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db.q.add(() => this.__exec_unsafe());
        });
    }
    exec() {
        return __awaiter(this, void 0, void 0, function* () {
            const originalsArr = yield this._exec();
            const res = [];
            for (let index = 0; index < originalsArr.length; index++) {
                res.push(deepCopy(originalsArr[index], this.db.model));
            }
            return res;
        });
    }
}

class Node {
    /**
     * Creates a new AVL Tree node.
     * @param key The key of the new node.
     * @param value The value of the new node.
     */
    constructor(key, value) {
        this.left = null;
        this.right = null;
        this.height = null;
        this.value = [];
        this.value.push(value);
        this.key = key;
    }
    /**
     * Performs a right rotate on this node.
     * @return The root of the sub-tree; the node where this node used to be.
     * @throws If Node.left is null.
     */
    rotateRight() {
        //     b                           a
        //    / \                         / \
        //   a   e -> b.rotateRight() -> c   b
        //  / \                             / \
        // c   d                           d   e
        const other = this.left;
        this.left = other.right;
        other.right = this;
        this.height = Math.max(this.leftHeight, this.rightHeight) + 1;
        other.height = Math.max(other.leftHeight, this.height) + 1;
        return other;
    }
    /**
     * Performs a left rotate on this node.
     * @return The root of the sub-tree; the node where this node used to be.
     * @throws If Node.right is null.
     */
    rotateLeft() {
        //   a                              b
        //  / \                            / \
        // c   b   -> a.rotateLeft() ->   a   e
        //    / \                        / \
        //   d   e                      c   d
        const other = this.right;
        this.right = other.left;
        other.left = this;
        this.height = Math.max(this.leftHeight, this.rightHeight) + 1;
        other.height = Math.max(other.rightHeight, this.height) + 1;
        return other;
    }
    /**
     * Convenience function to get the height of the left child of the node,
     * returning -1 if the node is null.
     * @return The height of the left child, or -1 if it doesn't exist.
     */
    get leftHeight() {
        if (this.left === null) {
            return -1;
        }
        return this.left.height || 0;
    }
    /**
     * Convenience function to get the height of the right child of the node,
     * returning -1 if the node is null.
     * @return The height of the right child, or -1 if it doesn't exist.
     */
    get rightHeight() {
        if (this.right === null) {
            return -1;
        }
        return this.right.height || 0;
    }
    executeOnEveryNode(fn) {
        if (this.left) {
            this.left.executeOnEveryNode(fn);
        }
        fn(this);
        if (this.right) {
            this.right.executeOnEveryNode(fn);
        }
    }
    /**
     * Get all data for a key between bounds
     * Return it in key order
     */
    betweenBounds(query, lbm, ubm) {
        let res = [];
        if (!this.hasOwnProperty("key")) {
            return [];
        }
        lbm = lbm || this.getLowerBoundMatcher(query);
        ubm = ubm || this.getUpperBoundMatcher(query);
        if (lbm(this.key) && this.left) {
            res = res.concat(this.left.betweenBounds(query, lbm, ubm));
        }
        if (lbm(this.key) && ubm(this.key) && this.value) {
            res = res.concat(this.value);
        }
        if (ubm(this.key) && this.right) {
            res = res.concat(this.right.betweenBounds(query, lbm, ubm));
        }
        return res;
    }
    /**
     * Return a function that tells whether a given key matches a lower bound
     */
    getLowerBoundMatcher(query) {
        // No lower bound
        if (!query.hasOwnProperty("$gt") && !query.hasOwnProperty("$gte")) {
            return () => true;
        }
        if (query.hasOwnProperty("$gt") && query.hasOwnProperty("$gte")) {
            if (this.compareKeys(query.$gte, query.$gt) === 0) {
                return (key) => this.compareKeys(key, query.$gt) > 0;
            }
            if (this.compareKeys(query.$gte, query.$gt) > 0) {
                return (key) => this.compareKeys(key, query.$gte) >= 0;
            }
            else {
                return (key) => this.compareKeys(key, query.$gt) > 0;
            }
        }
        if (query.hasOwnProperty("$gt")) {
            return (key) => this.compareKeys(key, query.$gt) > 0;
        }
        else {
            return (key) => this.compareKeys(key, query.$gte) >= 0;
        }
    }
    /**
     * Return a function that tells whether a given key matches an upper bound
     */
    getUpperBoundMatcher(query) {
        // No lower bound
        if (!query.hasOwnProperty("$lt") && !query.hasOwnProperty("$lte")) {
            return () => true;
        }
        if (query.hasOwnProperty("$lt") && query.hasOwnProperty("$lte")) {
            if (this.compareKeys(query.$lte, query.$lt) === 0) {
                return (key) => this.compareKeys(key, query.$lt) < 0;
            }
            if (this.compareKeys(query.$lte, query.$lt) < 0) {
                return (key) => this.compareKeys(key, query.$lte) <= 0;
            }
            else {
                return (key) => this.compareKeys(key, query.$lt) < 0;
            }
        }
        if (query.hasOwnProperty("$lt")) {
            return (key) => this.compareKeys(key, query.$lt) < 0;
        }
        else {
            return (key) => this.compareKeys(key, query.$lte) <= 0;
        }
    }
    compareKeys(a, b) {
        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
        return 0;
    }
    numberOfKeys() {
        let res = 1;
        if (this.left) {
            res += this.left.numberOfKeys();
        }
        if (this.right) {
            res += this.right.numberOfKeys();
        }
        return res;
    }
}
class AvlTree {
    /**
     * Creates a new AVL Tree.
     * @param _compare An optional custom compare function.
     */
    constructor(fieldName, compare, unique = false) {
        this._root = null;
        this._size = 0;
        this.unique = false;
        this.fieldName = '';
        this._compare = compare ? compare : this._defaultCompare;
        this.unique = unique;
        this.fieldName = fieldName;
    }
    /**
     * Compares two keys with each other.
     * @param a The first key to compare.
     * @param b The second key to compare.
     * @return -1, 0 or 1 if a < b, a == b or a > b respectively.
     */
    _defaultCompare(a, b) {
        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
        return 0;
    }
    /**
     * Inserts a new node with a specific key into the tree.
     * @param key The key being inserted.
     * @param value The value being inserted.
     */
    insert(key, value) {
        this._root = this._insert(key, value, this._root);
        this._size++;
    }
    /**
     * Inserts a new node with a specific key into the tree.
     * @param key The key being inserted.
     * @param root The root of the tree to insert in.
     * @return The new tree root.
     */
    _insert(key, value, root) {
        // Perform regular BST insertion
        if (root === null) {
            return new Node(key, value);
        }
        if (this._compare(key, root.key) < 0) {
            root.left = this._insert(key, value, root.left);
        }
        else if (this._compare(key, root.key) > 0) {
            root.right = this._insert(key, value, root.right);
        }
        else if (!this.unique) {
            root.value.push(value);
            return root;
        }
        else {
            // It's a duplicate so insertion failed, decrement size to make up for it
            if (this.size > 0) {
                this._size--;
            }
            const err = new Error(`Can't insert key ${key}, it violates the unique constraint`);
            err.key = key;
            err.prop = this.fieldName;
            err.errorType = "uniqueViolated";
            throw err;
        }
        // Update height and rebalance tree
        root.height = Math.max(root.leftHeight, root.rightHeight) + 1;
        const balanceState = this._getBalanceState(root);
        if (balanceState === 4 /* BalanceState.UNBALANCED_LEFT */) {
            if (this._compare(key, root.left.key) < 0) {
                // Left left case
                root = root.rotateRight();
            }
            else {
                // Left right case
                root.left = root.left.rotateLeft();
                return root.rotateRight();
            }
        }
        if (balanceState === 0 /* BalanceState.UNBALANCED_RIGHT */) {
            if (this._compare(key, root.right.key) > 0) {
                // Right right case
                root = root.rotateLeft();
            }
            else {
                // Right left case
                root.right = root.right.rotateRight();
                return root.rotateLeft();
            }
        }
        return root;
    }
    /**
     * Deletes a node with a specific key from the tree.
     * @param key The key being deleted.
     */
    delete(key, doc) {
        this._root = this._delete(key, doc, this._root);
        if (this.size > 0)
            this._size--;
    }
    /**
     * Deletes a node with a specific key from the tree.
     * @param key The key being deleted.
     * @param root The root of the tree to delete from.
     * @return The new tree root.
     */
    _delete(key, doc, root) {
        // Perform regular BST deletion
        if (root === null) {
            this._size++;
            return root;
        }
        if (this._compare(key, root.key) < 0) {
            // The key to be deleted is in the left sub-tree
            root.left = this._delete(key, doc, root.left);
        }
        else if (this._compare(key, root.key) > 0) {
            // The key to be deleted is in the right sub-tree
            root.right = this._delete(key, doc, root.right);
        }
        else {
            // root is the node to be deleted
            if (root.value.length > 1) {
                // removing item from array only
                // not whole node
                root.value.splice(root.value.indexOf(doc), 1);
                return root;
            }
            if (!root.left && !root.right) {
                root = null;
            }
            else if (!root.left && root.right) {
                root = root.right;
            }
            else if (root.left && !root.right) {
                root = root.left;
            }
            else {
                // Node has 2 children, get the in-order successor
                const inOrderSuccessor = this._minValueNode(root.right);
                root.key = inOrderSuccessor.key;
                root.value = inOrderSuccessor.value;
                root.right = this._delete(inOrderSuccessor.key, doc, root.right);
            }
        }
        if (root === null) {
            return root;
        }
        // Update height and rebalance tree
        root.height = Math.max(root.leftHeight, root.rightHeight) + 1;
        const balanceState = this._getBalanceState(root);
        if (balanceState === 4 /* BalanceState.UNBALANCED_LEFT */) {
            // Left left case
            if (this._getBalanceState(root.left) ===
                2 /* BalanceState.BALANCED */ ||
                this._getBalanceState(root.left) ===
                    3 /* BalanceState.SLIGHTLY_UNBALANCED_LEFT */) {
                return root.rotateRight();
            }
            // Left right case
            // this._getBalanceState(root.left) === BalanceState.SLIGHTLY_UNBALANCED_RIGHT
            root.left = root.left.rotateLeft();
            return root.rotateRight();
        }
        if (balanceState === 0 /* BalanceState.UNBALANCED_RIGHT */) {
            // Right right case
            if (this._getBalanceState(root.right) ===
                2 /* BalanceState.BALANCED */ ||
                this._getBalanceState(root.right) ===
                    1 /* BalanceState.SLIGHTLY_UNBALANCED_RIGHT */) {
                return root.rotateLeft();
            }
            // Right left case
            // this._getBalanceState(root.right) === BalanceState.SLIGHTLY_UNBALANCED_LEFT
            root.right = root.right.rotateRight();
            return root.rotateLeft();
        }
        return root;
    }
    /**
     * Gets the value of a node within the tree with a specific key.
     * @param key The key being searched for.
     * @return The value of the node (which may be undefined), or null if it
     * doesn't exist.
     */
    get(key) {
        if (this._root === null) {
            return [];
        }
        const result = this._get(key, this._root);
        if (result === null) {
            return [];
        }
        if (!result.value) {
            return [];
        }
        return result.value;
    }
    /**
     * Gets the value of a node within the tree with a specific key.
     * @param key The key being searched for.
     * @param root The root of the tree to search in.
     * @return The value of the node or null if it doesn't exist.
     */
    _get(key, root) {
        const result = this._compare(key, root.key);
        if (result === 0) {
            return root;
        }
        if (result < 0) {
            if (!root.left) {
                return null;
            }
            return this._get(key, root.left);
        }
        if (!root.right) {
            return null;
        }
        return this._get(key, root.right);
    }
    /**
     * Gets whether a node with a specific key is within the tree.
     * @param key The key being searched for.
     * @return Whether a node with the key exists.
     */
    contains(key) {
        if (this._root === null) {
            return false;
        }
        return !!this._get(key, this._root);
    }
    /**
     * @return The minimum key in the tree or null if there are no nodes.
     */
    findMinimum() {
        if (this._root === null) {
            return null;
        }
        return this._minValueNode(this._root).key;
    }
    /**
     * Gets the maximum key in the tree or null if there are no nodes.
     */
    findMaximum() {
        if (this._root === null) {
            return null;
        }
        return this._maxValueNode(this._root).key;
    }
    get numberOfKeys() {
        var _a;
        return ((_a = this._root) === null || _a === void 0 ? void 0 : _a.numberOfKeys()) || 0;
    }
    /**
     * Gets the size of the tree.
     */
    get size() {
        return this._size;
    }
    /**
     * Gets whether the tree is empty.
     */
    get isEmpty() {
        return this._size === 0;
    }
    /**
     * Gets the minimum value node, rooted in a particular node.
     * @param root The node to search.
     * @return The node with the minimum key in the tree.
     */
    _minValueNode(root) {
        let current = root;
        while (current.left) {
            current = current.left;
        }
        return current;
    }
    /**
     * Gets the maximum value node, rooted in a particular node.
     * @param root The node to search.
     * @return The node with the maximum key in the tree.
     */
    _maxValueNode(root) {
        let current = root;
        while (current.right) {
            current = current.right;
        }
        return current;
    }
    /**
     * Gets the balance state of a node, indicating whether the left or right
     * sub-trees are unbalanced.
     * @param node The node to get the difference from.
     * @return The BalanceState of the node.
     */
    _getBalanceState(node) {
        const heightDifference = node.leftHeight - node.rightHeight;
        switch (heightDifference) {
            case -2:
                return 0 /* BalanceState.UNBALANCED_RIGHT */;
            case -1:
                return 1 /* BalanceState.SLIGHTLY_UNBALANCED_RIGHT */;
            case 1:
                return 3 /* BalanceState.SLIGHTLY_UNBALANCED_LEFT */;
            case 2:
                return 4 /* BalanceState.UNBALANCED_LEFT */;
            default:
                return 2 /* BalanceState.BALANCED */;
        }
    }
    executeOnEveryNode(fn) {
        if (!this._root)
            return;
        return this._root.executeOnEveryNode(fn);
    }
    betweenBounds(query, lbm, ubm) {
        if (!this._root)
            return [];
        return this._root.betweenBounds(query, lbm, ubm);
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
            return key.substr(3);
        }
        else
            return key;
    });
}
class Index {
    constructor({ fieldName, unique, sparse, }) {
        this.fieldName = "";
        this.unique = false;
        this.sparse = false;
        if (fieldName) {
            this.fieldName = fieldName;
        }
        if (unique) {
            this.unique = unique;
        }
        if (sparse) {
            this.sparse = sparse;
        }
        this.tree = new AvlTree(this.fieldName, compareThings, this.unique);
    }
    reset() {
        this.tree = new AvlTree(this.fieldName, compareThings, this.unique);
    }
    /**
     * Insert a new document in the index
     * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
     * O(log(n))
     */
    insert(doc) {
        if (Array.isArray(doc)) {
            this.insertMultipleDocs(doc);
            return;
        }
        let key = getDotValue(doc, this.fieldName);
        // We don't index documents that don't contain the field if the index is sparse
        if (key === undefined && this.sparse) {
            return;
        }
        if (!Array.isArray(key)) {
            this.tree.insert(key, doc);
        }
        else {
            // If an insert fails due to a unique constraint, roll back all inserts before it
            let keys = uniqueProjectedKeys(key);
            let error;
            let failingIndex = -1;
            for (let i = 0; i < keys.length; i++) {
                try {
                    this.tree.insert(keys[i], doc);
                }
                catch (e) {
                    error = e;
                    failingIndex = i;
                    break;
                }
            }
            if (error) {
                for (let i = 0; i < failingIndex; i++) {
                    this.tree.delete(keys[i], doc);
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
            doc.forEach((d) => this.remove(d));
            return;
        }
        let key = getDotValue(doc, this.fieldName);
        if (key === undefined && this.sparse) {
            return;
        }
        if (!Array.isArray(key)) {
            this.tree.delete(key, doc);
        }
        else {
            uniqueProjectedKeys(key).forEach((_key) => this.tree.delete(_key, doc));
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
    /**
     * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
     */
    getMatching(input) {
        if (!Array.isArray(input)) {
            return this.tree.get(input);
        }
        else {
            let res = [];
            input.forEach((item) => {
                this.tree.get(item).forEach((singleRes) => {
                    if (!singleRes || !singleRes._id) {
                        return;
                    }
                    res.push(singleRes);
                });
            });
            return res.filter((x, i) => res.indexOf(x) === i);
        }
    }
    getAll() {
        let data = [];
        this.tree.executeOnEveryNode(function (node) {
            data = data.concat(node.value);
        });
        return data;
    }
    getBetweenBounds(query) {
        return this.tree.betweenBounds(query);
    }
}

class IDB {
    constructor(name) {
        const request = indexedDB.open(name);
        request.onupgradeneeded = () => request.result.createObjectStore(name);
        const dbp = this.pr(request);
        this.store = (txMode, callback) => dbp.then((db) => callback(db.transaction(name, txMode).objectStore(name)));
    }
    pr(req) {
        return new Promise((resolve, reject) => {
            // @ts-ignore - file size hacks
            req.oncomplete = req.onsuccess = () => resolve(req.result);
            // @ts-ignore - file size hacks
            req.onabort = req.onerror = () => reject(req.error);
        });
    }
    /**
     * Get a value by its key.
     * @param key
     */
    get(key) {
        return this.store("readonly", (store) => this.pr(store.get(key)));
    }
    /**
     * Set a value with a key.
     *
     * @param key
     * @param value
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
     *
     * @param entries Array of entries, where each entry is an array of `[key, value]`.
     */
    sets(entries) {
        return this.store("readwrite", (store) => {
            entries.forEach((entry) => store.put(entry[1], entry[0]));
            return this.pr(store.transaction);
        });
    }
    /**
     * Get multiple values by their keys
     *
     * @param keys
     */
    gets(keys) {
        return this.store("readonly", (store) => Promise.all(keys.map((key) => this.pr(store.get(key)))));
    }
    /**
     * Delete a particular key from the store.
     *
     * @param key
     */
    del(key) {
        return this.store("readwrite", (store) => {
            store.delete(key);
            return this.pr(store.transaction);
        });
    }
    /**
     * Delete multiple keys at once.
     *
     * @param keys List of keys to delete.
     */
    dels(keys) {
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
     * Get all keys in the store.
     *
     */
    keys() {
        return this.store("readonly", (store) => __awaiter(this, void 0, void 0, function* () {
            // Fast path for modern browsers
            if (store.getAllKeys) {
                return this.pr(store.getAllKeys());
            }
            const items = [];
            yield this.eachCursor(store, (cursor) => items.push(cursor.key));
            return items;
        }));
    }
    /**
     * Get all values in the store.
     */
    values() {
        return this.store("readonly", (store) => __awaiter(this, void 0, void 0, function* () {
            // Fast path for modern browsers
            if (store.getAll) {
                return this.pr(store.getAll());
            }
            const items = [];
            yield this.eachCursor(store, (cursor) => items.push(cursor.value));
            return items;
        }));
    }
    length() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.keys()).length;
        });
    }
}

const asc = (a, b) => (a > b ? 1 : -1);
class Sync {
    constructor(persistence, rdata) {
        this.p = persistence;
        this.rdata = rdata;
    }
    setLocalHash(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keys)
                keys = (yield this.p.data.keys());
            const hash = xxh(JSON.stringify(keys.sort(asc))).toString();
            this.p.data.set("$H", "$H" + hash + "_" + this.timeSignature());
        });
    }
    setRemoteHash(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!keys)
                keys = (yield this.rdata.keys());
            const hash = xxh(JSON.stringify(keys.sort(asc))).toString();
            this.rdata.setItem("$H", "$H" + hash + "_" + this.timeSignature());
        });
    }
    timeSignature() {
        return Math.floor(Date.now() / this.p.devalidateHash);
    }
    sync() {
        return new Promise((resolve, reject) => {
            let interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                if (!this.p.syncInProgress) {
                    clearInterval(interval);
                    this.p.syncInProgress = true;
                    let syncResult = { sent: 0, received: 0, diff: -1 };
                    let err = undefined;
                    try {
                        syncResult = yield this._sync();
                    }
                    catch (e) {
                        err = Error(e);
                    }
                    this.p.syncInProgress = false;
                    if (err)
                        reject(err);
                    else
                        resolve(syncResult);
                }
            }), 1);
        });
    }
    brace(key, getter, thisDiffs, thatDiffs) {
        return __awaiter(this, void 0, void 0, function* () {
            const _id = key.split("_")[0];
            const rev = key.split("_")[1];
            const thisTime = Number(rev.substring(2));
            const conflictingIndex = thatDiffs.findIndex((x) => x.key.startsWith(_id + "_"));
            if (conflictingIndex > -1) {
                const conflicting = thatDiffs[conflictingIndex];
                const conflictingRev = conflicting.key.split("_")[1];
                const conflictingTime = Number(conflictingRev.substring(2));
                if (thisTime > conflictingTime) {
                    // this wins
                    thatDiffs.splice(conflictingIndex, 1); // removing remote
                    thisDiffs.push({
                        key: key,
                        value: (yield getter(key)) || "",
                    });
                }
                // otherwise .. don't add to local diff
            }
            else {
                thisDiffs.push({
                    key: key,
                    value: (yield getter(key)) || "",
                });
            }
            return { thisDiffs, thatDiffs };
        });
    }
    causesUCV(input) {
        let line = this.p.treatSingleLine(input);
        if (line.status === "remove")
            return false;
        try {
            if (line.type === "doc") {
                // don't cause UCV by _id (without this line all updates would trigger UCV)
                // _id UCVs conflicts are only natural
                // and solved by the fact that they are persisted on the same index
                line.data._id = null;
                this.p.db.addToIndexes(line.data);
            }
            else {
                this.p.db.indexes[line.data.fieldName] = new Index(line.data.data);
                this.p.db.indexes[line.data.fieldName].insert(this.p.db.getAllData());
            }
        }
        catch (e) {
            if (line.type === "doc") {
                return {
                    type: "doc",
                    prop: e.prop,
                    value: e.key,
                };
            }
            else {
                delete this.p.db.indexes[line.data.fieldName];
                return {
                    type: "index",
                    fieldName: line.data.fieldName,
                    sparse: !!line.data.data.sparse,
                };
            }
        }
        this.p.db.removeFromIndexes(line.data);
        return false;
    }
    _sync() {
        return __awaiter(this, void 0, void 0, function* () {
            const timeSignature = this.timeSignature().toString();
            const rHash = (yield this.rdata.getItem("$H")) || "0";
            const lHash = (yield this.p.data.get("$H")) || "0";
            const hashTime = lHash.split("_")[1];
            if (hashTime === timeSignature &&
                (lHash === rHash ||
                    (lHash === "0" && (rHash || "").indexOf("10009") > -1))) {
                return { sent: 0, received: 0, diff: -1 };
            }
            const remoteKeys = (yield this.rdata.keys())
                .filter((x) => x !== "$H")
                .sort(asc);
            const localKeys = (yield this.p.data.keys())
                .filter((x) => x !== "$H")
                .sort(asc);
            const remoteDiffs = [];
            const localDiffs = [];
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
                    yield this.brace(rv, (x) => this.rdata.getItem(x), remoteDiffs, localDiffs);
                }
                else {
                    li++;
                    yield this.brace(lv, (x) => this.p.data.get(x), localDiffs, remoteDiffs);
                }
            }
            if (remoteDiffs.length === 0 && localDiffs.length === 0) {
                yield this.setLocalHash();
                yield this.setRemoteHash();
                return { sent: 0, received: 0, diff: 0 };
            }
            // downloading
            const downRemove = [];
            const downSet = [];
            for (let index = 0; index < remoteDiffs.length; index++) {
                const diff = remoteDiffs[index];
                const UCV = this.causesUCV(diff.value);
                // if unique constraint violations occured
                // make the key non-unique
                // any other implementation would result in unjustified complexity
                if (UCV && UCV.type === "doc") {
                    const uniqueProp = UCV.prop;
                    yield this.p.data.set(localKeys.find((x) => x.startsWith(uniqueProp + "_")) || "", this.p.encode(serialize({
                        $$indexCreated: {
                            fieldName: uniqueProp,
                            unique: false,
                            sparse: this.p.db.indexes[uniqueProp].sparse,
                        },
                    })));
                }
                else if (UCV && UCV.type === "index") {
                    diff.value = this.p.encode(serialize({
                        $$indexCreated: {
                            fieldName: UCV.fieldName,
                            unique: false,
                            sparse: UCV.sparse,
                        },
                    }));
                }
                const oldIDRev = localKeys.find((key) => key.toString().startsWith(diff.key.split("_")[0] + "_")) || "";
                if (oldIDRev)
                    downRemove.push(oldIDRev);
                downSet.push([diff.key, diff.value]);
            }
            yield this.p.data.dels(downRemove);
            yield this.p.data.sets(downSet);
            yield this.setLocalHash();
            // uploading
            const upRemove = [];
            const upSet = [];
            for (let index = 0; index < localDiffs.length; index++) {
                const diff = localDiffs[index];
                const oldIDRev = remoteKeys.find((key) => key.toString().startsWith(diff.key.split("_")[0] + "_")) || "";
                if (oldIDRev)
                    upRemove.push(oldIDRev);
                upSet.push({ key: diff.key, value: diff.value });
            }
            yield this.rdata.removeItems(upRemove);
            yield this.rdata.setItems(upSet);
            yield this.setRemoteHash();
            yield this.p.loadDatabase();
            return {
                sent: localDiffs.length,
                received: remoteDiffs.length,
                diff: 1,
            };
        });
    }
}

class PersistenceEvent {
    constructor() {
        this.callbacks = {
            readLine: [],
            writeLine: [],
            end: [],
        };
    }
    on(event, cb) {
        if (!this.callbacks[event])
            this.callbacks[event] = [];
        this.callbacks[event].push(cb);
    }
    emit(event, data) {
        return __awaiter(this, void 0, void 0, function* () {
            let cbs = this.callbacks[event];
            if (cbs) {
                for (let i = 0; i < cbs.length; i++) {
                    const cb = cbs[i];
                    yield cb(data);
                }
            }
        });
    }
}
/**
 * Create a new Persistence object for database options.db
 */
class Persistence {
    constructor(options) {
        this.ref = "";
        this.syncInterval = 0;
        this.syncInProgress = false;
        this.devalidateHash = 0;
        this.corruptAlertThreshold = 0.1;
        this.encode = (s) => s;
        this.decode = (s) => s;
        this._model = options.model;
        this.db = options.db;
        this.ref = this.db.ref;
        this.data = new IDB(this.ref);
        this.RSA = options.syncToRemote;
        this.devalidateHash = options.devalidateHash || 0;
        this.syncInterval = options.syncInterval || 0;
        if (this.RSA) {
            const rdata = this.RSA(this.ref);
            this.sync = new Sync(this, rdata);
        }
        if (this.RSA && this.syncInterval) {
            setInterval(() => __awaiter(this, void 0, void 0, function* () {
                if (!this.syncInProgress) {
                    let err = undefined;
                    this.syncInProgress = true;
                    try {
                        yield this.sync._sync();
                    }
                    catch (e) {
                        err = e;
                    }
                    this.syncInProgress = false;
                    if (err)
                        throw new Error(err);
                }
            }), this.syncInterval);
        }
        this.corruptAlertThreshold =
            options.corruptAlertThreshold !== undefined
                ? options.corruptAlertThreshold
                : 0.1;
        // encode and decode hooks with some basic sanity checks
        if (options.encode && !options.decode) {
            throw new Error("encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent dataloss");
        }
        if (!options.encode && options.decode) {
            throw new Error("decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent dataloss");
        }
        this.encode = options.encode || this.encode;
        this.decode = options.decode || this.decode;
        let randomString$1 = randomString(113);
        if (this.decode(this.encode(randomString$1)) !== randomString$1) {
            throw new Error("encode is not the reverse of decode, cautiously refusing to start data store to prevent dataloss");
        }
    }
    writeNewIndex(newIndexes) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeData(newIndexes.map((x) => [
                x.$$indexCreated.fieldName,
                this.encode(serialize(x)),
            ]));
        });
    }
    writeNewData(newDocs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeData(newDocs.map((x) => [x._id || "", this.encode(serialize(x))]));
        });
    }
    treatSingleLine(line) {
        let treatedLine;
        try {
            treatedLine = deserialize(this.decode(line));
            if (this._model) {
                treatedLine = this._model.new(treatedLine);
            }
        }
        catch (e) {
            return {
                type: "corrupt",
                status: "remove",
                data: false,
            };
        }
        if (treatedLine._id &&
            !(treatedLine.$$indexCreated || treatedLine.$$indexRemoved)) {
            if (treatedLine.$$deleted === true) {
                return {
                    type: "doc",
                    status: "remove",
                    data: { _id: treatedLine._id },
                };
            }
            else {
                return {
                    type: "doc",
                    status: "add",
                    data: treatedLine,
                };
            }
        }
        else if (treatedLine.$$indexCreated &&
            treatedLine.$$indexCreated.fieldName !== undefined) {
            return {
                type: "index",
                status: "add",
                data: {
                    fieldName: treatedLine.$$indexCreated.fieldName,
                    data: treatedLine.$$indexCreated,
                },
            };
        }
        else if (typeof treatedLine.$$indexRemoved === "string") {
            return {
                type: "index",
                status: "remove",
                data: { fieldName: treatedLine.$$indexRemoved },
            };
        }
        else {
            return {
                type: "corrupt",
                status: "remove",
                data: true,
            };
        }
    }
    /**
     * Load the database
     * 1) Create all indexes
     * 2) Insert all data
     */
    loadDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            this.db.q.pause();
            this.db.resetIndexes(true);
            let corrupt = 0;
            let processed = 0;
            const indexes = [];
            const data = [];
            const eventEmitter = new PersistenceEvent();
            eventEmitter.on("readLine", (line) => __awaiter(this, void 0, void 0, function* () {
                processed++;
                const treatedLine = this.treatSingleLine(line);
                if (treatedLine.type === "doc") {
                    data.push(treatedLine);
                }
                else if (treatedLine.type === "index") {
                    indexes.push(treatedLine);
                }
                else if (!treatedLine.data) {
                    corrupt++;
                }
            }));
            yield this.readData(eventEmitter);
            // treat indexes first
            for (let index = 0; index < indexes.length; index++) {
                const line = indexes[index];
                if (line.status === "add") {
                    this.db.indexes[line.data.fieldName] = new Index(line.data.data);
                }
                if (line.status === "remove") {
                    delete this.db.indexes[line.data.fieldName];
                }
            }
            // then data
            for (let index = 0; index < data.length; index++) {
                const line = data[index];
                if (line.status === "add") {
                    this.db.addToIndexes(line.data);
                }
                if (line.status === "remove") {
                    this.db.removeFromIndexes(line.data);
                }
            }
            if (processed > 0 && corrupt / processed > this.corruptAlertThreshold) {
                throw new Error(`More than ${Math.floor(100 * this.corruptAlertThreshold)}% of the data file is corrupt, the wrong decode hook might have been used. Cautiously refusing to start Datastore to prevent dataloss`);
            }
            this.db.q.start();
            return true;
        });
    }
    readData(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const all = yield this.data.values();
            for (let i = 0; i < all.length; i++) {
                const line = all[i];
                if ((!line.startsWith("$H")) && line !== "$deleted")
                    event.emit("readLine", line);
            }
            event.emit("end", "");
        });
    }
    deleteData(_ids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.RSA)
                return this.data.dels(_ids);
            const keys = (yield this.data.keys());
            const oldIDRevs = [];
            const newIDRevs = [];
            for (let index = 0; index < _ids.length; index++) {
                const _id = _ids[index];
                const oldIDRev = keys.find((key) => key.toString().startsWith(_id + "_")) || "";
                const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
                const newIDRev = _id + "_" + newRev;
                oldIDRevs.push(oldIDRev);
                newIDRevs.push(newIDRev);
                keys.splice(keys.indexOf(oldIDRev), 1);
                keys.push(newIDRev);
            }
            yield this.data.dels(oldIDRevs);
            yield this.data.sets(newIDRevs.map((x) => [x, "$deleted"]));
            if (this.sync)
                yield this.sync.setLocalHash(keys);
        });
    }
    writeData(input) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.RSA)
                return this.data.sets(input);
            const keys = (yield this.data.keys());
            const oldIDRevs = [];
            const newIDRevsData = [];
            for (let index = 0; index < input.length; index++) {
                const element = input[index];
                const oldIDRev = keys.find((key) => key.toString().startsWith(element[0] + "_")) || "";
                const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
                const newIDRev = element[0] + "_" + newRev;
                oldIDRevs.push(oldIDRev);
                newIDRevsData.push([newIDRev, element[1]]);
                keys.splice(keys.indexOf(oldIDRev), 1);
                keys.push(newIDRev);
            }
            yield this.data.dels(oldIDRevs);
            yield this.data.sets(newIDRevsData);
            if (this.sync)
                yield this.sync.setLocalHash(keys);
        });
    }
    /**
     * Deletes all data
     * deletions will not be syncable
     */
    deleteEverything() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.data.clear();
        });
    }
}

class BaseModel {
    constructor() {
        this._id = uid();
    }
    static new(data) {
        const instance = new this();
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            instance[key] = data[key];
        }
        return instance;
    }
}

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
            const run = () => __awaiter(this, void 0, void 0, function* () {
                this._ongoingCount++;
                try {
                    const val = yield Promise.resolve().then(fn);
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
            });
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

class Datastore {
    constructor(options) {
        this.ref = "db";
        this.timestampData = false;
        // rename to something denotes that it's an internal thing
        this.q = new Q(1);
        this.indexes = {
            _id: new Index({ fieldName: "_id", unique: true }),
        };
        this.ttlIndexes = {};
        this.model = options.model || BaseModel;
        if (options.ref) {
            this.ref = options.ref;
        }
        // Persistence handling
        this.persistence = new Persistence({
            db: this,
            model: options.model,
            encode: options.encode,
            decode: options.decode,
            corruptAlertThreshold: options.corruptAlertThreshold || 0,
            syncToRemote: options.syncToRemote,
            syncInterval: options.syncInterval,
            devalidateHash: options.devalidateHash
        });
        if (options.timestampData) {
            this.timestampData = true;
        }
    }
    /**
     * Load the database from the datafile, and trigger the execution of buffered commands if any
     */
    loadDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.persistence.loadDatabase();
        });
    }
    /**
     * Get an array of all the data in the database
     */
    getAllData() {
        return this.indexes._id.getAll();
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
    ensureIndex(options) {
        return __awaiter(this, void 0, void 0, function* () {
            options = options || {};
            if (!options.fieldName) {
                let err = new Error("Cannot create an index without a fieldName");
                err.missingFieldName = true;
                throw err;
            }
            if (this.indexes[options.fieldName]) {
                return { affectedIndex: options.fieldName };
            }
            this.indexes[options.fieldName] = new Index(options);
            // TTL
            if (options.expireAfterSeconds !== undefined) {
                this.ttlIndexes[options.fieldName] = options.expireAfterSeconds;
            }
            // Index data
            try {
                this.indexes[options.fieldName].insert(this.getAllData());
            }
            catch (e) {
                delete this.indexes[options.fieldName];
                throw e;
            }
            // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
            yield this.persistence.writeNewIndex([{ $$indexCreated: options }]);
            return {
                affectedIndex: options.fieldName,
            };
        });
    }
    /**
     * Remove an index
     */
    removeIndex(fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            delete this.indexes[fieldName];
            yield this.persistence.deleteData([fieldName]);
            return {
                affectedIndex: fieldName,
            };
        });
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
    _isBasicType(value) {
        return (typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value instanceof Date ||
            value === null);
    }
    /**
     * This will return the least number of candidates,
     * using Index if possible
     * when failing it will return all the database
     */
    _leastCandidates(query) {
        const currentIndexKeys = Object.keys(this.indexes);
        const queryKeys = Object.keys(query);
        let usableQueryKeys = [];
        // possibility: basic match
        queryKeys.forEach((k) => {
            // only types that can't be used with . notation
            if (this._isBasicType(query[k]) &&
                currentIndexKeys.indexOf(k) !== -1) {
                usableQueryKeys.push(k);
            }
        });
        if (usableQueryKeys.length > 0) {
            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]]);
        }
        // possibility: using $eq
        queryKeys.forEach((k) => {
            if (query[k] &&
                query[k].hasOwnProperty("$eq") &&
                this._isBasicType(query[k].$eq) &&
                currentIndexKeys.indexOf(k) !== -1) {
                usableQueryKeys.push(k);
            }
        });
        if (usableQueryKeys.length > 0) {
            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$eq);
        }
        // possibility: using $in
        queryKeys.forEach((k) => {
            if (query[k] &&
                query[k].hasOwnProperty("$in") &&
                currentIndexKeys.indexOf(k) !== -1) {
                usableQueryKeys.push(k);
            }
        });
        if (usableQueryKeys.length > 0) {
            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$in);
        }
        // possibility: using $lt $lte $gt $gte
        queryKeys.forEach((k) => {
            if (query[k] &&
                currentIndexKeys.indexOf(k) !== -1 &&
                (query[k].hasOwnProperty("$lt") ||
                    query[k].hasOwnProperty("$lte") ||
                    query[k].hasOwnProperty("$gt") ||
                    query[k].hasOwnProperty("$gte"))) {
                usableQueryKeys.push(k);
            }
        });
        if (usableQueryKeys.length > 0) {
            return this.indexes[usableQueryKeys[0]].getBetweenBounds(query[usableQueryKeys[0]]);
        }
        return this.getAllData();
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
    getCandidates(query, dontExpireStaleDocs) {
        return __awaiter(this, void 0, void 0, function* () {
            let candidates = this._leastCandidates(query);
            if (dontExpireStaleDocs) {
                if (Array.isArray(candidates))
                    return candidates;
                else if (candidates === null)
                    return [];
                else
                    return [candidates];
            }
            const expiredDocsIds = [];
            const validDocs = [];
            const ttlIndexesFieldNames = Object.keys(this.ttlIndexes);
            if (!candidates)
                return [];
            if (!Array.isArray(candidates))
                candidates = [candidates];
            candidates.forEach((candidate) => {
                let valid = true;
                ttlIndexesFieldNames.forEach((field) => {
                    if (candidate[field] !== undefined &&
                        candidate[field] instanceof Date &&
                        Date.now() >
                            candidate[field].getTime() +
                                this.ttlIndexes[field] * 1000) {
                        valid = false;
                    }
                });
                if (valid) {
                    validDocs.push(candidate);
                }
                else if (candidate._id) {
                    expiredDocsIds.push(candidate._id);
                }
            });
            for (let index = 0; index < expiredDocsIds.length; index++) {
                const _id = expiredDocsIds[index];
                yield this._remove({ _id }, { multi: false });
            }
            return validDocs;
        });
    }
    /**
     * Insert a new document
     */
    _insert(newDoc) {
        return __awaiter(this, void 0, void 0, function* () {
            let preparedDoc = this.prepareDocumentForInsertion(newDoc);
            this._insertInCache(preparedDoc);
            // LQLQLQLQLQLQLQLQLQLQ CHECK LIVE QUERIES
            yield this.persistence.writeNewData(Array.isArray(preparedDoc) ? preparedDoc : [preparedDoc]);
            return deepCopy(preparedDoc, this.model);
        });
    }
    /**
     * Create a new _id that's not already in use
     */
    createNewId() {
        let tentativeId = uid();
        if (this.indexes._id.getMatching(tentativeId).length > 0) {
            tentativeId = this.createNewId();
        }
        return tentativeId;
    }
    /**
     * Prepare a document (or array of documents) to be inserted in a database
     * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
     */
    prepareDocumentForInsertion(newDoc) {
        let preparedDoc = [];
        if (Array.isArray(newDoc)) {
            newDoc.forEach((doc) => {
                preparedDoc.push(this.prepareDocumentForInsertion(doc));
            });
        }
        else {
            preparedDoc = deepCopy(newDoc, this.model);
            if (preparedDoc._id === undefined) {
                preparedDoc._id = this.createNewId();
            }
            const now = new Date();
            if (this.timestampData && preparedDoc.createdAt === undefined) {
                preparedDoc.createdAt = now;
            }
            if (this.timestampData && preparedDoc.updatedAt === undefined) {
                preparedDoc.updatedAt = now;
            }
            checkObject(preparedDoc);
        }
        return preparedDoc;
    }
    /**
     * If newDoc is an array of documents, this will insert all documents in the cache
     */
    _insertInCache(preparedDoc) {
        if (Array.isArray(preparedDoc)) {
            this._insertMultipleDocsInCache(preparedDoc);
        }
        else {
            this.addToIndexes(preparedDoc);
        }
    }
    /**
     * If one insertion fails (e.g. because of a unique constraint), roll back all previous
     * inserts and throws the error
     */
    _insertMultipleDocsInCache(preparedDocs) {
        let failingI = -1;
        let error;
        for (let i = 0; i < preparedDocs.length; i++) {
            try {
                this.addToIndexes(preparedDocs[i]);
            }
            catch (e) {
                error = e;
                failingI = i;
                break;
            }
        }
        if (error) {
            for (let i = 0; i < failingI; i++) {
                this.removeFromIndexes(preparedDocs[i]);
            }
            throw error;
        }
    }
    insert(newDoc) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.q.add(() => this._insert(newDoc));
            if (Array.isArray(res)) {
                return {
                    docs: res,
                    number: res.length,
                };
            }
            else {
                return {
                    docs: [res],
                    number: 1,
                };
            }
        });
    }
    /**
     * Count all documents matching the query
     */
    count(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const cursor = new Cursor(this, query);
            return (yield cursor.exec()).length;
        });
    }
    /**
     * Find all documents matching the query
     */
    find(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const cursor = new Cursor(this, query);
            const docs = yield cursor.exec();
            return docs;
        });
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
    _update(query, updateQuery, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let multi = options.multi !== undefined ? options.multi : false;
            let upsert = options.upsert !== undefined ? options.upsert : false;
            const cursor = new Cursor(this, query);
            cursor.limit(1);
            const res = yield cursor.__exec_unsafe();
            if (res.length > 0) {
                let numReplaced = 0;
                const candidates = yield this.getCandidates(query);
                const modifications = [];
                // Preparing update (if an error is thrown here neither the datafile nor
                // the in-memory indexes are affected)
                for (let i = 0; i < candidates.length; i++) {
                    if ((multi || numReplaced === 0) &&
                        match(candidates[i], query)) {
                        numReplaced++;
                        let createdAt = candidates[i].createdAt;
                        let modifiedDoc = modify(candidates[i], updateQuery, this.model);
                        if (createdAt) {
                            modifiedDoc.createdAt = createdAt;
                        }
                        if (this.timestampData &&
                            updateQuery.updatedAt === undefined &&
                            (!updateQuery.$set ||
                                updateQuery.$set.updatedAt === undefined)) {
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
                // Update the datafile
                const updatedDocs = modifications.map((x) => x.newDoc);
                // LQLQLQLQLQLQLQLQLQLQ CHECK LIVE QUERIES
                yield this.persistence.writeNewData(updatedDocs);
                return {
                    number: updatedDocs.length,
                    docs: updatedDocs.map((x) => deepCopy(x, this.model)),
                    upsert: false,
                };
            }
            else if (res.length === 0 && upsert) {
                if (!updateQuery.$setOnInsert) {
                    throw new Error("$setOnInsert modifier is required when upserting");
                }
                let toBeInserted = deepCopy(updateQuery.$setOnInsert, this.model, true);
                const newDoc = yield this._insert(toBeInserted);
                if (Array.isArray(newDoc)) {
                    return {
                        number: newDoc.length,
                        docs: newDoc,
                        upsert: true,
                    };
                }
                else {
                    return {
                        number: 1,
                        docs: [newDoc],
                        upsert: true,
                    };
                }
            }
            else {
                return {
                    number: 0,
                    docs: [],
                    upsert: false,
                };
            }
        });
    }
    update(query, updateQuery, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.q.add(() => this._update(query, updateQuery, options));
        });
    }
    /**
     * Remove all docs matching the query
     * For now very naive implementation (similar to update)
     */
    _remove(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let numRemoved = 0;
            const removedDocs = [];
            const removedFullDoc = [];
            let multi = options ? !!options.multi : false;
            const candidates = yield this.getCandidates(query, true);
            candidates.forEach((d) => {
                if (match(d, query) && (multi || numRemoved === 0)) {
                    numRemoved++;
                    removedFullDoc.push(deepCopy(d, this.model));
                    removedDocs.push({ $$deleted: true, _id: d._id });
                    this.removeFromIndexes(d);
                }
            });
            // LQLQLQLQLQLQLQLQLQLQ CHECK LIVE QUERIES
            yield this.persistence.deleteData(removedDocs.map(x => x._id || ""));
            return {
                number: numRemoved,
                docs: removedFullDoc,
            };
        });
    }
    remove(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.q.add(() => this._remove(query, options));
        });
    }
}

const savedNS = {};
const kvAdapter = (endpoint, token) => (name) => new Namespace({ endpoint, token, name });
function kvRequest(instance, method = "GET", path = "", body, parse = true) {
    return __awaiter(this, void 0, void 0, function* () {
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
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!savedNS[this.endpoint]) {
                savedNS[this.endpoint] = {};
            }
            if (savedNS[this.endpoint][this.name]) {
                // found saved
                this.id = savedNS[this.endpoint][this.name];
                return;
            }
            const remoteNamespaces = yield this.listStores();
            for (let index = 0; index < remoteNamespaces.length; index++) {
                const element = remoteNamespaces[index];
                savedNS[this.endpoint][element.name] = element.id;
            }
            if (savedNS[this.endpoint][this.name]) {
                // found remote
                this.id = savedNS[this.endpoint][this.name];
                return;
            }
            const id = yield this.createStore(this.name);
            savedNS[this.endpoint][this.name] = id;
            this.id = id;
        });
    }
    listStores() {
        return __awaiter(this, void 0, void 0, function* () {
            const namespaces = [];
            let currentPage = 1;
            let totalPages = 1;
            while (totalPages >= currentPage) {
                const res = yield kvRequest(this, "GET", `?page=${currentPage}`);
                if (typeof res === "string" ||
                    !res.success ||
                    !Array.isArray(res.result)) {
                    throw new Error("Error while listing namespaces: " + JSON.stringify(res));
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
        });
    }
    createStore(title) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield kvRequest(this, "POST", "", JSON.stringify({ title }));
            if (typeof res === "string" ||
                !res.success ||
                Array.isArray(res.result)) {
                throw new Error("Error while creating namespace: " + JSON.stringify(res));
            }
            else {
                return res.result.id;
            }
        });
    }
    removeStore() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
            const res = yield kvRequest(this, "DELETE", this.id);
            if (typeof res === "string" || !res.success) {
                throw new Error("Error while deleting namespace: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        });
    }
    removeItem(itemID) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
            const res = yield kvRequest(this, "DELETE", `${this.id}/values/${itemID}`);
            if (typeof res === "string" || !res.success) {
                throw new Error("Error while deleting item: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        });
    }
    setItem(itemID, itemData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
            const res = yield kvRequest(this, "PUT", `${this.id}/values/${itemID}`, itemData);
            if (typeof res === "string" || !res.success) {
                throw new Error("Error while setting item: " + JSON.stringify(res));
            }
            else {
                return true;
            }
        });
    }
    getItem(itemID) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
            const res = yield kvRequest(this, "GET", `${this.id}/values/${itemID}`, undefined, false);
            if (typeof res !== "string") {
                throw new Error("Error while getting item: " + JSON.stringify(res));
            }
            else {
                return res;
            }
        });
    }
    keys() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
            let keys = [];
            let cursor = "";
            do {
                const res = yield kvRequest(this, "GET", `${this.id}/keys${cursor ? `?cursor=${cursor}` : ""}`);
                if (typeof res === "string" ||
                    !res.success ||
                    !Array.isArray(res.result)) {
                    throw new Error("Error while listing keys: " + JSON.stringify(res));
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
        });
    }
    removeItems(items) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.id)
                yield this.connect();
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
                const res = yield kvRequest(this, "DELETE", `${this.id}/bulk`, JSON.stringify(batch));
                if (typeof res === "string" || !res.success) {
                    throw new Error("Error while deleting item: " + JSON.stringify(res));
                }
                else {
                    results.push(true);
                }
            }
            return results;
        });
    }
    setItems(items) {
        return __awaiter(this, void 0, void 0, function* () {
            // deal with 10,000 limit
            if (!this.id)
                yield this.connect();
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
                const res = yield kvRequest(this, "PUT", `${this.id}/bulk`, JSON.stringify(batch));
                if (typeof res === "string" || !res.success) {
                    throw new Error("Error while deleting item: " + JSON.stringify(res));
                }
                else {
                    results.push(true);
                }
            }
            return results;
        });
    }
    getItems(keys) {
        return __awaiter(this, void 0, void 0, function* () {
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
                valuesPromises.push(q.add(() => this.getItem(key)));
            }
            const values = yield Promise.all(valuesPromises);
            const result = [];
            for (let index = 0; index < keys.length; index++) {
                let key = keys[index];
                let value = values[index];
                result.push({ key, value });
            }
            return result;
        });
    }
}

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    kvAdapter: kvAdapter
});

const INSERT = "insert";
const UPDATE = "update";
const DELETE = "delete";
const REVERSE = "reverse";
const SHUFFLE = "shuffle";
const oMetaKey = Symbol.for("object-observer-meta-key-0");
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
        console.error(`failed to notify listener ${listener} with ${changes}`, e);
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
                for (const btch of currentObservable.batches) {
                    if (btch[0] === target) {
                        rb = btch;
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
                changes[j] = new Change(change.type, [currentObservable.ownKey, ...change.path], change.value, change.oldValue, change.object);
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
    const changes = [
        new Change(DELETE, [poppedIndex], undefined, popResult, this),
    ];
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
        changes[i - initialLength] = new Change(INSERT, [i], target[i], undefined, this);
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
    const changes = [new Change(DELETE, [0], undefined, shiftResult, this)];
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
        changes[i] = new Change(INSERT, [i], target[i], undefined, this);
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
    const changes = [new Change(REVERSE, [], undefined, undefined, this)];
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
    const changes = [new Change(SHUFFLE, [], undefined, undefined, this)];
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
                changes.push(new Change(UPDATE, [i], target[i], tmpTarget, this));
            }
            else {
                changes.push(new Change(INSERT, [i], target[i], undefined, this));
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
            changes.push(new Change(UPDATE, [i], nItem, oItem, this));
        }
        callObservers(oMeta, changes);
    }
    return this;
}
function proxiedSplice() {
    const oMeta = this[oMetaKey], target = oMeta.target, splLen = arguments.length, spliceContent = new Array(splLen), tarLen = target.length;
    //	observify the newcomers
    for (let i = 0; i < splLen; i++) {
        spliceContent[i] = getObservedOf(arguments[i], i, oMeta);
    }
    //	calculate pointers
    const startIndex = splLen === 0
        ? 0
        : spliceContent[0] < 0
            ? tarLen + spliceContent[0]
            : spliceContent[0], removed = splLen < 2 ? tarLen - startIndex : spliceContent[1], inserted = Math.max(splLen - 2, 0), spliceResult = Reflect.apply(target.splice, target, spliceContent), newTarLen = target.length;
    //	reindex the paths
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
            changes.push(new Change(UPDATE, [startIndex + index], target[startIndex + index], spliceResult[index], this));
        }
        else {
            changes.push(new Change(DELETE, [startIndex + index], undefined, spliceResult[index], this));
        }
    }
    for (; index < inserted; index++) {
        changes.push(new Change(INSERT, [startIndex + index], target[startIndex + index], undefined, this));
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
    constructor(type, path, value, oldValue, object) {
        this.type = type;
        this.path = path;
        this.value = value;
        this.oldValue = oldValue;
        this.object = object;
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
                    new Change(INSERT, [key], newValue, undefined, this.proxy),
                ]
                : [
                    new Change(UPDATE, [key], newValue, oldValue, this.proxy),
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
            new Change(DELETE, [key], undefined, oldValue, this.proxy),
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
    const o = target[oMetaKey]
        ? target
        : new ArrayOMeta({
            target: target,
            ownKey: "",
            parent: null,
        }).proxy;
    function unobserve(observers) {
        if (!observers)
            return __unobserve(o);
        else if (Array.isArray(observers))
            return __unobserve(o, ...observers);
        else
            return __unobserve(o, observers);
    }
    function observe(observer) {
        __observe(o, observer);
    }
    function silently(work) {
        return __awaiter(this, void 0, void 0, function* () {
            const observers = yield unobserve();
            yield work();
            observers.forEach(x => observe(x));
        });
    }
    return {
        observe,
        unobserve,
        silently,
        observable: o,
    };
}
function __observe(observable, observer) {
    const observers = observable[oMetaKey].observers;
    if (!observers.some((o) => o === observer)) {
        observers.push(observer);
    }
}
function __unobserve(observable, ...observers) {
    return __awaiter(this, void 0, void 0, function* () {
        if (observable instanceof Promise)
            observable = yield Promise.resolve(observable);
        const existingObs = observable[oMetaKey].observers;
        let length = existingObs.length;
        if (!length) {
            return [];
        }
        if (!observers.length) {
            return existingObs.splice(0);
        }
        let spliced = [];
        while (length) {
            let i = observers.indexOf(existingObs[--length]);
            if (i >= 0) {
                spliced.concat(existingObs.splice(length, 1));
            }
        }
        return spliced;
    });
}
// ========================
// Vue: https://codesandbox.io/s/heuristic-hamilton-w7nu1m?file=/src/components/HelloWorld.vue
// Still not reactive...
// ========================
// Agular: https://codesandbox.io/s/billowing-dream-872me1?file=/src/app/app.component.ts
// ========================
// REACT: https://codesandbox.io/s/busy-liskov-rbxlhm?file=/src/App.js
// ========================

class Database {
    constructor(options) {
        this.reloadBeforeOperations = false;
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
        this.model =
            options.model ||
                BaseModel;
        this.ref = options.ref;
        this.reloadBeforeOperations = !!options.reloadBeforeOperations;
        this._datastore = new Datastore({
            ref: this.ref,
            model: this.model,
            encode: options.encode,
            decode: options.decode,
            corruptAlertThreshold: options.corruptAlertThreshold,
            timestampData: options.timestampData,
            syncToRemote: options.sync ? options.sync.syncToRemote : undefined,
            syncInterval: options.sync ? options.sync.syncInterval : undefined,
            devalidateHash: options.sync
                ? options.sync.devalidateHash
                : undefined,
        });
        this.loaded = this._datastore.loadDatabase();
    }
    reloadFirst() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.reloadBeforeOperations)
                return;
            yield this.reload();
        });
    }
    /**
     * insert documents
     */
    insert(docs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.reloadFirst();
            const res = yield this._datastore.insert(docs);
            return res;
        });
    }
    live(filter = {}, { skip = 0, limit = 0, project = {}, sort = {}, toDB = true, fromDB = true, } = {}) {
        return __awaiter(this, arguments, void 0, function* () {
            const res = yield this.read(...arguments);
            const o = observable(res);
            if (toDB) {
                o.observe((changes) => {
                    let operations = [];
                    for (let i = 0; i < changes.length; i++) {
                        const change = changes[i];
                        if (change.path.length > 1 || change.type === "update") {
                            // updating
                            let doc = change.object[change.path[0]];
                            let _id = doc._id;
                            operations.push(this.update({ _id: _id }, {
                                $set: doc,
                            }));
                        }
                        else if (change.type === "delete") {
                            // deleting
                            let doc = change.oldValue;
                            let _id = doc._id;
                            operations.push(this.delete({ _id }));
                        }
                        else if (change.type === "insert") {
                            // inserting
                            let doc = change.value;
                            doc._id;
                            operations.push(this.insert(doc));
                        }
                    }
                    Promise.all(operations).catch((e) => {
                        console.error("Applying observable changes on the database failed with error");
                        console.error(e);
                    });
                });
            }
            return o;
        });
    }
    /**
     * Find document(s) that meets a specified criteria
     */
    read(filter = {}, { skip = 0, limit = 0, project = {}, sort = {}, } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = fixDeep(filter);
            sort = fixDeep(sort);
            project = fixDeep(project);
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
                cursor.projection(project);
            }
            yield this.reloadFirst();
            return yield cursor.exec();
        });
    }
    /**
     * Update document(s) that meets the specified criteria
     */
    update(filter, update, multi = false) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = fixDeep(filter || {});
            if (update.$set) {
                update.$set = fixDeep(update.$set);
            }
            if (update.$unset) {
                update.$unset = fixDeep(update.$unset);
            }
            yield this.reloadFirst();
            const res = yield this._datastore.update(filter, update, {
                multi,
                upsert: false,
            });
            return res;
        });
    }
    /**
     * Update document(s) that meets the specified criteria,
     * and do an insertion if no documents are matched
     */
    upsert(filter, update, multi = false) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = fixDeep(filter || {});
            if (update.$set) {
                update.$set = fixDeep(update.$set);
            }
            if (update.$unset) {
                update.$unset = fixDeep(update.$unset);
            }
            yield this.reloadFirst();
            const res = yield this._datastore.update(filter, update, {
                multi,
                upsert: true,
            });
            return res;
        });
    }
    /**
     * Count documents that meets the specified criteria
     */
    count(filter = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = fixDeep(filter || {});
            yield this.reloadFirst();
            return yield this._datastore.count(filter);
        });
    }
    /**
     * Delete document(s) that meets the specified criteria
     *
     */
    delete(filter, multi = false) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = fixDeep(filter || {});
            yield this.reloadFirst();
            const res = yield this._datastore.remove(filter, {
                multi: multi || false,
            });
            return res;
        });
    }
    /**
     * Create an index specified by options
     */
    createIndex(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.reloadFirst();
            return yield this._datastore.ensureIndex(options);
        });
    }
    /**
     * Remove an index by passing the field name that it is related to
     */
    removeIndex(fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.reloadFirst();
            return yield this._datastore.removeIndex(fieldName);
        });
    }
    /**
     * Reload database from the persistence layer (if it exists)
     */
    reload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this._datastore.persistence.loadDatabase();
            return {};
        });
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._datastore.persistence.sync) {
                throw new Error("Can not perform sync operation unless provided with remote DB adapter");
            }
            yield this.reloadFirst();
            return yield this._datastore.persistence.sync.sync();
        });
    }
}
function fixDeep(input) {
    const result = Object.assign(input, input.$deep);
    delete result.$deep;
    return result;
}

const _internal = {
    avl: { AvlTree, Node },
    Cursor,
    customUtils,
    Datastore,
    Index,
    modelling,
    Q,
    Persistence,
    PersistenceEvent
};

export { BaseModel, Database, _internal, index as adapters };
