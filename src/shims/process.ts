// Minimal process shim for browser usage
export const env = {} as Record<string, string>;
export const argv: string[] = [];
export const cwd = () => '/';
export const platform = 'browser';
export default { env, argv, cwd, platform } as any;
