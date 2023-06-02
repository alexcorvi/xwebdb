import { SchemaKeySort } from "../../types";
import { fromDotNotation } from "./common";
import { compare } from "./compare";

export function sort<G>(documents: G[], criteria: SchemaKeySort<G>): G[] {
	return documents.sort((a, b) => {
		// for each sorting criteria
		// if it's either -1 or 1 return it
		// if it's neither try the next one
		for (const [key, direction] of Object.entries(criteria || {})) {
			let compareRes =
				direction * compare(fromDotNotation(a, key), fromDotNotation(b, key));
			if (compareRes !== 0) {
				return compareRes;
			}
		}
		// no difference found in any criteria
		return 0;
	});
}
