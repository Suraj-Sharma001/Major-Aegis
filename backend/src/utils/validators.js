import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);
const roleEnum = z.enum(['ADMIN', 'DEVELOPER', 'VIEWER']);

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(1).max(100),
  email,
  password,
});

export const loginSchema = z.object({ email, password: z.string().min(1) });

export const createTeamSchema = z.object({ name: z.string().trim().min(1).max(100) });

// Adds an existing org user to a team, or (Admin) creates the account on the spot.
export const addMemberSchema = z.object({
  email,
  name: z.string().trim().min(1).max(100).optional(),
  password: password.optional(),
  role: roleEnum.optional(),
});

export const createApplicationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  teamId: z.string().min(1, 'teamId is required (pick a team explicitly)'),
});

export const createKeySchema = z.object({ label: z.string().trim().min(1).max(100).default('default') });

export const providerKeySchema = z.object({
  provider: z.enum(['OPENAI', 'GEMINI', 'CLAUDE']), // Ollama is local and needs no key
  label: z.string().trim().min(1).max(100).default('default'),
  apiKey: z.string().trim().min(8, 'apiKey looks too short'),
});

export const chatSchema = z.object({
  model: z.string().trim().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1, 'content must be a non-empty string'),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});
