# Messenger Backend

Production-ready messaging backend built with Node.js, Express, TypeScript, Sequelize, and PostgreSQL.

## Features

- JWT authentication
- Real-time messaging with Socket.IO
- 1-to-1 conversations
- Text, image, and audio messages
- Message read/delivered status
- Reply to messages
- Soft delete messages
- User profiles and search

## Requirements

- Node.js 20+
- PostgreSQL 16+
- Docker (optional)

## Quick Start

### Development Mode

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start PostgreSQL (if not using Docker):
```bash
# Install and start PostgreSQL locally
```

4. Run the server:
```bash
npm run dev
```

The server will start on http://localhost:3000

### Docker Mode

```bash
docker-compose up
```

## API Documentation

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (authenticated)
- `PUT /api/auth/profile` - Update user profile (authenticated)

### Users

- `GET /api/users/search?q=query` - Search users (authenticated)
- `GET /api/users/:id` - Get user by ID (authenticated)

### Conversations

- `POST /api/conversations` - Create or get existing conversation (authenticated)
- `GET /api/conversations` - Get user's conversations (authenticated)
- `GET /api/conversations/:id` - Get conversation details (authenticated)

### Messages

- `POST /api/messages` - Send message (authenticated)
- `GET /api/messages/conversation/:conversationId` - Get messages (authenticated)
- `DELETE /api/messages/:id` - Delete message (authenticated)
- `POST /api/messages/:id/delivered` - Mark message as delivered (authenticated)
- `POST /api/messages/:id/read` - Mark message as read (authenticated)
- `POST /api/messages/conversation/:conversationId/read` - Mark conversation as read (authenticated)

### WebSocket Events

Client → Server:
- `join:conversation` - Join conversation room
- `leave:conversation` - Leave conversation room

Server → Client:
- `conversation:created` - New conversation created
- `message:new` - New message in conversation
- `message:received` - Message received notification
- `message:deleted` - Message deleted
- `message:delivered` - Message delivered status
- `message:read` - Message read status
- `conversation:read` - Conversation marked as read

## Database Schema

- **users** - User accounts
- **conversations** - Chat conversations
- **conversation_participants** - Conversation membership
- **messages** - Chat messages
- **message_reads** - Message read/delivered status

## Environment Variables

See `.env.example` for all required configuration.

## Production Deployment

1. Set proper environment variables
2. Use strong JWT secret
3. Configure CORS origin
4. Enable SSL/TLS
5. Use connection pooling
6. Set up monitoring and logging
