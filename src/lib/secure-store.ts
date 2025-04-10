import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Secure storage for WiFi credentials
 * In a real implementation, this would use platform-specific secure storage
 */
class SecureStore {
  private credentials: Map<string, string> = new Map();
  private encryptionKey: string | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the secure store
   */
  private async initialize() {
    logger.debug("Initializing SecureStore");
    try {
      // In a real implementation, this would initialize platform-specific secure storage
      // For this example, we'll use localStorage with encryption

      // Generate or retrieve encryption key
      this.encryptionKey = localStorage.getItem("wifi-manager-encryption-key");
      if (!this.encryptionKey) {
        // Generate a random encryption key
        this.encryptionKey = Array.from(
          crypto.getRandomValues(new Uint8Array(32))
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        localStorage.setItem("wifi-manager-encryption-key", this.encryptionKey);
      }

      // Load saved credentials
      const savedCredentialsJson = localStorage.getItem(
        "wifi-manager-credentials"
      );
      if (savedCredentialsJson) {
        try {
          const encryptedCredentials = JSON.parse(savedCredentialsJson);

          // Decrypt and load each credential
          for (const [networkId, encryptedPassword] of Object.entries(
            encryptedCredentials
          )) {
            try {
              const password = await decrypt(
                encryptedPassword as string,
                this.encryptionKey
              );
              this.credentials.set(networkId, password);
            } catch (error) {
              logger.error(
                `Failed to decrypt credentials for network ${networkId}`,
                error
              );
            }
          }

          logger.info(`Loaded ${this.credentials.size} saved credentials`);
        } catch (error) {
          logger.error("Failed to parse saved credentials", error);
        }
      }

      this.initialized = true;
      logger.info("SecureStore initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize SecureStore", error);
    }
  }

  /**
   * Ensure the store is initialized before operations
   */
  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Save credentials to persistent storage
   */
  private async saveToStorage() {
    logger.debug("Saving credentials to storage");
    try {
      // Convert credentials map to object with encrypted values
      const encryptedCredentials: Record<string, string> = {};

      for (const [networkId, password] of this.credentials.entries()) {
        if (this.encryptionKey) {
          encryptedCredentials[networkId] = await encrypt(
            password,
            this.encryptionKey
          );
        }
      }

      // Save to localStorage
      localStorage.setItem(
        "wifi-manager-credentials",
        JSON.stringify(encryptedCredentials)
      );
      logger.info(`Saved ${this.credentials.size} credentials to storage`);
    } catch (error) {
      logger.error("Failed to save credentials to storage", error);
      throw new Error("Failed to save credentials");
    }
  }

  /**
   * Save credentials for a network
   */
  async saveCredentials(networkId: string, password: string): Promise<void> {
    logger.debug(`Saving credentials for network ${networkId}`);
    await this.ensureInitialized();

    this.credentials.set(networkId, password);
    await this.saveToStorage();

    logger.info(`Credentials saved for network ${networkId}`);
  }

  /**
   * Get credentials for a network
   */
  async getCredentials(networkId: string): Promise<string> {
    logger.debug(`Getting credentials for network ${networkId}`);
    await this.ensureInitialized();

    const password = this.credentials.get(networkId);
    if (!password) {
      logger.warn(`No credentials found for network ${networkId}`);
      throw new Error("No credentials found for this network");
    }

    logger.debug(`Retrieved credentials for network ${networkId}`);
    return password;
  }

  /**
   * Check if we have credentials for a network
   */
  async hasCredentials(networkId: string): Promise<boolean> {
    logger.debug(`Checking for credentials for network ${networkId}`);
    await this.ensureInitialized();

    const hasCredentials = this.credentials.has(networkId);
    logger.debug(
      `Credentials for network ${networkId}: ${
        hasCredentials ? "Found" : "Not found"
      }`
    );
    return hasCredentials;
  }

  /**
   * Delete credentials for a network
   */
  async deleteCredentials(networkId: string): Promise<void> {
    logger.debug(`Deleting credentials for network ${networkId}`);
    await this.ensureInitialized();

    const hadCredentials = this.credentials.delete(networkId);
    await this.saveToStorage();

    if (hadCredentials) {
      logger.info(`Credentials deleted for network ${networkId}`);
    } else {
      logger.warn(`No credentials found to delete for network ${networkId}`);
    }
  }

  /**
   * Clear all stored credentials
   */
  async clearAllCredentials(): Promise<void> {
    logger.info("Clearing all stored credentials");
    await this.ensureInitialized();

    this.credentials.clear();
    await this.saveToStorage();

    logger.info("All credentials cleared");
  }
}

// Singleton instance
export const secureStore = new SecureStore();
