# Frontend

React + TypeScript frontend for the Personal Finance AI Platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

If you want to point the frontend at a deployed backend, set `VITE_API_BASE_URL` in a `.env` file:
```env
VITE_API_BASE_URL=https://your-backend-host
```

## Build

To build for production:
```bash
npm run build
```

The built files will be in the `dist` directory.
