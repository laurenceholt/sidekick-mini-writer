export function getEnv(name: string) {
  const netlifyEnv = (globalThis as unknown as { Netlify?: { env?: { get: (key: string) => string | undefined } } }).Netlify?.env;
  return netlifyEnv?.get(name) ?? process.env[name];
}
