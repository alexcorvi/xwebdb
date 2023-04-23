import { Persistence } from "./persistence";
import { remoteStore } from "./adapters/type";
export declare class Sync {
    private p;
    private rdata;
    constructor(persistence: Persistence<any, any>, rdata: remoteStore);
    setLocalHash(keys?: string[]): Promise<void>;
    setRemoteHash(keys?: string[]): Promise<void>;
    private timeSignature;
    sync(): Promise<{
        sent: number;
        received: number;
        diff: -1 | 0 | 1;
    }>;
    private brace;
    private causesUCV;
    _sync(): Promise<{
        sent: number;
        received: number;
        diff: -1 | 0 | 1;
    }>;
}
