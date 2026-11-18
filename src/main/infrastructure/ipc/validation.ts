import { isAbsolute } from 'path'
import { z } from 'zod/v4'

/** Talyx runs this file, so it is never set through `settings:set` (page code could name any
 *  binary): only the native file chooser behind `engine:pick-path` and `engine:use-installed`
 *  (the user bin's engine, no argument) write it. */
export const EnginePathSchema = z.string().refine(isAbsolute, 'enginePath must be an absolute path')

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input)
}
