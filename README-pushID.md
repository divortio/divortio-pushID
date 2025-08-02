# 🚀 pushID: Universal, Sortable, Unique ID Generator

![Version](https://img.shields.io/badge/version-3.5.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A powerful, dependency-free JavaScript library for generating and decoding unique, chronologically sortable IDs, often
called "Push IDs." Inspired by Firebase's Realtime Database IDs, this library is optimized for performance and provides
a rich, extensible API for both client-side and server-side applications.

It solves the common challenge in modern web development of needing identifiers that are not only unique across
distributed systems but also contain embedded, sortable time information. This eliminates the need for
separate `createdAt` fields and complex database indexes, making it ideal for high-performance applications, real-time
systems, and offline-first architectures.

**[✨ Live Interactive Demo & Debugger](https://your-demo-url-here.com)**

---

### Key Features

* **⏱️ Chronologically Sortable**: IDs are prefixed with a 48-bit encoded timestamp. This allows records to be sorted
  lexicographically by creation time without needing a separate database index, a major performance advantage for large
  datasets.
* **🛡️ Collision Resistant**: Uses 72+ bits of randomness to prevent collisions between different clients, even if they
  are generating thousands of IDs per second in a distributed environment.
* **🏷️ Informative Stubs**: Add a custom string "stub" to your IDs (e.g., `user`, `post`, `event`) to make them
  self-describing and easier to debug.
* **📐 Configurable Length**: Easily control the length of the random part of the ID for even greater collision
  resistance.
* **🔗 Deterministic Hashing**: Generate predictable, stable IDs from any data (like a user object or an event payload),
  perfect for idempotent operations.
* **⏪ Backward Compatible**: Can decode both the new, structured format and the original legacy (non-delimited) pushID
  format.
* **📦 Zero Dependencies**: A single, lightweight file that works anywhere JavaScript runs.

---

### ID Structure

A `pushID` is a string composed of three parts, separated by hyphens:

**`[Encoded Timestamp]-[Stub]-[Randomness]`**

* **Encoded Timestamp (8 characters)**: Encodes a 48-bit timestamp of the creation time in milliseconds since the UNIX
  epoch.
* **Stub (variable length)**: A string identifier for the ID's type. Defaults to `pshID`. This part is optional; if
  omitted, a legacy-style ID is generated.
* **Randomness (12+ characters)**: A random or hashed string to prevent collisions.

**Example:** `0PZ7q0_-user-aBcDeFgHiJkLmNoP`

---

### Installation

**Browser**

Simply include the `pushID.js` script in your HTML file.

```html
<script src="path/to/pushID.js"></script>
```

**Node.js / Module Bundlers**

```bash
npm install your-package-name
```javascript
const pushID = require('your-package-name');
// or
import pushID from 'your-package-name';
```

---

### Getting Started

Using `pushID` is simple. Here are the two most common use cases:

**1. Generate a new ID**

```javascript
// Generate a standard ID with the default "pshID" stub
const newId = pushID.newID();
// Output -> "0Q05~Ab-pshID-kL9xZ~_bVn2m"

// Generate an ID with a custom "user" stub
const userId = pushID.newID({ stub: 'user' });
// Output -> "0Q05~B1-user-bVn2mkL9xZ~_"
```

**2. Decode an existing ID**

```javascript
const myId = "0Q05~B1-user-bVn2mkL9xZ~_";

const decoded = pushID.decodeID(myId);
/*
Output:
{
  "id": "0Q05~B1-user-bVn2mkL9xZ~_",
  "randomness": "bVn2mkL9xZ~_",
  "date": "2025-07-26T07:35:10.457Z",
  "stub": "user",
  "encodedTime": "0Q05~B1"
}
*/

console.log(decoded.date.getFullYear()); // -> 2025
```

---

## Full API Reference

All functions are accessed through the global `pushID` object.

### Generation

#### `pushID.newID(options)`

Generates a new pushID string.

* **`options`** `(object)` [optional]: Configuration for the ID.
    * **`time`** `(number|Date)`: A specific time to use. Defaults to `Date.now()`.
    * **`stub`** `(string|null)`: A string identifier. If `null` or `''`, a legacy ID is created. Defaults to `'pshID'`.
    * **`length`** `(number)`: The length of the random part. Defaults to `12`.
* **Returns** `(string)`: The new pushID.

```javascript
// With a custom stub and length
const id = pushID.newID({ stub: 'post', length: 16 });
// -> "0Q05~C9-post-kL9xZ~_bVn2mkL9"
```

#### `pushID.newObj(options)`

Generates a new pushID and returns it as a full object.

* **`options`**: Same as `newID()`.
* **Returns** `(object)`: A new pushID object `{id, randomness, date, stub}`.

```javascript
const idObject = pushID.newObj({ stub: 'event', length: 20 });
/*
{
  "id": "0Q05~Dq-event-bVn2mkL9xZ~_bVn2mkL9",
  "randomness": "bVn2mkL9xZ~_bVn2mkL9",
  "date": Date object for the current time,
  "stub": "event"
}
*/
```

#### `pushID.newHashID(options)`

Generates a new pushID where the random part is a hash of the provided data.

* **`options`** `(object)`: Configuration object. Must include a `data` property.
    * **`data`** `(*)`: The data to hash (object, array, string, etc.).
    * Other options (`time`, `stub`, `length`) are the same as `newID()`.
* **Returns** `(string)`: A new, deterministically generated pushID.

```javascript
const userData = { userId: 123, email: "test@example.com" };

const hashedId = pushID.newHashID({ data: userData, stub: 'session' });
// -> "0Q05~Gg-session-v3G4bQdG~Qc5"
```

### Decoding

#### `pushID.decodeID(id)`

Decodes a pushID into a full object containing its parts.

* **`id`** `(string)`: The pushID to decode.
* **Returns** `(object)`: The decoded object `{id, randomness, date, stub, encodedTime}`.

```javascript
const decoded = pushID.decodeID("0Q05~B1-user-bVn2mkL9xZ~_");
// -> { id: "...", randomness: "...", date: Date(...), stub: "user", encodedTime: "0Q05~B1" }
```

#### `pushID.decodeTime(id)`

Returns the creation time of an ID in milliseconds since the UNIX epoch.

* **`id`** `(string)`: The pushID to decode.
* **Returns** `(number)`: The timestamp in milliseconds.

#### `pushID.decodeDate(id)`

Returns the creation time of an ID as a JavaScript `Date` object.

* **`id`** `(string)`: The pushID to decode.
* **Returns** `(Date)`: The creation date.

#### `pushID.decodeStr(id)`

Returns the random part of an ID.

* **`id`** `(string)`: The pushID to decode.
* **Returns** `(string)`: The randomness string.

#### `pushID.decodeStub(id)`

Returns the stub of an ID.

* **`id`** `(string)`: The pushID to decode.
* **Returns** `(string|null)`: The stub, or `null` for legacy IDs.

### Hashing & Utilities

#### `pushID.hash(input, length)`

Creates a stable, deterministic hash string from any JavaScript input.

* **`input`** `(*)`: The value to hash.
* **`length`** `(number)` [optional]: The desired length of the hash. Defaults to `12`.
* **Returns** `(string)`: A stable hash string.

```javascript
const hash1 = pushID.hash({ a: 1, b: 2 });
const hash2 = pushID.hash({ b: 2, a: 1 }); // Keys are sorted before hashing

console.log(hash1 === hash2); // -> true
// -> "Qc5~v3G4bQdG"
```

#### `pushID.newRnd(length)`

Generates a random string of a specified length.

* **`length`** `(number)` [optional]: The desired length. Defaults to `12`.
* **Returns** `(string)`: A random string.

---

### Convenience Aliases

For ease of use, several functions have shorter aliases:

* `pushID.next()` / `pushID.nextID()` -> `pushID.newID()`
* `pushID.nextObj()` -> `pushID.newObj()`
* `pushID.previous()` -> `pushID.previousID()`
* `pushID.prevObj()` -> `pushID.previousObj()`

---

### License

This project is licensed under the MIT License.
