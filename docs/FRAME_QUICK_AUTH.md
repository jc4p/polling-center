---
title: quickAuth
description: Easily authenticate user with Sign In with Farcaster.
---

import { Caption } from '../../../../components/Caption';

# quickAuth

:::warning
This is an experimental feature.
:::

Request a signed JWT from a [Farcaster Quick Auth
Server](https://github.com/farcasterxyz/protocol/discussions/231). This is the
quickest way to protect your endpoints using Sign In with Farcaster.

### Quick Auth vs Sign In with Farcaster

[Sign In with
Farcaster](https://github.com/farcasterxyz/protocol/discussions/110) is the
foundational standard that allow Farcaster users to authenticate into
applications.

[Farcaster Quick
Server](https://github.com/farcasterxyz/protocol/discussions/231) is an
optional service built on top of SIWF that is highly performant and easy to
integrate. Developers don't need to worry about securely generating and
consuming nonces or the nuances of verifying a SIWF message—instead they
receive a signed JWT that can be used as a session token the authenticate their
server.

The Auth Server offers exceptional performance in two ways:
- the service is deployed on the edge so nonce generation and verification
  happens close to your users no matter where they are located
- the issued tokens are asymmetrically signed so they can be verified locally
  on your server

If you're not sure where to start we recommend using Quick Auth.


## Usage

```ts twoslash
// ---cut---
import { sdk } from '@farcaster/frame-sdk'

const { token } = await sdk.experimental.quickAuth()
```

## Parameters

### quickAuthServerOrigin

- **Type:** `quickAuthServerOrigin`

Use a custom Quick Auth Server. Defaults to `https://auth.farcaster.xyz`.


## Return Value

A [JWT](https://datatracker.ietf.org/doc/html/rfc7519) issued by the Quick Auth
Server based on the Sign In with Farcaster credential signed by the user.

```ts
type QuickAuthResult = {
  /**
   * JWT issued the Quick Auth Server.
   */
  token: string;
}
```

Store this token in memory (i.e. React state) and include it as an
authorization header to make authenticated requests to your server. 

Your server must verify the token:

```ts
const { createClient } from "@farcaster/quick-auth";

const client = createClient();

// Set this to whatever domain your Mini App is being server from. If you're
// developing locally use the domain you are tunneling from.
const domain = 'example.com';

/**
 * Inside your request handler extract the JWT from a request header
 * and verify it using @farcaster/quick-auth.
 *
 * token - the JWT issued by a Quick Auth Server 
 * domain - the domain the token was issued to, this should be the same domain
 * as your mini app is running on.
 */
const payload = await client.verifyJwt({ token, domain })
```

### JWT Payload

```json
{
  "address": "0xf9D3D372D0097BF26cbf2444B34F5B9522AfaA4b",
  "iat": 1747764819,
  "iss": "https://auth.farcaster.xyz",
  "exp": 1747768419,
  "sub": 6841,
  "aud": "miniapps.farcaster.xyz"
}
```

#### sub

- **Type:** `number`

The FID of the signed in user. 


#### address

- **Type:** `string`

The address the user signed in with.

#### iss

- **Type:** `string`

The Quick Auth server that verified the SIWF credential and issued the JWT.

#### aud

- **Type:** `string`

The domain this token was issued to.

#### exp

- **Type:** `number`

The JWT expiration time.

#### iat

- **Type:** `number`

The JWT issued at time.


## Integration Guide

In your Mini App frontend, call the `quickAuth` action to get back a JWT. Store
it in memory so it can be used for the remainder of this session.

```ts
import { useState } from "react";
import { sdk } from "@farcaster/frame-sdk";

export function App() {
  // Stores the JWT token for this session
  const [token, setToken] = useState<string>(token)

  async function signIn() {
    try {
      const { token } = await sdk.experimental.quickAuth();
      const req = await fetch(`${SERVER_URL}/me`, {
        headers: new Headers({ "Authorization": "Bearer " + token })
      })
      console.log(await req.json());
    } catch (error) {
      console.log(error)
    }
  }

  function signOut() {
    setToken(undefined);
  }

  if (!token) {
    return (
      <button onClick={signIn}>sign in</button>
    )
  }

  return (
    <button onClick={signOut}>sign out</button>
  )
}
```

In your Mini App backend, verify the JWT to protect resources:

```ts
import { createClient, Errors } from '@farcaster/quick-auth'
import { Hono } from 'hono'

const domain = 'example.com';
const client = createClient();
const app = new Hono()

app.get('/hello', async (c) => {
  const authorization = c.req.header('Authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return c.status(401);
  }

  try {
    const payload = await client.verifyJwt({
      token: authorization.split(' ')[1] as string,
      domain,
    })

    return c.json({
      fid: payload.aud
    })
  } catch (e) {
    if (e instanceof Errors.InvalidTokenError) {
      return c.status(401);
    }

    throw e;
  }
})

export default app
```



