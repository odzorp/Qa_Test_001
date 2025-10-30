import express, {
  NextFunction,
  Request,
  Response as ExpressResponse,
} from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

const VALIDATION_URL = "https://schoolbaseapp.com/validate-name";
const USERS_PATH = path.resolve(__dirname, "../data/users.json");

// Create Express app instance
const app = express();

// Health check endpoint
app.get("/health", (_req: Request, res: ExpressResponse) => {
  res.json({ status: "ok" });
});

// Validate users endpoint
app.get(
  "/api/validate-users",
  async (_req: Request, res: ExpressResponse, next: NextFunction) => {
    try {
      const users = await loadUsers();
      const results = [];

      for (const name of users) {
        const result = await validateUser(name);
        results.push(result);
      }

      res.json({ validated: users.length, results });
    } catch (error) {
      next(error);
    }
  },
);

// Error handling middleware
app.use(
  (
    error: unknown,
    _req: Request,
    res: ExpressResponse,
    _next: NextFunction,
  ) => {
    if (res.headersSent) {
      return;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while validating user names.";

    res.status(500).json({ error: message });
  },
);

// Load users from JSON file
async function loadUsers(): Promise<string[]> {
  const raw = await fs.readFile(USERS_PATH, "utf8");
  return JSON.parse(raw) as string[];
}

// Name normalization function
function normalizeName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return normalized;
}

// Validate individual user
async function validateUser(name: string): Promise<{ name: string; status: string; message: string }> {
  const normalized = normalizeName(name);
  const url = `${VALIDATION_URL}?name=${encodeURIComponent(normalized)}`;

  try {
    const response = await fetch(url);
    const message = await extractMessage(response);

    return {
      name,
      status: response.status === 200 ? 'valid' : 'invalid',
      message
    };
  } catch (error) {
    return {
      name,
      status: 'error',
      message: 'Failed to reach validation service'
    };
  }
}

// Extract message from response
async function extractMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as RemoteResponse;
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch (_error) {
    // Ignore JSON parse errors
  }

  return `Received status ${response.status}`;
}

// Types
type RemoteResponse = {
  message?: string;
  name?: string;
};

// Server startup function
function startServer() {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Start server only if running directly
if (require.main === module) {
  startServer();
}

// Exports for testing
export { app, normalizeName, validateUser };
