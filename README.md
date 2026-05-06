# InnoSale MVP

InnoSale is a single-repo MVP that transforms sales planning for complex industrial products using an AI-assisted inference engine and a local JSON knowledge base.

## MVP Stack

- AI semantic search: `sentence-transformers/all-MiniLM-L6-v2` via `@xenova/transformers`
- Backend: Node.js + Express
- Frontend: React + Tailwind CSS
- Data store: `knowledge_base.json` (no database)

## Architecture (Fake It Till You Make It)

- `frontend`: chat-style UI for salesperson input and trust-first output
- `backend`: rule validation + semantic ranking + pricing
- `knowledge_base.json`: mocked expert knowledge with hard constraints, pricing rules, and manual excerpts

This keeps the MVP monolithic and fast to iterate while preserving the core inference behavior.

## Core Inference Logic (Task T2.2)

`POST /validate` performs three functions:

1. Product validation
	- Invalid when `user_psi > constraints.max_psi`
	- Invalid when `user_material` is not in `compatible_materials`
2. Pricing support
	- `Price = base_price + (user_psi * multiplier)`
3. Suggestion mechanism
	- If invalid, return the closest valid product based on semantic similarity
	- If no valid semantic match exists, return a fallback: `General Purpose Pump`

## Knowledge Base Schema

Each entry in `knowledge_base.json` follows:

```json
{
  "product_id": "string",
  "name": "string",
  "constraints": {
    "max_psi": "number",
    "compatible_materials": ["string"]
  },
  "pricing": {
    "base_price": "number",
    "multiplier": "number"
  },
  "manual_excerpt": "string"
}
```

## Local Run

### Backend

```bash
cd backend
npm install
npm run dev
```

API runs on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs on Vite default `http://localhost:5173`.

## Frontend UX Requirements Implemented

- Chat-style prompt input
- Gatekeeper status light (`VALID` / `INVALID`)
- Traceability section showing exact `manual_excerpt` used by inference
