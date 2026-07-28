declare module 'argon2' {
  export function hash(plain: string | Buffer, options?: any): Promise<string>;
  export function verify(hash: string, plain: string | Buffer): Promise<boolean>;
  export const argon2id: number;
  export const argon2i: number;
  export const argon2d: number;
}

declare module 'gpt-tokenizer' {
  export function encode(text: string): number[];
  export function decode(tokens: number[]): string;
}

declare module 'llama-tokenizer-js' {
  export default {
    encode(text: string): number[];
    decode(tokens: number[]): string;
  };
}