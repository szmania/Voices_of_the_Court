import { encode as gptEncode, decode as gptDecode } from 'gpt-tokenizer';
import getEncoding from 'llama-tokenizer-js';

// Define a mapping from NovelAI models to tokenizer identifiers.
const modelToTokenizer: { [model: string]: string } = {
  'kayra-v1': 'Nerdstash v2',
  'llama-3-erato-v1': 'Llama 3',
  'clio-v1': 'Nerdstash v1',
  'krake-v2': 'GPT-2',
  'euterpe-v2': 'GPT-2',
  '6B-v4': 'GPT-2',
};

/**
 * Tokenizes a string of text using the appropriate tokenizer for the given model.
 *
 * @param text The text to tokenize.
 * @param model The NovelAI model to use for tokenization.
 * @returns A Uint32Array of token IDs.
 */
export function tokenize(text: string, model: string): Uint32Array {
  const tokenizer = modelToTokenizer[model] || 'GPT-2';

  if (!modelToTokenizer[model]) {
    console.warn(`Unknown model: "${model}". Falling back to GPT-2 tokenizer.`);
  }

  switch (tokenizer) {
    case 'Nerdstash v2':
    case 'Llama 3':
      return new Uint32Array(getEncoding.encode(text));
    case 'Nerdstash v1':
      return new Uint32Array(gptEncode(text));
    case 'GPT-2':
    default:
      return new Uint32Array(gptEncode(text));
  }
}

/**
 * Decodes a Uint32Array of token IDs back into a string.
 *
 * @param tokens The tokens to decode.
 * @param model The NovelAI model used for the original tokenization.
 * @returns The decoded string.
 */
export function decode(tokens: Uint32Array, model: string): string {
    const tokenizer = modelToTokenizer[model] || 'GPT-2';

    switch (tokenizer) {
        case 'Nerdstash v2':
        case 'Llama 3':
            return getEncoding.decode(Array.from(tokens));
        case 'Nerdstash v1':
        case 'GPT-2':
        default:
            return gptDecode(Array.from(tokens));
    }
}