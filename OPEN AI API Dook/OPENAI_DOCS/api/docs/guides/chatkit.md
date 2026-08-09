---
source_url: https://developers.openai.com/api/docs/guides/chatkit
fetched_at: 2026-07-27T01:57:41Z
---

# ChatKit

Copy Page

[Starter app

Clone a repo to get started](https://github.com/openai/openai-chatkit-starter-app)

ChatKit is the best way to build agentic chat experiences. Whether you’re building an internal knowledge base assistant, HR onboarding helper, research companion, shopping or scheduling assistant, troubleshooting bot, financial planning advisor, or support agent, ChatKit provides a customizable chat embed to handle all user experience details.

Use ChatKit’s embeddable UI widgets, customizable prompts, tool‑invocation support, file attachments, and chain‑of‑thought visualizations to build agents without reinventing the chat UI.

## Overview

Choose between two ChatKit paths:

- **Custom server integration**. Run ChatKit on your own infrastructure. Use the ChatKit Python SDK and connect to any agentic service, including one built with the [Agents SDK](agents.md). Use widgets to build the frontend.
- **Existing Agent Builder-hosted integration**. If you already use ChatKit with an Agent Builder workflow, you can keep using that hosted workflow during the Agent Builder transition window.

OpenAI is deprecating Agent Builder. Existing users can continue using it
during the transition window, and the product is scheduled to shut down on
November 30, 2026. ChatKit is still available. For new work or migration
planning, use [advanced ChatKit integrations](custom-chatkit.md)
with your own server-side agent implementation, and see [Migrate from Agent
Builder](agent-builder/migrate-from-agent-builder.md) for Agent
Builder transition guidance.

## Get started with ChatKit

[![Custom server integration](../../../assets/API_docs_images_misc-4.png)

Custom server integration

Use any server and the ChatKit SDKs to build your own custom ChatKit user experience](custom-chatkit.md)[![Existing hosted workflow](../../../assets/API_docs_images_misc-3.png)

Existing hosted workflow

Connect ChatKit to an existing Agent Builder workflow during the transition window](#embed-chatkit-in-your-frontend)

## Embed ChatKit in your frontend

Use this path only if you already have an Agent Builder workflow that backs your ChatKit implementation. For new ChatKit apps, or when migrating before Agent Builder shuts down, use the [advanced integration](custom-chatkit.md) to connect ChatKit to your own server-side agent implementation.

At a high level, setting up ChatKit with an existing hosted workflow is a three-step process. Open your existing workflow while Agent Builder remains available. Then set up ChatKit and add features to build your chat experience.

  

![OpenAI-hosted
ChatKit](../../../assets/API_docs_images_openai-hosted.png)

### 1. Use an existing hosted workflow

Open your existing workflow in [Agent Builder](agent-builder.md). You’ll get a workflow ID. For transition planning, see [Migrate from Agent Builder](agent-builder/migrate-from-agent-builder.md).

The chat embedded in your frontend will point to the workflow you select.

### 2. Set up ChatKit in your product

To set up ChatKit, you’ll create a ChatKit session and a server endpoint, pass in your workflow ID, exchange the client secret, and add a script to embed ChatKit on your site.

**Important Security Note:** When creating a ChatKit session, you must pass in a `user` parameter, which should be unique for each individual end user. Your server must
authenticate your application’s users and pass a unique identifier for them in this parameter.

1. On your server, generate a client token.

   This snippet spins up a FastAPI service whose sole job is to create a new ChatKit session through the OpenAI API and hand back the session’s client secret:

   server.py

   python

   ```
   1
   2
   3
   4
   5
   6
   7
   8
   9
   10
   11
   12
   13
   14
   15
   16
   17
   18
   19
   20
   21
   22
   23
   24
   25
   26
   27
   28
   29
   30
   31
   32
   33
   34
   35
   36
   37
   38
   39
   40
   41
   42
   43
   44
   45
   46
   47
   48
   49
   50
   51
   52
   53
   54
   55
   56
   57
   58
   59
   import hmac
   import json
   import os
   from typing import Annotated

   import requests
   from fastapi import Depends, FastAPI, HTTPException
   from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
   from pydantic import BaseModel

   api_key = os.environ["OPENAI_API_KEY"]
   workflow_id = os.environ["OPENAI_CHATKIT_WORKFLOW_ID"]
   authenticated_users: dict[str, str] = json.loads(
       os.environ["CHATKIT_AUTHENTICATED_USERS"]
   )
   bearer_auth = HTTPBearer(auto_error=False)

   def get_authenticated_user_id(
       credentials: Annotated[
           HTTPAuthorizationCredentials | None,
           Depends(bearer_auth),
       ],
   ) -> str:
       if credentials is not None:
           for token, user_id in authenticated_users.items():
               if hmac.compare_digest(credentials.credentials, token):
                   return user_id
       raise HTTPException(status_code=401, detail="Invalid authentication token")

   class ChatKitSession(BaseModel):
       client_secret: str

   app = FastAPI()

   @app.post("/api/chatkit/session")
   def create_chatkit_session(
       user_id: Annotated[str, Depends(get_authenticated_user_id)],
   ):
       response = requests.post(
           "https://api.openai.com/v1/chatkit/sessions",
           headers={
               "Authorization": f"Bearer {api_key}",
               "Content-Type": "application/json",
               "OpenAI-Beta": "chatkit_beta=v1",
           },
           json={
               "workflow": {"id": workflow_id},
               "user": user_id,
           },
           timeout=30,
       )
       response.raise_for_status()
       session = ChatKitSession.model_validate(response.json())
       return {"client_secret": session.client_secret}
   ```

   Before starting the service, set `OPENAI_API_KEY`, `OPENAI_CHATKIT_WORKFLOW_ID`, and `CHATKIT_AUTHENTICATED_USERS`. The last value is a JSON map from your application’s bearer tokens to stable user IDs. In production, replace this environment-backed map with your application’s authentication or session lookup.
2. In your server-side code, pass in your workflow ID and secret key to the session endpoint.

   The client secret is the credential that your ChatKit frontend uses to open or refresh the chat session. You don’t store it; you immediately hand it off to the ChatKit client library.

   See the [chatkit-js repo](https://github.com/openai/chatkit-js) on GitHub.

   chatkit.ts

   typescript

   ```
   1
   2
   3
   4
   5
   6
   7
   8
   9
   10
   11
   12
   13
   14
   15
   16
   17
   18
   19
   20
   21
   22
   23
   24
   25
   26
   27
   28
   29
   30
   31
   32
   33
   34
   35
   36
   export default async function getChatKitSessionToken(
     deviceId: string
   ): Promise<string> {
     const apiKey = process.env.OPENAI_API_KEY;
     if (!apiKey) {
       throw new Error("OPENAI_API_KEY is required");
     }

     const response = await fetch("https://api.openai.com/v1/chatkit/sessions", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "OpenAI-Beta": "chatkit_beta=v1",
         Authorization: `Bearer ${apiKey}`,
       },
       body: JSON.stringify({
         workflow: { id: "wf_68df4b13b3588190a09d19288d4610ec0df388c3983f58d1" },
         user: deviceId,
       }),
     });

     if (!response.ok) {
       throw new Error(
         `Failed to create a ChatKit session: ${response.status} ${await response.text()}`
       );
     }

     const { client_secret } = (await response.json()) as {
       client_secret?: string;
     };
     if (!client_secret) {
       throw new Error("ChatKit session response did not include client_secret");
     }

     return client_secret;
   }
   ```
3. In your project directory, install the ChatKit React bindings:

   ```
   npm install @openai/chatkit-react
   ```
4. Add the ChatKit JS script to your page. Drop this snippet into your page’s `<head>` or wherever you load scripts, and the browser will fetch and run ChatKit for you.

   index.html

   html

   ```
   1
   2
   3
   4
   <script
   src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
   async
   ></script>
   ```
5. Render ChatKit in your UI. Pass the React `MyChat` component a `getAppAuthToken` function that returns the current user’s bearer token. If you use the JavaScript tab, make the same function available in the snippet’s scope. This code sends that credential to your server, fetches the client secret, and mounts a live chat widget connected to your workflow.

   Your frontend code

   react

   ```
   1
   2
   3
   4
   5
   6
   7
   8
   9
   10
   11
   12
   13
   14
   15
   16
   17
   18
   19
   20
   21
   22
   23
   24
   25
   26
   import { ChatKit, useChatKit } from '@openai/chatkit-react';

      export function MyChat({ getAppAuthToken }) {
        const { control } = useChatKit({
          api: {
            async getClientSecret(existing) {
              if (existing) {
                // implement session refresh
               }

              const appAuthToken = await getAppAuthToken();
              const res = await fetch('/api/chatkit/session', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + appAuthToken,
                  'Content-Type': 'application/json',
                },
              });
              const { client_secret } = await res.json();
              return client_secret;
            },
          },
        });

        return <ChatKit control={control} className="h-[600px] w-[320px]" />;
      }
   ```

   ```
   1
   2
   3
   4
   5
   6
   7
   8
   9
   10
   11
   12
   13
   14
   15
   16
   17
   18
   19
   20
   21
   22
   23
   24
   25
   26
   27
   28
   const chatkit = document.getElementById("my-chat");
   if (
     !chatkit ||
     !("setOptions" in chatkit) ||
     typeof chatkit.setOptions !== "function"
   ) {
     throw new Error("ChatKit element not found.");
   }

   chatkit.setOptions({
     api: {
       async getClientSecret() {
         const appAuthToken = await getAppAuthToken();
         const res = await fetch("/api/chatkit/session", {
           method: "POST",
           headers: {
             Authorization: `Bearer ${appAuthToken}`,
             "Content-Type": "application/json",
           },
         });
         if (!res.ok) {
           throw new Error(`ChatKit session request failed: ${res.status}`);
         }
         const { client_secret } = await res.json();
         return client_secret;
       },
     },
   });
   ```

### 3. Build and iterate

See the [custom theming](chatkit-themes.md), [widgets](chatkit-widgets.md), and [actions](chatkit-actions.md) docs to learn more about how ChatKit works. Or explore the following resources to test your chat, iterate on prompts, and add widgets and tools.

#### Build your implementation

[ChatKit docs on GitHub

Learn to handle authentication, add theming and customization, and more.](https://openai.github.io/chatkit-python)
[ChatKit Python SDK

Add server-side storage, access control, tools, and other backend
functionality.](https://github.com/openai/chatkit-python)
[ChatKit JS SDK

Check out the ChatKit JS repo.](https://github.com/openai/chatkit-js)

#### Explore ChatKit UI

[chatkit.world

Play with an interactive demo of ChatKit.](https://chatkit.world)
[Widget builder

Browse available widgets.](https://widgets.chatkit.studio)
[ChatKit playground

Play with an interactive demo to learn by doing.](https://chatkit.studio/playground)

#### See working examples

[Samples on GitHub

See working examples of ChatKit and get inspired.](https://github.com/openai/openai-chatkit-advanced-samples)
[Starter app repo

Clone a repo to start with a fully working template.](https://github.com/openai/openai-chatkit-starter-app)

## Next steps

When you’re happy with your ChatKit implementation, learn how to optimize it with [evals](agent-evals.md). For new ChatKit apps, or to move an existing ChatKit app off an Agent Builder-hosted workflow, see the [advanced integration docs](custom-chatkit.md).