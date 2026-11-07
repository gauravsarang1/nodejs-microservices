# Node.js Microservices

A TypeScript-based backend project demonstrating a **microservices architecture** using Node.js, Express.js, PostgreSQL, Apache Kafka, and Docker.

The system consists of independently runnable services, an API Gateway for client-facing communication, and Kafka for asynchronous event-driven communication.

> **Project Status:** Development-oriented implementation. Services run independently, but database isolation and several production-grade reliability mechanisms are not yet implemented.

## Architecture

The project follows three architectural patterns:

- **Microservices Architecture:** Applications are divided into independently runnable services.
- **API Gateway Pattern:** A centralized entry point handles client requests and routes them to backend services.
- **Event-Driven Architecture:** Apache Kafka enables asynchronous communication between services.

### High-Level Architecture

```text
                         CLIENT
                            |
                            v
                   +----------------+
                   |   API GATEWAY  |
                   |    Port 3000   |
                   +----------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
      +-------------+ +-------------+ +-------------+
      | AUTH SERVICE| |TASK SERVICE | |MEDIA SERVICE|
      | Port 3001   | | Port 3002   | | Port 3003   |
      +-------------+ +-------------+ +-------------+
                            |              |
                            |              |
                            v              v
                      +------------------------+
                      |     APACHE KAFKA       |
                      |                        |
                      |   task.events          |
                      |   media.events         |
                      +------------------------+
                                  |
                                  v
                       +--------------------+
                       | WORKFLOW SERVICE   |
                       |     Port 3004      |
                       +--------------------+

      +------------------------------------------------+
      |                  POSTGRESQL                    |
      |                                                |
      | Users | Tasks | Attachments | Task Workflows   |
      +------------------------------------------------+

                       +--------------------+
                       | S3-Compatible      |
                       | Object Storage     |
                       +--------------------+

      Shared infrastructure utilities:
      packages/shared
      Used across all applications.
```

**Architecture notes:**

- Client requests enter through the API Gateway.
- The gateway performs authentication, authorization, rate limiting, and request forwarding.
- Backend services communicate synchronously over HTTP when handling client requests.
- Task and Media services publish events to Kafka.
- Workflow Service consumes events and records workflow activity.
- Common infrastructure utilities are maintained in `packages/shared`.
- Services currently share one PostgreSQL database and connection-pool implementation. Database-per-service isolation is not implemented.

### Request and Event Flow

```text
CLIENT
  |
  | HTTP Request
  v
API GATEWAY
  |
  | JWT Validation
  | RBAC Checks
  | Middleware
  |
  v
BACKEND SERVICE
  |
  +------ HTTP Response ------> API GATEWAY ------> CLIENT
  |
  |
  +------ Publish Event ------> APACHE KAFKA
                                      |
                                      | Consume Event
                                      v
                               WORKFLOW SERVICE
                                      |
                                      v
                                  POSTGRESQL
```

## Microservices

| Application | Port | Responsibility |
|---|---:|---|
| API Gateway | 3000 | Client entry point, request routing, JWT validation, RBAC, and HTTP middleware. |
| Auth Service | 3001 | User registration, login, password hashing, JWT issuance, and user profiles. |
| Task Service | 3002 | Task creation, retrieval, user-scoped listing, administrator deletion, and Kafka event publishing. |
| Media Service | 3003 | Task attachment uploads, attachment listing, object storage integration, and event publishing. |
| Workflow Service | 3004 | Kafka event consumption and workflow activity persistence. |
| Shared Package | — | Reusable database, authentication, Kafka, validation, logging, and error-handling utilities. |

Each application has its own `src/index.ts` entry point and can be started independently.

The API Gateway currently proxies:

- `/auth`
- `/tasks`
- `/media`

## Technology Stack

