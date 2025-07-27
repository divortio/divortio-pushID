# 🚀 pushID & sessionManager: A Modern Toolkit for User Identification

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Welcome to the `pushID` & `sessionManager` repository! This project provides a powerful, dependency-free toolkit for
modern web applications to handle unique, sortable identifiers and manage user sessions with robustness and flexibility.

This monorepo contains two distinct but related libraries:

1. **`pushID`**: A high-performance library for generating and decoding unique, chronologically sortable IDs.
2. **`sessionManager`**: A universal (isomorphic) library built on top of `pushID` to manage client, session, and event
   tracking.

**➡️ [View the full `pushID` README for a detailed API reference.](/pushID/README.md)**

**➡️ [View the full `sessionManager` README for a detailed API reference.](sessionManager/README.md)**

**[✨ Live Interactive Demo & Debugger](https://your-demo-url-here.com)**

---

### How the Libraries Work Together

The `sessionManager` relies on `pushID` to generate all of its identifiers. This relationship ensures that all
session-related IDs are unique, sortable, and contain valuable timestamp information.


---

### Understanding the ID Hierarchy

The `sessionManager` creates and maintains three distinct IDs that work together in a "waterfall" logic. A change in a
higher-level ID (like `cID`) forces all lower-level IDs to be regenerated.

* **👤 `cID` (Client ID)**: This is the most persistent identifier, representing a unique browser or device. It's
  designed to last for years, allowing you to track long-term user engagement and recognize returning visitors even
  after their sessions have expired. A new `cID` is generated only once for a first-time visitor.

* **🔄 `sID` (Session ID)**: This represents a single, continuous period of user activity. A new `sID` is generated when
  a new client is identified or when an existing user returns after a period of inactivity (defined by
  the `sessionTimeout`). It's perfect for analyzing user visit patterns, funnels, and session-based metrics.

* **⚡ `eID` (Event ID)**: This is the most granular identifier, acting as a "heartbeat" for user activity. A fresh `eID`
  is generated for every single event or request that is processed. Its primary role is to provide the timestamp that
  the `sessionManager` uses to determine if a session has expired.

---

## 📦 Installation & Usage

Both libraries are designed to work in any JavaScript environment.

**Browser**

Include the scripts in your HTML file. Ensure `pushID.js` is loaded before `sessionManager.js`.

```html
<script src="path/to/pushID.js"></script>
<script src="path/to/sessionManager.js"></script>
```

**Node.js / Cloudflare Workers**

```bash
npm install your-package-name
```javascript
const { pushID, sessionManager } = require('your-package-name');
// or
import { pushID, sessionManager } from 'your-package-name';
```

---

## 🆔 pushID Library

The core of our toolkit. `pushID` generates unique, sortable IDs perfect for database keys, event tracking, and more.

**➡️ [View the full `pushID` README for a detailed API reference.](/pushID/README.md)**

### Key Features

* **⏱️ Chronologically Sortable**: IDs can be sorted by time without extra database indexes.
* **🛡️ Collision Resistant**: Uses 72+ bits of randomness to prevent collisions.
* **🏷️ Informative Stubs**: Add a custom "stub" (e.g., `user`, `post`) to make IDs self-describing.
* **🔗 Deterministic Hashing**: Generate predictable IDs from any data.

### Quick Example

```javascript
// Generate a new ID for a user
const userId = pushID.newID({ stub: 'user', length: 16 });
// -> "0Q06aT5-user-bVn2mkL9xZ~_bVn2mK"

// Decode it later to get the creation time
const decoded = pushID.decodeID(userId);
console.log(decoded.date); // -> Date object for when the ID was created
```

**➡️ [View the full `pushID` README for a detailed API reference.](/pushID/README.md)**

---

## 🔄 sessionManager Library

A powerful, isomorphic library for managing user sessions. It intelligently handles client, session, and event IDs, with
automatic timeouts and a fallback to `localStorage`.

**➡️ [View the full `sessionManager` README for a detailed API reference.](sessionManager/README.md)**


### Key Features

* 🌍 **Universal (Isomorphic)**: Works identically in the browser and on the server.
* 💾 **Robust Storage**: Prefers cookies but seamlessly falls back to `localStorage`.
* 📊 **Rich, Contextual Output**: The `process()` method tells you exactly what changed in the session.
* ⏱️ **Configurable Timeouts**: Easily set the session inactivity timeout.

### Quick Example

```javascript
// 1. Initialize the manager
const manager = sessionManager({
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
});

// 2. Process an event on every request or user interaction
const session = manager.process();

// 3. Use the IDs for analytics, logging, etc.
console.log(`Event ${session.eID} occurred for client ${session.cID}`);

// 4. Check if a new session just started
if (session.changes.isNewSession) {
  console.log('A new session has started!');
  // Fire a "session_start" analytics event
}

/*
Example `session` object returned by process():

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
*/
```

**➡️ [View the full `sessionManager` README for a detailed API reference.](sessionManager/README.md)**

---

### License

This project is licensed under the MIT License.
