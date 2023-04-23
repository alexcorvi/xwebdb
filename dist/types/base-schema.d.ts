export declare class BaseModel {
    _id: string;
    updatedAt?: Date;
    createdAt?: Date;
    static new<T extends object>(this: new () => T, data: Partial<NFP<T>>): T;
    static stripDefaults<T extends object>(this: new () => T, existingData: T): T;
}
type NFPN<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
export type NFP<T> = Pick<T, NFPN<T>>;
export {};