| Area | Technologies |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| HTTP Framework | Express 5 |
| API Gateway | http-proxy-middleware |
| Security | Helmet, CORS, express-rate-limit |
| Database | PostgreSQL |
| Database Driver | pg |
| Migrations | SQL migrations |
| Messaging | Apache Kafka, KafkaJS |
| Authentication | JWT, jsonwebtoken, bcryptjs |
| Authorization | Role-Based Access Control |
| Validation | Zod |
| Object Storage | AWS SDK for S3-compatible storage |
| Logging | Pino, pino-http |
| Workspace | npm workspaces |
| Development | tsx |
| Containerization | Docker, Docker Compose |

## Project Structure

```text
nodejs-microservices/
│
├── apps/
│   ├── api-gateway/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── auth-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── task-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── media-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   └── workflow-service/
│       └── src/
│           └── index.ts
│
├── packages/
│   └── shared/
│       └── src/
│           ├── db/
│           ├── auth/
│           ├── kafka/
│           ├── validation/
│           └── utils/
│
├── sql/
│   └── migrations/
│
├── scripts/
│   └── migrate.ts
│
├── docker/
│
├── docker-compose.yml
├── dockerfile
├── package.json
├── tsconfig.base.json
└── README.md
```

## API Overview

The API Gateway is the primary client entry point:

`http://localhost:3000`

| Method | Endpoint | Service | Description |
|---|---|---|---|
| GET | `/health` | Gateway | Gateway health check |
| POST | `/auth/register` | Auth | Register a user |
| POST | `/auth/login` | Auth | Authenticate and receive JWT |
| GET | `/auth/me` | Auth | Retrieve authenticated user profile |
| POST | `/tasks` | Task | Create a task |
| GET | `/tasks` | Task | List user tasks |
| GET | `/tasks/:id` | Task | Retrieve a task |
| DELETE | `/tasks/:id` | Task | Delete a task (admin only) |
| POST | `/media/:taskId/attachments` | Media | Upload an image attachment |
| GET | `/media/:taskId/attachments` | Media | List task attachments |

Protected routes use bearer JWT authentication.

The gateway forwards verified identity information and an internal gateway secret to protected backend services.

Each service also exposes its own `/health` endpoint.

## Database and Messaging

### PostgreSQL

- Uses the Node.js `pg` driver.
- Database connections use a shared connection-pool helper.
- Schema changes are managed through versioned SQL migration files.
- A custom migration runner applies migrations.

Current database tables:

- `users`
- `tasks`
- `attachments`
- `task_workflows`

**Note:** All services currently use the same PostgreSQL database. Independent database ownership is not implemented.

Run migrations:

```bash
npm run db:migrate
```

### Apache Kafka

Kafka handles asynchronous event communication.

| Producer | Topic | Consumer | Purpose |
|---|---|---|---|
| Task Service | `task.events` | Workflow Service | Records task-related events |
| Media Service | `media.events` | Workflow Service | Records attachment-upload events |

Normal client API communication uses HTTP through the API Gateway. Kafka is reserved for asynchronous event processing.

## Getting Started

### Prerequisites

- Node.js 22 recommended
- npm
- PostgreSQL
- Docker and Docker Compose
- S3-compatible storage endpoint and bucket

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nodejs-microservices
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

Configure the following variables according to your environment:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | JWT signing secret |
| `GATEWAY_SECRET` | Internal gateway authentication |
| `KAFKA_BROKERS` | Kafka broker addresses |
| `AWS_ENDPOINT_URL_S3` | S3-compatible storage endpoint |
| `AWS_ACCESS_KEY_ID` | Storage access key |
| `AWS_SECRET_ACCESS_KEY` | Storage secret key |
| `AWS_REGION` | Storage region |
| `STORAGE_BUCKET` | Storage bucket name |

Use your own credentials. Never commit secrets to GitHub.

### 4. Start Kafka

```bash
npm run kafka:up
```

View Kafka logs:

```bash
npm run kafka:logs
```

Stop Kafka:

```bash
npm run kafka:down
```

