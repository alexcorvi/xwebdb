/**
 * This is the synchronization class that uses the remote sync adapter
 * to send and receive data.
 * How it does it:
 *
 * Considering that the persistence layer is actually a key/value store
 * It sets the key to: {ID}_{Rev}
 * where 	{ID}: is document ID
 * 			{Rev}: is document revision
 *
 * And each database (local & remote) has a special document ($H)
 * where it stores a value that once not equal between two DBs they should sync
 *
 * When calling the _sync() method:
 * 1. it compares the local and remote $H if they are equal, it stops
 * 2. gets the difference between the two databases
 * 3. resolves conflicts by last-write wins algorithm (can't be otherwise)
 * 4. resolves errors that can be caused by unique violation constraints (also by last-write wins)
 * 5. uploads and downloads documents
 * 6. documents that win overwrite documents that lose
 * 7. sets local and remote $H
 *
 * This is a very simple synchronization protocol, but it has the following advantages
 * 		A. it uses the least amount of data overhead
 * 			i.e. there's no need for compression, logs, compaction...etc.
 * 		B. there's no need for custom conflict resolution strategies
 *
 * However, there's drawbacks:
 * 		A. Can't use custom conflict resolution strategies if there's a need
 * 		B. updates on different fields of the documents can't get merged (last write-wins always)
 * 		C. Can't get a history of the document (do we need it?)
 */
import { Persistence } from "./persistence";
import { remoteStore } from "./adapters/type";
export declare class Sync {
    private p;
    private rdata;
    constructor(persistence: Persistence<any, any>, rdata: remoteStore);
    setL$(unique: string): Promise<void>;
    setR$(unique: string): Promise<void>;
    unify$H(): Promise<void>;
    /**
     * This method sits in-front of the actually _sync method
     * It checks whether there's an already a sync in progress
     * and whether there are deferred writes or deletes
     */
    sync(): Promise<{
        sent: number;
        received: number;
        diff: number;
    }>;
    /**
     * When finding a diff, decide what to do with it:
     * "this" means docs that should be uploaded
     * "that" means docs that should be downloaded		--> or vice versa
     * A. if there's a conflict (a key should be downloaded & uploaded at the same sync instance)
     * 		Decide a winner:
     * 			"this" wins: remove it from "that" and add it to "this"
     * 			"that" wins: don't do anything
     * B. No conflict: add it regularly
     *
     * in total: this adds and removes from two arrays,
     * one array is of docs that should be uploaded
     * and one of docs that should be downloaded
     */
    private decide;
    /**
     * This checks whether an update would cause a unique constraint violation
     * by actually adding to indexes (if it's a doc)
     * or by creating a new index (if it's an index)
     */
    private UCV;
    /**
     * Compare the local and remote $H
     * if there's a difference:
     * 		A. get a diff of the keys
     * 		B. decide which documents to upload and to download (using the above strategy)
     * 		C. Sets remote and local $H
     * 		D. returns the number of sent and received documents
     * 			in addition to a number indicating whether this method actually did a sync
     * 			-1: $H are equal, didn't do anything
     * 			0: $H are different, but keys are equal, just updated the $H
     * 			1: found a diff in documents and did a full synchronization process.
     */
    _sync(force?: boolean): Promise<{
        sent: number;
        received: number;
        diff: -1 | 0 | 1;
    }>;
}
