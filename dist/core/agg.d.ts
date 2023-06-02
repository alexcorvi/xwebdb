import { SchemaKeyProjection, SchemaKeySort, Filter } from "../types/filter";
export declare class Aggregate<X> {
    subjects: X[];
    constructor(subjects: X[]);
    private removeUnusedID;
    $match(filter: Filter<X>): Aggregate<X>;
    $group<O>({ _id, reducer }: {
        _id: keyof X;
        reducer: (g: X[]) => O;
    }): Aggregate<O>;
    $limit(limit: number): Aggregate<X>;
    $skip(skip: number): Aggregate<X>;
    $addFields<O>(adder: (subject: X) => O): Aggregate<X & O>;
    $sort(sortCriteria: SchemaKeySort<X>): Aggregate<X>;
    $project(project: SchemaKeyProjection<X>): Aggregate<X>;
    $unwind<F extends {
        [Key in keyof X]: X[Key] extends any[] ? Key : never;
    }[keyof X], E = X[F] extends (infer Elem)[] ? Elem : never>(fieldName: F): Aggregate<X & { [Key in Exclude<keyof X, F>]: X[Key]; } & { [Key_1 in F]: E; }>;
    toArray(): X[];
}
