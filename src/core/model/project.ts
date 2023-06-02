import { Doc, SchemaKeyProjection } from "../../types";
import { fromDotNotation } from "./common";
import { modify } from "./modify";

export function project<G>(
	documents: G[],
	criteria: SchemaKeyProjection<G>,
	model: typeof Doc = Doc
): G[] {
	// no projection criteria defined: return same
	if (criteria === undefined || Object.keys(criteria).length === 0) return documents;

	let res: G[] = [];
	// exclude _id from consistency checking
	let keepId = criteria._id !== 0;
	delete criteria._id;

	let keys = Object.keys(criteria);

	// Check for consistency
	// either all are 0, or all are -1
	let actions: number[] = keys.map((k) => (criteria as any)[k]).sort();
	if (actions[0] !== actions[actions.length - 1]) {
		throw new Error("XWebDB: Can't both keep and omit fields except for _id");
	}

	// Do the actual projection
	for (let index = 0; index < documents.length; index++) {
		const doc = documents[index];
		let toPush: Record<string, any> = {};
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
			toPush = modify({} as any, toPush, model);
		} else {
			// omit-type projection
			toPush = { $unset: {} };
			keys.forEach((k) => (toPush.$unset[k] = true));
			toPush = modify(doc as any, toPush, model);
		}

		if (keepId) {
			// by default will keep _id
			toPush._id = (doc as any)._id;
		} else {
			// unless defined otherwise
			delete toPush._id;
		}
		res.push(toPush as any);
	}

	return res;
}
