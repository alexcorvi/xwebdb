# XWebDB-KVAdapter

An adapter to use **Cloudflare KV** as a remote synchronization service database.

## How to use

### A. Creating an endpoint

Since Cloudflare KV doesn't support CORS requests, you'll need to setup a cloudflare worker to act as an interface for your Cloudflare KV API:

Here's a code to place in your cloudflare worker for convenience:

```javascript
// replace the following string with your own account identifier
// this is usually found at the URL of your account dashboard
// https://dash.cloudflare.com/{ACCOUNT_IDENTIFIER_HERE}/....etc
const accountIdentifier = "YOUR_ACCOUNT_IDENTIFIER";

// the rest of the code is a pure proxy to:
// api.cloudflare.com/
// since the latter doesn't support CORS request
addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
	if (request.method === "OPTIONS") {
		// Handle CORS preflight request
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400", // 1 day
			},
		});
	}

	const apiURL = `https://api.cloudflare.com/client/v4/accounts/${accountIdentifier}/storage/kv/namespaces`;
	const targetUrl = request.url
		.replace(/.*\.dev/, apiURL)
		.replace(/\/$/, "")
		.replace(/\/\?/, "?");
	const targetRequest = new Request(targetUrl, {
		method: request.method,
		headers: request.headers,
		body: request.body,
	});

	const targetResponse = await fetch(targetRequest);
	const response = new Response(targetResponse.body, targetResponse);
	response.headers.set("Access-Control-Allow-Origin", "*");
	response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
	response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	return response;
}
```

After setting up the worker, it will have a live URL, like `https://kv.yourusername.workers.dev` this is what we'll call an `endpoint` the next step is to have a token.

### B. Creating a token

1. From the user profile, navigate to [`API Tokens`](https://dash.cloudflare.com/profile/api-tokens).
2. Create token, using the `Edit Cloudflare Workers` template.
3. Copy the token and storing it in a safe place.

### C. Setting up synchronization adapter

Now that we have an endpoint and a token

```typescript
import { Database } from "xwebdb";
import { kvAdapter } from "xwebdb-kvadapter";

const db = new Database({
	sync: {
		// define remote sync adapter
		syncToRemote: kvAdapter("YOUR_ENDPOINT", "YOUR_TOKEN"),
		// define an interval at which the database will
		// automatically sync with the remote database
        // defaults to "0" (will not sync on interval) only manually
		syncInterval: 500,
	},
	
	/// rest of database configuration
	/// 	ref: ...
	/// 	model:  ...
	/// 	...etc: ...
});
```

That's it.


## License: MIT