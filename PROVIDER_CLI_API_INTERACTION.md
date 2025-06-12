### Cxmpute Provider CLI and Backend API Interaction

This document outlines the interaction between the `cxmpute-provider` CLI and the Cxmpute backend API, detailing the flow of operations from initial setup to running a provider node.

#### Core Components

*   **`cxmpute-provider` CLI**: A command-line tool for compute providers to register their devices and run them as part of the Cxmpute network. It's built with TypeScript and uses Ink for its user interface.
*   **Cxmpute Backend API**: A set of HTTP endpoints, built with Next.js, that manage providers, provisions, and orchestrate services. It uses AWS DynamoDB for data persistence.

#### High-Level Flow

The overall process can be broken down into two main phases:
1.  **First-Time Setup (Registration)**: When a provider runs the CLI for the first time, they go through a setup process to register their device with the Cxmpute network.
2.  **Node Operation (Starting and Running)**: On subsequent runs, the CLI uses the stored configuration to start the provider node, get assigned tasks (services), and communicate with the backend.

#### Detailed Interaction

Here is a step-by-step breakdown of the interactions between the CLI and the backend API.

##### 1. First-Time Setup and Registration

This phase is handled by the `handleSetupComplete` function in `clis/cxmpute-provider/source/app.tsx` on the CLI side and the `/v1/providers/new` endpoint on the backend.

1.  **User Input**: The provider enters their `providerId`, `providerAk` (API key), location, and a name for their device through the CLI's setup interface.
2.  **Diagnostics**: The CLI runs a diagnostics script (`runDiagnosticsScript`) to gather information about the provider's hardware (CPU, GPU, RAM, storage).
3.  **Provision ID Generation**: The CLI generates a unique `provisionId` using `uuidv4()`. This ID is crucial for identifying this specific device provision.
4.  **Registration Request**: The CLI constructs a payload containing the user's input, the device diagnostics, and the generated `provisionId`. It then sends this payload in a `POST` request to the `/api/v1/providers/new` backend endpoint.
    *   **CLI File**: `clis/cxmpute-provider/source/lib/api.ts` (function: `registerDevice`)
5.  **Backend Validation**: The backend receives the registration request.
    *   It first validates a `registrationSecret` to ensure the request is from a legitimate source.
    *   It then queries the `ProviderTable` in DynamoDB to verify that the `providerId` exists and the `providerAk` is correct.
    *   **Backend File**: `src/app/api/v1/providers/new/route.ts`
6.  **Provision Creation**: Upon successful validation, the backend creates a new item in the `ProvisionsTable` in DynamoDB. This record stores the `provisionId`, `providerId`, device diagnostics, and location.
7.  **Successful Registration Response**: The backend responds with a success message, including the `deviceId` (which is the same `provisionId` the CLI sent).
8.  **Session Storage**: The CLI receives the successful response. It saves the `providerId`, `providerAk`, and the confirmed `deviceId` into a local configuration file (managed by `localStorage.ts`). This session data will be used for all future interactions.

##### 2. Starting the Node

When the CLI starts and finds a saved session, it proceeds to start the provider node.

1.  **Read Session**: The CLI reads the saved session data, which includes the `deviceId` (`provisionId`).
2.  **Start Request**: The CLI sends a `POST` request to the `/api/v1/providers/start` endpoint. The payload includes the `provisionId`, the `providerAk`, and the latest `availableResources` from a fresh diagnostics check.
    *   **CLI Files**: `clis/cxmpute-provider/source/scripts/manageNode.ts`, `clis/cxmpute-provider/source/lib/api.ts` (function: `requestServicesFromOrchestrator`)
3.  **Backend Provision Verification**: The backend's `/api/v1/providers/start` handler receives the request.
    *   Its first action is to query the `ProvisionsTable` in DynamoDB using the `provisionId` from the request.
    *   **Backend File**: `src/app/api/v1/providers/start/route.ts`
4.  **Service Calculation**: If the provision is found, the backend verifies the `providerAk` against the `ProviderTable`. It then runs a `calculateServices` algorithm. This algorithm determines which AI models or other services the provider's device should run based on its hardware (VRAM, storage) and the current needs of the Cxmpute network (demand for different models).
5.  **Service List Response**: The backend responds with a list of services for the CLI to start (e.g., `['llm:phi-2', 'tts:xtts-v2']`).
6.  **Starting Services**: The CLI receives the list of services and starts the necessary local processes (e.g., pulling and running Docker containers for the specified models).
7.  **Start Callback**: Once the services are running, the CLI sends a final confirmation to the backend via a `POST` request to `/api/v1/providers/start/callback`. This tells the orchestrator that the node is ready to accept work.

#### The "Provision not found" Error

The error `Orchestrator start request failed: {"error":"Provision not found."}` occurs in step 3 of the "Starting the Node" flow.

It indicates that when the CLI called `/api/v1/providers/start`, the `provisionId` it sent was not found in the backend's `ProvisionsTable`.

This points to an inconsistency between the CLI's locally stored session data and the backend's database. The most likely cause is that a previous registration attempt failed after the `provisionId` was generated locally but before it was successfully saved on the backend. When the CLI is restarted, it reads the invalid local `provisionId` and tries to use it, leading to the error. 