### 5. Run Database Migrations

Ensure PostgreSQL is running and `DATABASE_URL` is configured.

```bash
npm run db:migrate
```

### 6. Start Individual Services

Run each service in a separate terminal from the project root.

```bash
npm run dev:gateway
```

```bash
npm run dev:auth
```

```bash
npm run dev:task
```

```bash
npm run dev:media
```

```bash
npm run dev:workflow
```

### 7. Run with Docker Compose

```bash
docker compose up --build
```

**Docker configuration note:** The current Compose configuration references `Dockerfile`, whereas the repository contains a lowercase `dockerfile`. Ensure the filename matches the Compose configuration, particularly on case-sensitive systems.

The current application Compose setup uses development commands and source bind mounts. It is not a production deployment configuration.

PostgreSQL and S3-compatible storage must be configured separately.

## Engineering Concepts Demonstrated

- Microservices architecture
- API Gateway pattern
- Event-driven architecture
- Synchronous HTTP communication
- Asynchronous messaging with Apache Kafka
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Shared infrastructure packages
- PostgreSQL connection pooling
- Versioned SQL migrations
- S3-compatible object storage
- Docker-based service orchestration

## Current Scope and Limitations

The project demonstrates core microservices concepts, but some production-grade capabilities are not yet implemented.

- **Database isolation:** Services currently share one PostgreSQL database.
- **Event reliability:** Kafka event publishing is best-effort. Durable retries and dead-letter queues are not implemented.
- **Idempotency:** Duplicate event processing protection is not implemented.
- **Workflow API:** Workflow records are consumed and stored, but workflow query functionality is not currently exposed through an HTTP route.
- **External dependencies:** PostgreSQL and S3-compatible storage must be provided separately.
- **Automated testing:** An automated test suite is not currently included.
- **Deployment pipeline:** A production CI/CD pipeline is not currently included.

---

**Built with Node.js, TypeScript, Express.js, PostgreSQL, Apache Kafka, and Docker.**# Node.js Microservices

A TypeScript-based backend project demonstrating a **microservices architecture** using Node.js, Express.js, PostgreSQL, Apache Kafka, and Docker.

The system consists of independently runnable services, an API Gateway for client-facing communication, and Kafka for asynchronous event-driven communication.

> **Project Status:** Development-oriented implementation. Services run independently, but database isolation and several production-grade reliability mechanisms are not yet implemented.

## Architecture

The project follows three architectural patterns:

- **Microservices Architecture:** Applications are divided into independently runnable services.
- **API Gateway Pattern:** A centralized entry point handles client requests and routes them to backend services.
- **Event-Driven Architecture:** Apache Kafka enables asynchronous communication between services.

### High-Level Architecture

```text
                         CLIENT
                            |
                            v
                   +----------------+
                   |   API GATEWAY  |
                   |    Port 3000   |
                   +----------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
      +-------------+ +-------------+ +-------------+
      | AUTH SERVICE| |TASK SERVICE | |MEDIA SERVICE|
      | Port 3001   | | Port 3002   | | Port 3003   |
      +-------------+ +-------------+ +-------------+
                            |              |
                            |              |
                            v              v
                      +------------------------+
                      |     APACHE KAFKA       |
                      |                        |
                      |   task.events          |
                      |   media.events         |
                      +------------------------+
                                  |
                                  v
                       +--------------------+
                       | WORKFLOW SERVICE   |
                       |     Port 3004      |
                       +--------------------+

      +------------------------------------------------+
      |                  POSTGRESQL                    |
      |                                                |
      | Users | Tasks | Attachments | Task Workflows   |
      +------------------------------------------------+

                       +--------------------+
                       | S3-Compatible      |
                       | Object Storage     |
                       +--------------------+

      Shared infrastructure utilities:
      packages/shared
      Used across all applications.
```

**Architecture notes:**

