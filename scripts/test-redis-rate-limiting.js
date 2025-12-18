#!/usr/bin/env node

/**
 * Redis Rate Limiting Test Runner
 * Manual testing script for Redis-based rate limiting
 *
 * Usage:
 *   node scripts/test-redis-rate-limiting.js
 *   BASE_URL=https://prod.example.com node scripts/test-redis-rate-limiting.js
 *   TEST_TYPE=integration node scripts/test-redis-rate-limiting.js
 */

const { performance } = require('perf_hooks')
const fetch = require('node-fetch').default || fetch

const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  testType: process.env.TEST_TYPE || 'unit', // 'unit', 'integration', 'load'
  concurrent: parseInt(process.env.CONCURRENT_REQUESTS) || 10,
  duration: parseInt(process.env.TEST_DURATION) || 30, // seconds
  verbose: process.env.VERBOSE === 'true'
}

class RateLimitTester {
  constructor() {
    this.results = {
      total: 0,
      success: 0,
      rateLimited: 0,
      errors: 0,
      responseTimes: [],
      rateLimitHits: []
    }
  }

  async makeRequest(endpoint, payload, headers = {}, testId = 'unknown') {
    const startTime = performance.now()

    try {
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `RateLimitTester/1.0 (${testId})`,
          'X-Test-Request-ID': testId,
          ...headers
        },
        body: JSON.stringify(payload),
        timeout: 10000
      })

      const endTime = performance.now()
      const responseTime = endTime - startTime

      const result = {
        status: response.status,
        responseTime,
        headers: {
          'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
          'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
          'retry-after': response.headers.get('retry-after')
        },
        isRateLimited: response.status === 429,
        testId
      }

      if (config.verbose) {
        console.log(`  📝 ${testId}: ${response.status} (${responseTime.toFixed(2)}ms) ${result.isRateLimited ? '[RATE LIMITED]' : ''}`)
        if (result.headers['x-ratelimit-remaining'] !== null) {
          console.log(`     Remaining: ${result.headers['x-ratelimit-remaining']}/${result.headers['x-ratelimit-limit']}`)
        }
      }

      return result
    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      if (config.verbose) {
        console.error(`  ❌ ${testId}: Error - ${error.message}`)
      }

      return {
        status: 'ERROR',
        responseTime,
        error: error.message,
        isRateLimited: false,
        testId
      }
    }
  }

  async testRateLimitEndpoint(endpointName, endpoint, payload, expectedLimit, testVariations = []) {
    console.log(`\n🧪 Testing ${endpointName}`)
    console.log(`📍 Endpoint: ${endpoint}`)
    console.log(`📊 Expected Limit: ${expectedLimit} requests`)
    console.log(`⏱️  Test Type: ${config.testType}`)

    this.results.currentTest = endpointName

    if (config.testType === 'unit') {
      await this.runUnitTest(endpointName, endpoint, payload, expectedLimit)
    } else if (config.testType === 'integration') {
      await this.runIntegrationTest(endpointName, endpoint, payload, expectedLimit)
    } else if (config.testType === 'load') {
      await this.runLoadTest(endpointName, endpoint, payload)
    }

    // Test variations
    for (const variation of testVariations) {
      console.log(`\n🔀 Testing variation: ${variation.name}`)
      await this.runTestVariation(endpointName, endpoint, payload, variation)
    }
  }

  async runUnitTest(endpointName, endpoint, payload, expectedLimit) {
    console.log('\n📋 Unit Test: Sequential requests to test rate limit')

    let rateLimitHit = false
    let successCount = 0
    let rateLimitRequestNumber = null

    for (let i = 1; i <= expectedLimit + 3; i++) {
      const testId = `${endpointName}-unit-${i}`
      const result = await this.makeRequest(endpoint, payload, {
        'X-Forwarded-For': `192.168.1.${100 + (i % 50)}`
      }, testId)

      this.results.total++
      this.results.responseTimes.push(result.responseTime)

      if (result.status === 'ERROR') {
        this.results.errors++
      } else if (result.isRateLimited) {
        this.results.rateLimited++
        rateLimitHit = true
        if (!rateLimitRequestNumber) {
          rateLimitRequestNumber = i
          console.log(`  🚫 Rate limit hit at request ${i}`)

          if (result.headers['retry-after']) {
            console.log(`  ⏳ Retry after: ${result.headers['retry-after']}s`)
          }
        }
      } else {
        this.results.success++
        successCount++
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`\n📈 Unit Test Results:`)
    console.log(`  ✅ Successful requests: ${successCount}`)
    console.log(`  🚫 Rate limited requests: ${this.results.rateLimited}`)
    console.log(`  ❌ Errors: ${this.results.errors}`)
    console.log(`  🎯 Rate limit triggered: ${rateLimitHit ? 'YES' : 'NO'}`)

    if (rateLimitRequestNumber) {
      const expectedAfter = expectedLimit + 1
      const withinRange = rateLimitRequestNumber >= expectedLimit && rateLimitRequestNumber <= expectedAfter + 1
      console.log(`  📊 Rate limit triggered at request: ${rateLimitRequestNumber} (expected around ${expectedAfter}) ${withinRange ? '✅' : '⚠️'}`)
    }

    // Calculate average response time
    const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
    console.log(`  ⏱️  Average response time: ${avgResponseTime.toFixed(2)}ms`)
  }

  async runIntegrationTest(endpointName, endpoint, payload, expectedLimit) {
    console.log('\n🔗 Integration Test: Real-world scenarios')

    const scenarios = [
      {
        name: 'Different IP Addresses',
        description: 'Test that rate limits are per-IP',
        requests: [
          { ip: '192.168.1.100', expected: 'should pass' },
          { ip: '192.168.1.101', expected: 'should pass' },
          { ip: '192.168.1.102', expected: 'should pass' }
        ]
      },
      {
        name: 'Same IP Different Headers',
        description: 'Test rate limit with various header combinations',
        requests: [
          { ip: '10.0.0.1', headers: { 'User-Agent': 'Mozilla/5.0' } },
          { ip: '10.0.0.1', headers: { 'User-Agent': 'Chrome/91.0' } },
          { ip: '10.0.0.1', headers: { 'User-Agent': 'Safari/14.0' } }
        ]
      }
    ]

    for (const scenario of scenarios) {
      console.log(`\n  📋 ${scenario.name}: ${scenario.description}`)

      let scenarioSuccess = 0
      let scenarioRateLimited = 0

      for (const request of scenario.requests) {
        const testId = `${endpointName}-integration-${scenario.name}-${scenarioSuccess + scenarioRateLimited}`
        const result = await this.makeRequest(
          endpoint,
          payload,
          {
            'X-Forwarded-For': request.ip,
            'User-Agent': request.headers?.['User-Agent'] || 'RateLimitTester/1.0'
          },
          testId
        )

        this.results.total++
        this.results.responseTimes.push(result.responseTime)

        if (result.status === 'ERROR') {
          this.results.errors++
        } else if (result.isRateLimited) {
          scenarioRateLimited++
          this.results.rateLimited++
        } else {
          scenarioSuccess++
          this.results.success++
        }

        console.log(`    ${request.expected === 'should pass' ? '✅' : '🚫'} IP ${request.ip}: ${result.status}`)
      }

      console.log(`    📊 Results: ${scenarioSuccess} passed, ${scenarioRateLimited} rate limited`)
    }
  }

  async runLoadTest(endpointName, endpoint, payload) {
    console.log(`\n⚡ Load Test: ${config.concurrent} concurrent requests for ${config.duration}s`)

    const startTime = Date.now()
    const endTime = startTime + (config.duration * 1000)
    let requestCounter = 0

    const makeConcurrentRequests = async () => {
      while (Date.now() < endTime) {
        const testId = `${endpointName}-load-${++requestCounter}`
        const result = await this.makeRequest(
          endpoint,
          payload,
          {
            'X-Forwarded-For': `172.16.0.${requestCounter % 255}`
          },
          testId
        )

        this.results.total++
        this.results.responseTimes.push(result.responseTime)

        if (result.status === 'ERROR') {
          this.results.errors++
        } else if (result.isRateLimited) {
          this.results.rateLimited++

          // Track when rate limits are hit
          this.results.rateLimitHits.push({
            timestamp: Date.now(),
            testId,
            endpoint: endpointName
          })
        } else {
          this.results.success++
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    // Start concurrent workers
    const workers = []
    for (let i = 0; i < config.concurrent; i++) {
      workers.push(makeConcurrentRequests())
    }

    console.log(`  🏃 Started ${config.concurrent} concurrent workers...`)

    await Promise.all(workers)

    const actualDuration = (Date.now() - startTime) / 1000
    const requestsPerSecond = (this.results.total / actualDuration).toFixed(2)

    console.log(`\n⚡ Load Test Results:`)
    console.log(`  📊 Total requests: ${this.results.total}`)
    console.log(`  📈 Requests/second: ${requestsPerSecond}`)
    console.log(`  ✅ Successful: ${this.results.success} (${((this.results.success / this.results.total) * 100).toFixed(1)}%)`)
    console.log(`  🚫 Rate limited: ${this.results.rateLimited} (${((this.results.rateLimited / this.results.total) * 100).toFixed(1)}%)`)
    console.log(`  ❌ Errors: ${this.results.errors} (${((this.results.errors / this.results.total) * 100).toFixed(1)}%)`)

    if (this.results.responseTimes.length > 0) {
      const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
      const maxResponseTime = Math.max(...this.results.responseTimes)
      const minResponseTime = Math.min(...this.results.responseTimes)

      console.log(`  ⏱️  Response times - Avg: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`)
    }

    if (this.results.rateLimitHits.length > 0) {
      console.log(`  🎯 Rate limit tracking: ${this.results.rateLimitHits.length} hits recorded`)
    }
  }

  async runTestVariation(endpointName, endpoint, payload, variation) {
    let successCount = 0
    let rateLimitedCount = 0

    for (let i = 0; i < variation.requests || 5; i++) {
      const testId = `${endpointName}-variation-${variation.name}-${i}`
      const headers = {
        'X-Forwarded-For': variation.ipPattern ? variation.ipPattern(i) : `192.168.2.${100 + i}`
      }

      if (variation.customHeaders) {
        Object.assign(headers, variation.customHeaders)
      }

      const result = await this.makeRequest(endpoint, payload, headers, testId)

      if (result.status !== 'ERROR') {
        if (result.isRateLimited) {
          rateLimitedCount++
        } else {
          successCount++
        }
      }

      await new Promise(resolve => setTimeout(resolve, variation.delay || 100))
    }

    console.log(`    📊 Variation Results: ${successCount} passed, ${rateLimitedCount} rate limited`)
  }

  printSummary() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 FINAL TEST SUMMARY')
    console.log('='.repeat(60))

    console.log(`\n📈 Overall Results:`)
    console.log(`  🔄 Total requests: ${this.results.total}`)
    console.log(`  ✅ Successful: ${this.results.success} (${((this.results.success / this.results.total) * 100).toFixed(1)}%)`)
    console.log(`  🚫 Rate limited: ${this.results.rateLimited} (${((this.results.rateLimited / this.results.total) * 100).toFixed(1)}%)`)
    console.log(`  ❌ Errors: ${this.results.errors} (${((this.results.errors / this.results.total) * 100).toFixed(1)}%)`)

    if (this.results.responseTimes.length > 0) {
      const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
      const p95ResponseTime = this.results.responseTimes.sort((a, b) => a - b)[Math.floor(this.results.responseTimes.length * 0.95)]

      console.log(`\n⏱️  Performance Metrics:`)
      console.log(`  📊 Average response time: ${avgResponseTime.toFixed(2)}ms`)
      console.log(`  📊 95th percentile: ${p95ResponseTime.toFixed(2)}ms`)
    }

    console.log(`\n🔍 Test Configuration:`)
    console.log(`  🌐 Base URL: ${config.baseUrl}`)
    console.log(`  🧪 Test Type: ${config.testType}`)
    console.log(`  🔢 Concurrent Requests: ${config.concurrent}`)
    console.log(`  ⏱️  Test Duration: ${config.duration}s`)

    console.log('\n💡 Recommendations:')
    if (this.results.rateLimited === 0) {
      console.log('  ⚠️  No rate limits were triggered. Check if Redis is properly configured.')
    } else if (this.results.rateLimited / this.results.total > 0.5) {
      console.log('  ⚠️  High rate limit hit ratio. Consider increasing limits if this affects legitimate users.')
    } else {
      console.log('  ✅ Rate limiting appears to be working correctly.')
    }

    if (this.results.errors / this.results.total > 0.1) {
      console.log('  ❌ High error rate. Check server health and network connectivity.')
    }

    if (this.results.responseTimes.length > 0) {
      const avgTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
      if (avgTime > 1000) {
        console.log('  ⚠️  High response times detected. Check server performance and Redis latency.')
      }
    }
  }
}

async function runTests() {
  const tester = new RateLimitTester()

  console.log('🔒 Redis Rate Limiting Test Suite')
  console.log('='.repeat(60))
  console.log(`📍 Testing: ${config.baseUrl}`)
  console.log(`🧪 Test Type: ${config.testType}`)
  console.log(`⏱️  Started: ${new Date().toISOString()}`)

  try {
    // Test 1: Authentication endpoints
    await tester.testRateLimitEndpoint(
      'Authentication',
      '/api/auth/reset-password',
      { email: 'test@example.com' },
      5, // 5 requests per 15 minutes
      [
        {
          name: 'Multiple IPs',
          requests: 10,
          ipPattern: (i) => `10.1.${Math.floor(i / 254)}.${i % 254 + 1}`,
          delay: 50
        }
      ]
    )

    // Test 2: Admin endpoints
    await tester.testRateLimitEndpoint(
      'Admin Login',
      '/api/admin-auth/login',
      {
        email: 'admin@test.com',
        password: 'wrongpassword',
        portalKey: 'wrongkey'
      },
      10, // 10 requests per 15 minutes
      [
        {
          name: 'Different User Agents',
          requests: 8,
          customHeaders: {
            'User-Agent': 'Mozilla/5.0 (Test Suite) RateLimitTest/1.0'
          },
          delay: 200
        }
      ]
    )

    // Test 3: Letter generation (will fail auth but should still hit rate limit)
    await tester.testRateLimitEndpoint(
      'Letter Generation',
      '/api/generate-letter',
      {
        letterType: 'Demand Letter',
        intakeData: {
          senderName: 'Test Sender',
          senderAddress: '123 Test St',
          recipientName: 'Test Recipient',
          recipientAddress: '456 Test Ave',
          issueDescription: 'Test issue description for rate limiting',
          desiredOutcome: 'Test desired outcome'
        }
      },
      5, // 5 requests per hour
      [
        {
          name: 'Rapid Bursts',
          requests: 7,
          delay: 10
        }
      ]
    )

    // Test 4: General API endpoint
    await tester.testRateLimitEndpoint(
      'API Health Check',
      '/api/health',
      {},
      100, // 100 requests per minute
      [
        {
          name: 'High Frequency',
          requests: 50,
          delay: 10
        }
      ]
    )

    tester.printSummary()

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message)
    if (config.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
}

module.exports = { RateLimitTester, runTests }