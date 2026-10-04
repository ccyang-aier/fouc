/**
 * Minimal local type surface for 'bun:test'.
 *
 * Frontend tests share this declaration; the backend uses its own @types/bun.
 * Keep the browser program's test API here without importing Bun's runtime
 * globals into production DOM types.
 */
declare module 'bun:test' {
  type TestFn = () => void | Promise<void>
  interface Matchers<T> {
    toBe(expected: unknown): T
    toEqual(expected: unknown): T
    toContain(expected: unknown): T
    toHaveLength(expected: number): T
    toBeNull(): T
    toBeUndefined(): T
    toBeDefined(): T
    toBeTruthy(): T
    toBeFalsy(): T
    toThrow(expected?: string | RegExp | (new (...args: never[]) => Error)): T
    toMatchObject(expected: Record<string, unknown>): T
    toHaveProperty(key: string, value?: unknown): T
    toMatch(pattern: string | RegExp): T
    toBeGreaterThan(expected: number): T
    toBeGreaterThanOrEqual(expected: number): T
    toBeLessThan(expected: number): T
    toBeLessThanOrEqual(expected: number): T
    toBeCloseTo(expected: number, precision?: number): T
    toStartWith(expected: string): T
  }
  interface Expectation<T> extends Matchers<T> {
    not: Matchers<T>
    rejects: Matchers<Promise<T>>
  }
  function describe(name: string, fn: () => void): void
  function test(name: string, fn: TestFn): void
  const it: typeof test
  function beforeAll(fn: () => void | Promise<void>, timeout?: number): void
  function afterAll(fn: () => void | Promise<void>): void
  function beforeEach(fn: () => void | Promise<void>): void
  function afterEach(fn: () => void | Promise<void>): void
  function expect<T>(actual: T): Expectation<T>
  const mock: { module(specifier: string, factory: () => Record<string, unknown>): void }
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
