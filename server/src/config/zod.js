// Friendly defaults for every zod schema in the API (schemas can still override per field).
import { z } from 'zod';

z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) return 'This field is required';
    if (issue.code === 'invalid_type' && issue.expected === 'number') return 'Must be a number';
    if (issue.code === 'invalid_type' && issue.expected === 'string') return 'Must be text';
    return undefined; // fall back to zod's message
  },
});
