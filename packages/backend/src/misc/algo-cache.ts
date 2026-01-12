import { redisClient } from '@/db/redis.js';
import * as brain from 'brain.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algo-cache', 'cyan');

const CACHE_EXPIRATION = 60 * 60 * 24; // 24 hours in seconds
const MODEL_VERSION = '1.0'; // Add version tracking for model updates
const MAX_MODEL_SIZE = 1024 * 1024; // 1MB max model size
const MIN_TRAINING_EXAMPLES = 100; // Minimum examples needed for a valid model

// Define proper types for the neural network
type NeuralNetworkType = brain.NeuralNetwork<Float32Array, Float32Array>;
type CreateModelFunction = () => Promise<NeuralNetworkType>;

interface CachedModel {
  version: string;
  model: any;
  lastUpdated: number;
  trainingExamples: number;
  performance: {
    error: number;
    iterations: number;
  };
}

export class AlgoCache {
  private static metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    invalidModels: 0,
    modelUpdates: 0,
    cacheSize: 0,
  };

  private static validateModel(model: any): boolean {
    try {
      // Basic validation of model structure
      if (!model || typeof model !== 'object') return false;
      
      // Check model size
      const modelSize = JSON.stringify(model).length;
      if (modelSize > MAX_MODEL_SIZE) {
        logger.warn(`Model too large: ${modelSize} bytes`);
        return false;
      }

      // Validate neural network structure
      if (!Array.isArray(model.layers) || model.layers.length < 2) return false;
      
      // Validate weights and biases
      for (const layer of model.layers) {
        if (!Array.isArray(layer.weights) || !Array.isArray(layer.biases)) return false;
      }

      return true;
    } catch (error) {
      logger.error('Model validation failed:', error);
      return false;
    }
  }

  static async getModel(userId: string): Promise<NeuralNetworkType | null> {
    const cacheKey = `algo:user:${userId}:model`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        const parsed: CachedModel = JSON.parse(cachedData);
        
        // Check model version and age
        if (parsed.version !== MODEL_VERSION || 
            Date.now() - parsed.lastUpdated > CACHE_EXPIRATION * 1000) {
          this.metrics.cacheMisses++;
          logger.info(`Cache miss for user ${userId} (version mismatch or expired)`);
          return null;
        }

        // Check if model has enough training examples
        if (parsed.trainingExamples < MIN_TRAINING_EXAMPLES) {
          this.metrics.invalidModels++;
          logger.warn(`Model for user ${userId} has insufficient training examples: ${parsed.trainingExamples}`);
          return null;
        }

        if (!this.validateModel(parsed.model)) {
          this.metrics.invalidModels++;
          logger.warn(`Invalid model found for user ${userId}`);
          return null;
        }

        this.metrics.cacheHits++;
        logger.info(`Cache hit for user ${userId}`);
        
        const net = new brain.NeuralNetwork<Float32Array, Float32Array>();
        net.fromJSON(parsed.model);
        return net;
      }
      
      this.metrics.cacheMisses++;
      logger.info(`Cache miss for user ${userId}`);
      return null;
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error getting model for user ${userId}:`, error);
      return null; // Return null on error to trigger model recreation
    }
  }

  static async setModel(userId: string, model: NeuralNetworkType, trainingData: any[]): Promise<void> {
    const cacheKey = `algo:user:${userId}:model`;
    try {
      const modelData = model.toJSON();
      if (!this.validateModel(modelData)) {
        throw new Error('Invalid model data');
      }

      // Get model performance metrics
      const stats = model.trainer?.stats || { error: 0, iterations: 0 };

      const cacheData: CachedModel = {
        version: MODEL_VERSION,
        model: modelData,
        lastUpdated: Date.now(),
        trainingExamples: trainingData.length,
        performance: {
          error: stats.error || 0,
          iterations: stats.iterations || 0
        }
      };

      const serializedData = JSON.stringify(cacheData);
      
      // Update cache size metric
      this.metrics.cacheSize = serializedData.length;
      
      // Use Redis pipeline for atomic operations
      const pipeline = redisClient.pipeline();
      pipeline.set(cacheKey, serializedData, 'EX', CACHE_EXPIRATION);
      pipeline.hset(`algo:user:${userId}:stats`, {
        lastUpdated: Date.now(),
        trainingExamples: trainingData.length,
        error: stats.error || 0,
        iterations: stats.iterations || 0
      });
      
      await pipeline.exec();
      
      this.metrics.modelUpdates++;
      logger.info(`Model cached for user ${userId} with ${trainingData.length} examples`);
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error setting model for user ${userId}:`, error);
      // Don't throw, just log the error
    }
  }

  static async clearModel(userId: string): Promise<void> {
    const cacheKey = `algo:user:${userId}:model`;
    const statsKey = `algo:user:${userId}:stats`;
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redisClient.pipeline();
      pipeline.del(cacheKey);
      pipeline.del(statsKey);
      await pipeline.exec();
      
      logger.info(`Cache cleared for user ${userId}`);
    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error clearing model for user ${userId}:`, error);
      // Don't throw, just log the error
    }
  }

  static async getModelStats(userId: string): Promise<any> {
    const statsKey = `algo:user:${userId}:stats`;
    try {
      const stats = await redisClient.hgetall(statsKey);
      return stats;
    } catch (error) {
      logger.error(`Error getting model stats for user ${userId}:`, error);
      return null;
    }
  }

  static getMetrics() {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) * 100 : 0;
    
    return {
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      errors: this.metrics.errors,
      invalidModels: this.metrics.invalidModels,
      modelUpdates: this.metrics.modelUpdates,
      cacheSize: this.metrics.cacheSize,
      totalRequests,
      hitRate: hitRate.toFixed(2) + '%',
    };
  }

  static logMetrics() {
    const metrics = this.getMetrics();
    logger.info('AlgoCache Metrics:', metrics);
  }
}

export async function getOrCreateModel(
  userId: string,
  createModelFn: CreateModelFunction,
  trainingData: any[]
): Promise<NeuralNetworkType> {
  let model = await AlgoCache.getModel(userId);
  if (!model) {
    try {
      logger.info(`Creating new model for user ${userId}`);
      model = await createModelFn();
      await AlgoCache.setModel(userId, model, trainingData);
    } catch (error) {
      logger.error(`Error creating model for user ${userId}:`, error);
      throw error;
    }
  }
  return model;
}

// Periodic logging of metrics
setInterval(() => {
  AlgoCache.logMetrics();
}, 60000); // Log every minute