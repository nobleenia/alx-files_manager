import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.isConnected = false;

    this.client.on('error', (err) => {
      console.error(`Redis client not connected to the server: ${err}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      // Suppressed the console message
      this.isConnected = true;
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return this.isConnected;
  }

  async ensureConnection() {
    if (!this.isConnected) {
      await new Promise((resolve) => {
        this.client.once('connect', () => {
          this.isConnected = true;
          resolve();
        });
      });
    }
  }

  async get(key) {
    await this.ensureConnection();
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error(`Error getting key ${key}: ${err}`);
      return null;
    }
  }

  async set(key, value, duration) {
    await this.ensureConnection();
    try {
      await this.setAsync(key, value, 'EX', duration);
    } catch (err) {
      console.error(`Error setting key ${key} with value ${value}: ${err}`);
    }
  }

  async del(key) {
    await this.ensureConnection();
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error(`Error deleting key ${key}: ${err}`);
    }
  }
}

const redisClient = new RedisClient();
export default redisClient;
