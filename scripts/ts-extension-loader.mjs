import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (!specifier.startsWith(".") || !context.parentURL?.startsWith("file:")) throw error;
    const parentPath = path.dirname(fileURLToPath(context.parentURL));
    for (const extension of [".ts", ".js", ".mjs"]) {
      const candidate = path.resolve(parentPath, `${specifier}${extension}`);
      try {
        await access(candidate);
        return nextResolve(pathToFileURL(candidate).href, context);
      } catch { /* Check the next ordinary source extension. */ }
    }
    throw error;
  }
}
