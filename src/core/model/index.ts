import {
	clone,
	isPrimitiveType,
	validateObject,
	fromDotNotation,
	equal,
	toDotNotation,
} from "./common";
import { compare } from "./compare";
import { deserialize } from "./serialize";
import { serialize } from "./serialize";
import { match } from "./match";
import { modifiersKeys, modify } from "./modify";
import { sort } from "./sort";
import { project } from "./project";

export {
	toDotNotation,
	serialize,
	deserialize,
	clone,
	validateObject,
	isPrimitiveType,
	modify,
	fromDotNotation,
	match,
	compare,
	modifiersKeys,
	equal,
	sort,
	project
};
