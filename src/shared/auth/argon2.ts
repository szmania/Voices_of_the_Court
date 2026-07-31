import * as argon2 from 'argon2';

export async function hashAccessKey(accessKey: string): Promise<string> {
  try {
    const hashed = await argon2.hash(accessKey, {
      type: argon2.argon2id,
      hashLength: 64,
      salt: Buffer.from('novelai_data_access_key'),
    });
    return hashed.slice(0, 64);
  } catch (err) {
    console.error('Error hashing access key:', err);
    throw err;
  }
}