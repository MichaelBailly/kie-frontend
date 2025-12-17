# 🎵 KIE Frontend

> A modern web interface for AI-powered music generation using KIE AI's API

Create beautiful, AI-generated music with an intuitive project-based interface. Organize your generations, track progress in real-time, and manage multiple music projects—all powered by cutting-edge AI technology.

---

## ✨ Features

- 🎨 **Project-Based Organization** - Group your music generations into projects
- ⚡ **Real-Time Updates** - Server-Sent Events (SSE) for live generation status
- 🎵 **Dual Track Generation** - Each generation produces two unique variants
- 🎚️ **Stem Separation** - Vocal removal / stem splitting with live status updates
- 🔄 **Smart Polling** - Automatic status updates with the KIE AI API
- 💾 **Local SQLite Storage** - Fast, reliable data persistence with WAL mode
- 🎯 **Form Pre-filling** - Quickly iterate on previous generations
- 🎭 **Modern UI** - Built with Svelte 5 and Tailwind CSS v4
- 📱 **Responsive Design** - Works seamlessly across devices

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- [Bun](https://bun.sh) v1.0 or higher installed
- A **KIE AI API key** (obtain from [KIE AI](https://kie.ai))
- Node.js 20+ (for compatibility checks)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/MichaelBailly/kie-frontend.git
   cd kie-frontend
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:

   ```bash
   KIE_API_KEY=your_kie_api_key_here
   ```

   > ⚠️ **Important**: Never commit your API key to version control!

4. **Start the development server**

   ```bash
   bun run dev
   ```

   The app will be available at `http://localhost:5173`

---

## 🎮 Development

### Available Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `bun run dev`         | Start development server with hot reload |
| `bun run build`       | Build for production                     |
| `bun run preview`     | Preview production build locally         |
| `bun run check`       | Run TypeScript type checking             |
| `bun run check:watch` | Type check in watch mode                 |
| `bun run format`      | Format code with Prettier                |
| `bun run lint`        | Lint code with ESLint and Prettier       |
| `bun run test`        | Run all tests (CI mode)                  |
| `bun run test:unit`   | Run tests in watch mode                  |

### Development Workflow

1. **Make your changes** in the `src/` directory
2. **Run type checking**: `bun run check`
3. **Format your code**: `bun run format`
4. **Lint your code**: `bun run lint`
5. **Run tests**: `bun run test`
6. **Commit** following conventional commit patterns

---

## 📁 Project Structure

```
kie-frontend/
├── src/
│   ├── lib/
│   │   ├── components/       # Svelte components
│   │   ├── assets/           # Static assets
│   │   ├── db.server.ts      # SQLite database operations
│   │   ├── kie-api.server.ts # KIE AI API integration
│   │   ├── sse.server.ts     # Server-Sent Events management
│   │   ├── types.ts          # Shared TypeScript types
│   │   └── constants.server.ts # Server-only constants
│   ├── routes/
│   │   ├── +layout.svelte    # Root layout
│   │   ├── +page.server.ts   # Home page (redirects to first project)
│   │   ├── projects/
│   │   │   └── [projectId]/  # Project detail pages
│   │   └── api/
│   │       ├── generations/     # Generation endpoints (+ extend)
│   │       ├── projects/        # Project CRUD endpoints
│   │       ├── stem-separation/ # Stem separation endpoint
│   │       └── sse/             # SSE endpoint
│   │   └── layout.css        # Tailwind CSS imports
│   └── app.html              # HTML template
├── static/                   # Public static files
├── package.json
├── svelte.config.js          # SvelteKit configuration
├── vite.config.ts            # Vite & Vitest configuration
└── tsconfig.json             # TypeScript configuration
```

---

## 🛠️ Technology Stack

### Core Framework

- **[SvelteKit](https://kit.svelte.dev/)** - Full-stack framework with file-based routing
- **[Svelte 5](https://svelte.dev/)** - Reactive UI with modern runes API
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development

### Styling & UI

- **[Tailwind CSS v4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[@tailwindcss/forms](https://github.com/tailwindlabs/tailwindcss-forms)** - Beautiful form styles
- **[@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography)** - Prose styling

### Data & State

- **[Bun SQLite](https://bun.sh/docs/api/sqlite)** - Fast, embedded database with WAL mode
- **Server-Sent Events (SSE)** - Real-time updates from server to client

### Development Tools

- **[Bun](https://bun.sh)** - Fast all-in-one JavaScript runtime
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool
- **[Vitest](https://vitest.dev/)** - Unit testing with Playwright browser support
- **[ESLint](https://eslint.org/)** - Code linting with flat config
- **[Prettier](https://prettier.io/)** - Code formatting

### Deployment

- **[@sveltejs/adapter-node](https://kit.svelte.dev/docs/adapter-node)** - Node.js production server

---

## 🏗️ Architecture Highlights

### Real-Time Updates with SSE

The app uses Server-Sent Events for live updates:

1. Client connects to `/api/sse` on page load
2. Server broadcasts generation status changes to all clients
3. UI updates automatically without polling

```typescript
// Client-side SSE subscription (automatic in layouts)
const eventSource = new EventSource('/api/sse');
eventSource.onmessage = (event) => {
   // The server sends default "message" events containing JSON with a `type` field
   const message = JSON.parse(event.data);
   if (message.type === 'generation_update' || message.type === 'generation_complete') {
      console.log('Generation update:', message.generationId, message.data);
   }
};
```

### KIE AI Integration

Generation workflow:

1. **Request** - User submits title, style, and lyrics
2. **Task Creation** - Server calls KIE AI to create generation task
3. **Polling** - Server polls KIE API every 5 seconds (max 10 minutes)
4. **Status Updates** - Progress flows: `PENDING` → `TEXT_SUCCESS` → `FIRST_SUCCESS` → `SUCCESS`
5. **Notification** - SSE broadcasts updates to all connected clients
6. **Storage** - Final URLs and metadata saved to SQLite

### Data Persistence

- **SQLite with WAL mode** for concurrent reads during writes
- **Development**: Database stored at `./kie-music.db`
- **Production**: Database stored at `/data/kie-music.db`
- **Schema**: Projects with one-to-many Generations relationship

---

## 🧪 Testing

The project uses **Vitest** with two test suites:

- **Client tests** (`*.svelte.{test,spec}.ts`) - Browser tests with Playwright
- **Server tests** (`*.{test,spec}.ts`) - Node.js unit tests

Run tests:

```bash
# All tests (CI mode)
bun run test

# Watch mode
bun run test:unit

# Type checking
bun run check
```

> 💡 **Note**: Browser tests require Playwright. If tests fail locally, run:
>
> ```bash
> npx playwright install
> npx playwright install-deps  # Linux only
> ```

---

## 🚢 Production Deployment

### Build the Application

```bash
bun run build
```

This creates an optimized build in the `build/` directory.

### Run in Production

```bash
# Set environment variables
export KIE_API_KEY=your_production_api_key

# Start the server (preview mode)
bun run preview

# Or run the built Node.js server directly
node build/index.js
```

### Important Production Notes

- Ensure `/data` directory exists and is writable for SQLite database
- Set `KIE_API_KEY` environment variable
- The app uses `@sveltejs/adapter-node` for production deployment
- Database will be created at `/data/kie-music.db` in production mode

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the project conventions
4. **Run linting and tests**:
   ```bash
   bun run format
   bun run lint
   bun run test
   ```
5. **Commit your changes**: `git commit -m 'feat: add amazing feature'`
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- Follow the existing code patterns
- Use **Svelte 5 runes** (`$props()`, `$state()`, `$derived()`)
- Server-only code must use `.server.ts` suffix
- Run `bun run format` before committing

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- **[KIE AI](https://kie.ai)** - For providing the music generation API
- **[Svelte](https://svelte.dev/)** - For the amazing framework
- **[Bun](https://bun.sh)** - For the blazing-fast runtime

---

## 📞 Support

Having issues or questions?

- 🐛 [Report a bug](https://github.com/MichaelBailly/kie-frontend/issues/new)
- 💡 [Request a feature](https://github.com/MichaelBailly/kie-frontend/issues/new)
- 💬 [Start a discussion](https://github.com/MichaelBailly/kie-frontend/discussions)

---

<div align="center">
  <strong>Built with ❤️ using Svelte 5 and Bun</strong>
</div>
