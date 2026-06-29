import { encode, decode as gptDecode } from 'gpt-tokenizer';

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

  // In a real implementation, you would use the specific tokenizer library
  // for each tokenizer identifier. For this example, we'll use gpt-tokenizer for all.
  switch (tokenizer) {
    case 'Nerdstash v2':
      // Placeholder: Replace with actual Nerdstash v2 tokenizer
      return new Uint32Array(encode(text));
    case 'Llama 3':
      // Placeholder: Replace with actual Llama 3 tokenizer
      return new Uint32Array(encode(text));
    case 'Nerdstash v1':
      // Placeholder: Replace with actual Nerdstash v1 tokenizer
      return new Uint32Array(encode(text));
    case 'GPT-2':
    default:
      return new Uint32Array(encode(text));
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

    if (!modelToTokenizer[model]) {
        // Warning is already logged in tokenize, so we can skip it here.
    }

    // Use the same logic as tokenize to select the correct decoder.
    switch (tokenizer) {
        case 'Nerdstash v2':
            // Placeholder: Replace with actual Nerdstash v2 decoder
            return decode(Array.from(tokens));
        case 'Llama 3':
            // Placeholder: Replace with actual Llama 3 decoder
            return decode(Array.from(tokens));
        case 'Nerdstash v1':
            // Placeholder: Replace with actual Nerdstash v1 decoder
            return decode(Array.from(tokens));
        case 'GPT-2':
        default:
            return decode(Array.from(tokens));
    }
}