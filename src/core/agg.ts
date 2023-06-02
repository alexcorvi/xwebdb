import * as model from "./model";
import { SchemaKeyProjection, SchemaKeySort, Filter } from "../types/filter";

export class Aggregate<X> {
	subjects: X[] = [];
	constructor(subjects: X[]) {
		this.subjects = subjects;
	}

	private removeUnusedID(arr: X[]): X[] {
		return arr.map((item) => {
			if ((item as any)._id === undefined) delete (item as any)._id;
			return item;
		});
	}

	$match(filter: Filter<X>): Aggregate<X> {
		return new Aggregate(this.subjects.filter((subject) => model.match(subject, filter)));
	}
	$group<O>({ _id, reducer }: { _id: keyof X; reducer: (g: X[]) => O }): Aggregate<O> {
		const groupsObj: Record<string, X[]> = {};
		this.subjects.forEach((subject) => {
			const propertyValue = JSON.stringify({ tmp: subject[_id] });
			if (!groupsObj[propertyValue]) groupsObj[propertyValue] = [];
			groupsObj[propertyValue].push(subject);
		});
		return new Aggregate(Object.values(groupsObj).map(reducer));
	}
	$limit(limit: number) {
		return new Aggregate(this.subjects.slice(0, limit));
	}
	$skip(skip: number) {
		return new Aggregate(this.subjects.slice(skip));
	}
	$addFields<O>(adder: (subject: X) => O) {
		return new Aggregate(
			this.subjects.map((subject) => ({
				...subject,
				...adder(subject),
			}))
		);
	}
	$sort(sortCriteria: SchemaKeySort<X>) {
		return new Aggregate(model.sort(this.subjects.slice(0), sortCriteria));
	}
	$project(project: SchemaKeyProjection<X>) {
		return new Aggregate(this.removeUnusedID(model.project(this.subjects, project)));
	}
	$unwind<
		F extends {
			[Key in keyof X]: X[Key] extends any[] ? Key : never;
		}[keyof X],
		E = X[F] extends (infer Elem)[] ? Elem : never
	>(fieldName: F) {
		type U = X & { [Key in Exclude<keyof X, F>]: X[Key] } & {
			[Key in F]: E;
		};
		const unwoundSubjects: U[] = [];
		for (let index = 0; index < this.subjects.length; index++) {
			const subject = this.subjects[index];
			const fieldArray = subject[fieldName];
			if (Array.isArray(fieldArray)) {
				for (const element of fieldArray) {
					const unwoundSubject: U = { ...subject, [fieldName]: element };
					unwoundSubjects.push(unwoundSubject);
				}
			} else {
				unwoundSubjects.push(subject as U);
			}
		}
		return new Aggregate(unwoundSubjects);
	}
	toArray(): X[] {
		return this.subjects;
	}
}