/**
 * Simple encryption/decryption utilities
 * Note: In a production environment, use a proper encryption library
 */

/**
 * Encrypt a string using AES-GCM
 */
export async function encrypt(text: string, key: string): Promise<string> {
  // Convert the key to a CryptoKey
  const cryptoKey = await deriveKey(key);

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode the text
  const encodedText = new TextEncoder().encode(text);

  // Encrypt the text
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    cryptoKey,
    encodedText
  );

  // Combine IV and encrypted data
  const encryptedArray = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  encryptedArray.set(iv);
  encryptedArray.set(new Uint8Array(encryptedBuffer), iv.length);

  // Convert to base64 for storage
  return btoa(String.fromCharCode(...encryptedArray));
}

/**
 * Decrypt a string using AES-GCM
 */
export async function decrypt(
  encryptedText: string,
  key: string
): Promise<string> {
  // Convert the key to a CryptoKey
  const cryptoKey = await deriveKey(key);

  // Decode the base64 string
  const encryptedArray = new Uint8Array(
    atob(encryptedText)
      .split("")
      .map((char) => char.charCodeAt(0))
  );

  // Extract the IV and encrypted data
  const iv = encryptedArray.slice(0, 12);
  const encryptedData = encryptedArray.slice(12);

  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    cryptoKey,
    encryptedData
  );

  // Decode the decrypted data
  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Derive a CryptoKey from a string key
 */
async function deriveKey(key: string): Promise<CryptoKey> {
  // Convert the key string to an array buffer
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);

  // Import the key
  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Use a salt
  const salt = encoder.encode("wifi-manager-salt");

  // Derive the key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    importedKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
