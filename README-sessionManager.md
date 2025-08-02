# 🚀 sessionManager: Universal Session & Client ID Management

![Version](https://img.shields.io/badge/version-4.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A universal (isomorphic) JavaScript library for robustly managing a hierarchy of client, session, and event identifiers.
Built on the powerful `pushID` library, it provides a seamless way to track user activity across requests, with
automatic session timeout handling and a fallback from cookies to `localStorage`.

This library is perfect for analytics, user tracking, and any application that needs to maintain a consistent sense of a
user's journey, both on the client and the server. It is designed to be framework-agnostic, making it ideal for modern
environments like **Cloudflare Workers**, **Vercel Edge Functions**, or any **Node.js** backend.

**[✨ Live Interactive Demo & Debugger](https://your-demo-url-here.com)**

---

### Key Features

* 🌍 **Universal (Isomorphic)**: Works identically in the browser and on any server-side JavaScript environment.
* 💾 **Robust Storage**: Prioritizes cookies but automatically falls back to `localStorage` if cookies are disabled,
  ensuring maximum reliability.
* 🔗 **Hierarchical IDs**: Intelligently manages a "waterfall" of identifiers:
    * **`cID` (Client ID)**: A long-term identifier for a unique browser/client.
    * **`sID` (Session ID)**: Automatically rotates after a configurable period of inactivity.
    * **`eID` (Event ID)**: A new ID generated for every tracked event, acting as a "heartbeat".
* 📊 **Rich, Contextual Output**: The main `process()` method returns a detailed object including the old state, new
  state, and a summary of what changed (e.g., `isNewSession`).
* ⏱️ **Configurable Timeouts**: Easily set the session inactivity timeout to match your application's needs.
* 🍪 **Customizable Cookies**: Full control over cookie options, including `httpOnly`, `secure`, `path`, and a custom
  prefix.

---

### How It Works

The manager follows a simple but powerful logic on every request, ensuring that the hierarchy of IDs is always
consistent.

1. **Read Old State**: It retrieves the last known `cID`, `sID`, and `eID` from storage.
2. **Check for Timeout**: It decodes the timestamp from the most recent ID (`eID` > `sID` > `cID`) to determine if the
   session has expired based on the configured `sessionTimeout`.
3. **Generate New IDs**:
    * A new `eID` is always created with a `eID` stub.
    * A new `sID` (with `sID` stub) is created if the session has expired or if one doesn't exist.
    * A new `cID` (with `cID` stub) is created only if one doesn't exist.
4. **Persist and Return**: The new set of IDs is saved to storage, and a comprehensive object detailing the transaction
   is returned.

---

### Installation

**Prerequisite:** This library requires the `pushID` library to be available in the same scope.

**Browser**

Include both scripts in your HTML file.

```html
<script src="path/to/pushID.js"></script>
<script src="path/to/sessionManager.js"></script>
```

**Node.js / Cloudflare Workers**

```bash
npm install your-package-name
```javascript
const pushID = require('your-pushid-package');
const sessionManager = require('your-session-manager-package');
```

---

### Getting Started

#### Basic Client-Side Usage

On the client, you can initialize and use the manager with zero configuration.

```javascript
// 1. Initialize the manager
const manager = sessionManager({
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
});

// 2. Process an event (e.g., on page load)
const session = manager.process();

// Easy access to the latest IDs
console.log(`Event ${session.eID} occurred for client ${session.cID}`);

// Check if a new session just started
if (session.changes.isNewSession) {
  console.log('A new session has started!');
  // Fire a "session_start" analytics event
}
```

#### Server-Side Usage (e.g., Cloudflare Worker)

On the server, you must provide a `cookieHandler` to allow the manager to read and write cookies from the
request/response headers.

```javascript
// Assume 'request' is the incoming Request object and 'headers' is a Headers object for the response.

// 1. Initialize the manager
const manager = sessionManager({
  cookiePrefix: '__myapp_',
  cookieOptions: { httpOnly: true, secure: true, path: '/' }
});

// 2. Create a cookie handler for the current request
const cookieHandler = {
  get: (key) => {
    const cookieString = request.headers.get('Cookie') || '';
    const match = cookieString.match(new RegExp(`(^|;\\s*)${manager.config.cookiePrefix + key}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  },
  set: (key, value, options) => {
    // Logic to build and set a 'Set-Cookie' header on your response headers object
    // This will vary based on your specific server environment
  }
};

// 3. Process the session
const session = manager.process({ cookieHandler });

// 4. Use the IDs
console.log(`Processing event for session ${session.sID}`);
```

---

## API Reference

### `sessionManager(config)`

The factory function that creates and configures a manager instance.

* **`config`** `(object)` [optional]:
    * **`sessionTimeout`** `(number)`: Timeout in ms. **Default**: `1800000`.
    * **`randomnessLength`** `(number)`: Length of the random part of IDs. **Default**: `12`.
    * **`cookiePrefix`** `(string)`: Prefix for storage keys. **Default**: `__psh_`.
    * **`cookieOptions`** `(object)`: Standard cookie options (`path`, `secure`, etc.).
* **Returns** `(object)`: A session manager instance.

### `manager.process(options)`

The main method on a manager instance.

* **`options`** `(object)` [optional]:
    * **`cookieHandler`** `(object)`: **Required for server-side use.** An object with `get(key)`
      and `set(key, value, options)` methods.
* **Returns** `(object)`: A comprehensive session object with the following structure:

    ```
    {
      // Direct access to current IDs
      cID: "0Q06aT5-cID-bVn2mkL9xZ~_",
      sID: "0Q06aT5-sID-kL9xZ~_bVn2mK",
      eID: "0Q06aT5-eID-~_bVn2mkL9xZ",

      // Direct access to current timestamps (as Date objects)
      clientTime: Date,
      sessionTime: Date,
      eventTime: Date,

      // Full state objects for detailed analysis
      newState: { cID, sID, eID, clientTime, sessionTime, eventTime },
      oldState: { cID, sID, eID, clientTime, sessionTime, eventTime },

      // A summary of what happened
      changes: {
        isNewClient: true,
        isNewSession: true
      }
    }
    ```

---

### License

This project is licensed under the MIT License.
