# 🧠 NeuraNotes

**Personal Second Brain Agent** — AI-powered knowledge capture, organization, and retrieval.

Mobile-First · AI-Powered · Offline-Capable

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native + Expo (TypeScript) |
| **Backend** | FastAPI (Python 3.12) |
| **AI Models** | Llama 3.3 70B + GPT-OSS 120B via Groq (free) |
| **Database** | Supabase (PostgreSQL + pgvector + Auth + Storage) |
| **Embeddings** | Google AI Studio (gemini-embedding-001) |
| **Cache** | Upstash Redis (free) |
| **Observability** | Langfuse (free tier) |

## Project Structure

```
NeuraNotes/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── core/     # Config, security
│   │   ├── db/       # Supabase client
│   │   ├── models/   # Pydantic models
│   │   ├── schemas/  # Request/response schemas
│   │   ├── routers/  # API endpoints
│   │   ├── services/ # Business logic + AI agent
│   │   ├── utils/    # Chunker, scrapers, parsers
│   │   └── main.py   # App entry point
│   └── supabase/     # Migration scripts
│
└── mobile/           # React Native (Expo) app
    ├── app/          # Expo Router screens
    ├── components/   # Reusable UI components
    ├── stores/       # Zustand state stores
    ├── services/     # API service layer
    ├── hooks/        # Custom React hooks
    └── constants/    # Theme, config
```

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env    # Fill in your API keys
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Required API Keys (All Free)

1. **Groq** — [console.groq.com](https://console.groq.com) → API Keys
2. **Supabase** — [supabase.com](https://supabase.com) → New Project
3. **Google AI Studio** — [aistudio.google.com](https://aistudio.google.com) → API Key
4. **Upstash Redis** — [upstash.com](https://upstash.com) → New Database
5. **Langfuse** — [cloud.langfuse.com](https://cloud.langfuse.com) → New Project

## License

MIT
