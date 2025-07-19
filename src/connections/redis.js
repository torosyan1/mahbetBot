// redisClient.js
const redis = require('redis');
const { REDIS_URL } = require('../config');

let redisClient;

const initializeRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL, // Replace with your Redis server URL
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });

    await redisClient.connect(); // Use this in Redis v4+
  }

  return redisClient;
};

module.exports = initializeRedis;