- Client requests enter through the API Gateway.
- The gateway performs authentication, authorization, rate limiting, and request forwarding.
- Backend services communicate synchronously over HTTP when handling client requests.
- Task and Media services publish events to Kafka.
- Workflow Service consumes events and records workflow activity.
- Common infrastructure utilities are maintained in `packages/shared`.
- Services currently share one PostgreSQL database and connection-pool implementation. Database-per-service isolation is not implemented.

### Request and Event Flow

```text
CLIENT
  |
  | HTTP Request
  v
API GATEWAY
  |
  | JWT Validation
  | RBAC Checks
  | Middleware
  |
  v
BACKEND SERVICE
  |
  +------ HTTP Response ------> API GATEWAY ------> CLIENT
  |
  |
  +------ Publish Event ------> APACHE KAFKA
                                      |
                                      | Consume Event
                                      v
                               WORKFLOW SERVICE
                                      |
                                      v
                                  POSTGRESQL
```

## Microservices

| Application | Port | Responsibility |
|---|---:|---|
| API Gateway | 3000 | Client entry point, request routing, JWT validation, RBAC, and HTTP middleware. |
| Auth Service | 3001 | User registration, login, password hashing, JWT issuance, and user profiles. |
| Task Service | 3002 | Task creation, retrieval, user-scoped listing, administrator deletion, and Kafka event publishing. |
| Media Service | 3003 | Task attachment uploads, attachment listing, object storage integration, and event publishing. |
| Workflow Service | 3004 | Kafka event consumption and workflow activity persistence. |
| Shared Package | — | Reusable database, authentication, Kafka, validation, logging, and error-handling utilities. |

Each application has its own `src/index.ts` entry point and can be started independently.

The API Gateway currently proxies:

- `/auth`
- `/tasks`
- `/media`

## Technology Stack

| Area | Technologies |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| HTTP Framework | Express 5 |
| API Gateway | http-proxy-middleware |
| Security | Helmet, CORS, express-rate-limit |
| Database | PostgreSQL |
| Database Driver | pg |
| Migrations | SQL migrations |
| Messaging | Apache Kafka, KafkaJS |
| Authentication | JWT, jsonwebtoken, bcryptjs |
| Authorization | Role-Based Access Control |
| Validation | Zod |
| Object Storage | AWS SDK for S3-compatible storage |
| Logging | Pino, pino-http |
| Workspace | npm workspaces |
| Development | tsx |
| Containerization | Docker, Docker Compose |

## Project Structure

```text
nodejs-microservices/
│
├── apps/
│   ├── api-gateway/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── auth-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── task-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── media-service/
│   │   └── src/
│   │       └── index.ts
│   │
│   └── workflow-service/
│       └── src/
│           └── index.ts
│
├── packages/
│   └── shared/
│       └── src/
│           ├── db/
│           ├── auth/
│           ├── kafka/
│           ├── validation/
│           └── utils/
│
├── sql/
│   └── migrations/
│
├── scripts/
│   └── migrate.ts
│
├── docker/
│
├── docker-compose.yml
├── dockerfile
├── package.json
├── tsconfig.base.json
└── README.md
```

## API Overview

The API Gateway is the primary client entry point:

`http://localhost:3000`

| Method | Endpoint | Service | Description |
|---|---|---|---|
| GET | `/health` | Gateway | Gateway health check |
| POST | `/auth/register` | Auth | Register a user |
| POST | `/auth/login` | Auth | Authenticate and receive JWT |
| GET | `/auth/me` | Auth | Retrieve authenticated user profile |
| POST | `/tasks` | Task | Create a task |
| GET | `/tasks` | Task | List user tasks |
| GET | `/tasks/:id` | Task | Retrieve a task |
| DELETE | `/tasks/:id` | Task | Delete a task (admin only) |
| POST | `/media/:taskId/attachments` | Media | Upload an image attachment |
| GET | `/media/:taskId/attachments` | Media | List task attachments |

Protected routes use bearer JWT authentication.

