import * as model from "./model";
import { SchemaKeyProjection, SchemaKeySort, Filter } from "../types/filter";

class Aggregate<X> {
	subjects: X[] = [];
	constructor(subjects: X[]) {
		this.subjects = subjects;
	}
	$match<I = X>(filter: Filter<I>): Aggregate<I> {
		this.subjects = this.subjects.filter((subject) => model.match(subject, filter));
		return this as unknown as Aggregate<I>;
	}
	$group<O, I = X>({ _id, reducer }: { _id: keyof I; reducer: (g: I[]) => O }): Aggregate<O> {
		const groupsObj: Record<string, I[]> = {};
		(this.subjects as unknown as I[]).forEach((subject) => {
			const propertyValue = JSON.stringify({ tmp: subject[_id] });
			if (!groupsObj[propertyValue]) groupsObj[propertyValue] = [];
			groupsObj[propertyValue].push(subject);
		});
		(this.subjects as unknown as O[]) = Object.values(groupsObj).map(reducer);
		return this as unknown as Aggregate<O>;
	}
	$limit<I = X>(limit: number) {
		this.subjects = this.subjects.slice(0, limit);
		return this as unknown as Aggregate<I>;
	}
	$skip<I = X>(skip: number) {
		this.subjects = this.subjects.slice(skip);
		return this as unknown as Aggregate<I>;
	}
	$addFields<O, I = X>(adder: (this: I) => O) {
		this.subjects = this.subjects.map((subject) => ({
			...subject,
			...adder.call(subject as unknown as I),
		}));
		return this as unknown as Aggregate<O & I>;
	}
	$sort<I = X>(sort: SchemaKeySort<I>) {
		(this.subjects as unknown as I[]) = model.sort(this.subjects as unknown as I[], sort);
		return this as unknown as Aggregate<I>;
	}
	$project<I = X>(project: SchemaKeyProjection<I>) {
		(this.subjects as unknown as I[]) = model.project(
			this.subjects as unknown as I[],
			project
		);
		return this as unknown as Aggregate<I>;
	}
	$unwind<
		F extends {
			[Key in keyof I]: I[Key] extends any[] ? Key : never;
		}[keyof I],
		I = X,
		E = I[F] extends (infer Elem)[] ? Elem : never
	>(fieldName: F) {
		type unwound = I & { [Key in Exclude<keyof I, F>]: I[Key] } & {
			[Key in F]: E;
		};
		const unwoundSubjects: unwound[] = [];
		for (let index = 0; index < this.subjects.length; index++) {
			const subject = this.subjects[index] as unknown as I;
			const fieldArray = subject[fieldName] as I[F];
			if (Array.isArray(fieldArray)) {
				for (const element of fieldArray) {
					const unwoundSubject = { ...subject, [fieldName]: element } as I & {
						[Key in Exclude<keyof I, F>]: I[Key];
					} & { [Key in F]: E };
					unwoundSubjects.push(unwoundSubject);
				}
			} else {
				unwoundSubjects.push(subject as unwound);
			}
		}
		(this.subjects as unknown as unwound[]) = unwoundSubjects;
		return this as unknown as Aggregate<Omit<I, F> & { [Key in F]: E }>;
	}
	toArray(): X[] {
		return this.subjects;
	}
}
