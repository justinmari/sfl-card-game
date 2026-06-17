declare module 'gifsicle-wasm-browser' {
  interface GifsicleInput {
    file: File | Blob | ArrayBuffer | string
    name: string
  }
  interface GifsicleRunOptions {
    input: GifsicleInput[]
    command: string[]
    folder?: string[]
    isStrict?: boolean
  }
  const gifsicle: { run(options: GifsicleRunOptions): Promise<File[]> }
  export default gifsicle
}
