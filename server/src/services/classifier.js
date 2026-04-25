const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const CATEGORIES = ['pothole', 'broken_streetlight', 'garbage_dump', 'water_leakage'];

/**
 * Classify an image using the AI microservice.
 * Falls back to mock classification if the service is unavailable.
 */
async function classifyImage(imageUrl) {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/classify`, {
      image_url: imageUrl
    }, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.warn('⚠️  AI service unavailable, using mock classification:', error.message);
    return mockClassify();
  }
}

/**
 * Mock classifier for demo mode — returns realistic random results.
 */
function mockClassify() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const confidence = Math.round((65 + Math.random() * 30) * 100) / 100; // 65–95%
  return {
    category,
    confidence,
    requires_review: confidence < 70
  };
}

module.exports = { classifyImage, mockClassify, CATEGORIES };
