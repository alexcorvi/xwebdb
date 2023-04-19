export class Q {
	private _queue: (() => Promise<any>)[] = [];
	private _pause: boolean = false;
	private _ongoingCount: 0 = 0;
	private readonly _concurrency: number = 1;

	constructor(concurrency: number = 1) {
		this._concurrency = concurrency;
	}

	public pause() {
		this._pause = true;
	}

	public start() {
		this._pause = false;
		this._next();
	}

	public add<T>(fn: () => Promise<T>) {
		return new Promise<T>((resolve, reject) => {
			const run = async () => {
				this._ongoingCount++;
				try {
					const val = await Promise.resolve().then(fn);
					this._ongoingCount--;
					this._next();
					resolve(val);
                    return val;
				} catch (err) {
                    this._ongoingCount--;
					this._next();
					reject(err);
                    return null;
				}
			};

			if (this._ongoingCount < this._concurrency && !this._pause) {
				run();
			} else {
				this._queue.push(run);
			}
		});
	}

	// Promises which are not ready yet to run in the queue.
	get waitingCount() {
		return this._queue.length;
	}

	// Promises which are running but not done.
	get ongoingCount() {
		return this._ongoingCount;
	}

    private _resolveEmpty = () => Promise.resolve();

	private _next() {
		if (this._ongoingCount >= this._concurrency || this._pause) {
			return;
		}

		if (this._queue.length > 0) {
			const firstQueueTask = this._queue.shift();
			if (firstQueueTask) {
				firstQueueTask();
			}
		} else {
			this._resolveEmpty();
		}
	}
}