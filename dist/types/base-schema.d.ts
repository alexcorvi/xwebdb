import { RecursivePartial, NFGP } from "./common";
declare class BaseModel {
    static new<T extends object>(this: new () => T, data: RecursivePartial<NFGP<T>>): T;
}
export declare class Doc extends BaseModel {
    _id: string;
    updatedAt?: Date;
    createdAt?: Date;
    static stripDefaults<T extends object>(this: new () => T, existingData: T): T;
}
export declare class SubDoc extends BaseModel {
}
declare function mapSubModel<M extends typeof SubDoc>(c: M, defaultValue: InstanceType<M>): InstanceType<M>;
declare function mapSubModel<T extends typeof SubDoc>(c: T, defaultValue: Array<InstanceType<T>>): Array<InstanceType<T>>;
export { mapSubModel };
