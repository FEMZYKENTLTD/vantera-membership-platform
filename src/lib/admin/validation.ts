import { z } from 'zod';
import { emailSchema } from '@/lib/validation/schemas';

/** Grant-role form: email + role key + an explicit permission set. */
export const rolesPrivilegesSchema = z.object({
  email: emailSchema,
  roleKey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{1,40}$/, 'Use a lowercase role key, e.g. designer'),
  permissions: z.array(z.string().min(2).max(60)).max(50)
});