The gateway forwards verified identity information and an internal gateway secret to protected backend services.

Each service also exposes its own `/health` endpoint.

## Database and Messaging

### PostgreSQL

- Uses the Node.js `pg` driver.
- Database connections use a shared connection-pool helper.
- Schema changes are managed through versioned SQL migration files.
- A custom migration runner applies migrations.

Current database tables:

- `users`
- `tasks`
- `attachments`
- `task_workflows`

**Note:** All services currently use the same PostgreSQL database. Independent database ownership is not implemented.

Run migrations:

```bash
npm run db:migrate
```

### Apache Kafka

Kafka handles asynchronous event communication.

| Producer | Topic | Consumer | Purpose |
|---|---|---|---|
| Task Service | `task.events` | Workflow Service | Records task-related events |
| Media Service | `media.events` | Workflow Service | Records attachment-upload events |

Normal client API communication uses HTTP through the API Gateway. Kafka is reserved for asynchronous event processing.

## Getting Started

### Prerequisites

- Node.js 22 recommended
- npm
- PostgreSQL
- Docker and Docker Compose
- S3-compatible storage endpoint and bucket

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nodejs-microservices
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

Configure the following variables according to your environment:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | JWT signing secret |
| `GATEWAY_SECRET` | Internal gateway authentication |
| `KAFKA_BROKERS` | Kafka broker addresses |
| `AWS_ENDPOINT_URL_S3` | S3-compatible storage endpoint |
| `AWS_ACCESS_KEY_ID` | Storage access key |
| `AWS_SECRET_ACCESS_KEY` | Storage secret key |
| `AWS_REGION` | Storage region |
| `STORAGE_BUCKET` | Storage bucket name |

Use your own credentials. Never commit secrets to GitHub.

### 4. Start Kafka

```bash
npm run kafka:up
```

View Kafka logs:

```bash
npm run kafka:logs
```

Stop Kafka:

```bash
npm run kafka:down
```

### 5. Run Database Migrations

Ensure PostgreSQL is running and `DATABASE_URL` is configured.

```bash
npm run db:migrate
```

### 6. Start Individual Services

Run each service in a separate terminal from the project root.

```bash
npm run dev:gateway
```

```bash
npm run dev:auth
```

```bash
npm run dev:task
```

```bash
npm run dev:media
```

```bash
npm run dev:workflow
```

### 7. Run with Docker Compose

```bash
docker compose up --build
```

**Docker configuration note:** The current Compose configuration references `Dockerfile`, whereas the repository contains a lowercase `dockerfile`. Ensure the filename matches the Compose configuration, particularly on case-sensitive systems.

The current application Compose setup uses development commands and source bind mounts. It is not a production deployment configuration.

PostgreSQL and S3-compatible storage must be configured separately.

## Engineering Concepts Demonstrated

- Microservices architecture
- API Gateway pattern
- Event-driven architecture
- Synchronous HTTP communication
- Asynchronous messaging with Apache Kafka
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Shared infrastructure packages
- PostgreSQL connection pooling
- Versioned SQL migrations
- S3-compatible object storage
- Docker-based service orchestration

## Current Scope and Limitations

The project demonstrates core microservices concepts, but some production-grade capabilities are not yet implemented.

- **Database isolation:** Services currently share one PostgreSQL database.
- **Event reliability:** Kafka event publishing is best-effort. Durable retries and dead-letter queues are not implemented.
- **Idempotency:** Duplicate event processing protection is not implemented.
- **Workflow API:** Workflow records are consumed and stored, but workflow query functionality is not currently exposed through an HTTP route.
- **External dependencies:** PostgreSQL and S3-compatible storage must be provided separately.
- **Automated testing:** An automated test suite is not currently included.
- **Deployment pipeline:** A production CI/CD pipeline is not currently included.

---

**Built with Node.js, TypeScript, Express.js, PostgreSQL, Apache Kafka, and Docker.**
