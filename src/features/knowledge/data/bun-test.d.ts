/**
 * Minimal local type surface for 'bun:test'.
 *
 * The root program has no @types/bun (backend ships its own), and these are the
 * first frontend tests in the repo. This ambient declaration keeps `pnpm
 * typecheck` honest for the tests below without adding a dependency or touching
 * shared config; delete it when the workspace types bun tests centrally. It
 * covers exactly the API used by the *.test.ts files in this directory.
 */
declare module 'bun:test' {
  type TestFn = () => void | Promise<void>
  interface Matchers<T> {
    toBe(expected: unknown): T
    toEqual(expected: unknown): T
    toContain(expected: unknown): T
    toHaveLength(expected: number): T
    toBeNull(): T
    toThrow(expected?: string | RegExp): T
    toMatchObject(expected: Record<string, unknown>): T
    toBeGreaterThan(expected: number): T
  }
  interface Expectation<T> extends Matchers<T> {
    not: Matchers<T>
    rejects: Matchers<Promise<T>>
  }
  function describe(name: string, fn: () => void): void
  function test(name: string, fn: TestFn): void
  function expect<T>(actual: T): Expectation<T>
}

/** The one Bun global the bundle test uses: the build API for the browser-target check. */
declare namespace Bun {
  interface BuildArtifact {
    text(): Promise<string>
  }
  interface BuildOutput {
    success: boolean
    outputs: BuildArtifact[]
  }
  function build(options: { entrypoints: string[]; target: string }): Promise<BuildOutput>
}
