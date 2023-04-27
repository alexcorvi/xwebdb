import { clone, isPrimitiveType, validateObject, dotNotation, equal } from "./common";
import { compare } from "./compare";
import { deserialize } from "./serialize";
import { serialize } from "./serialize";
import { match } from "./match";
import { modifiersKeys, modify } from "./modify";

export {
	serialize,
	deserialize,
	clone,
	validateObject,
	isPrimitiveType,
	modify,
	dotNotation,
	match,
	compare,
	modifiersKeys,
	equal,
};
