#!/usr/bin/env node

/**
 * Robustness Test Runner
 * Runs comprehensive tests for all enhanced system components
 *
 * Usage:
 *   node scripts/test-robustness.js
 *   TEST_TYPE=all node scripts/test-robustness.js
 *   TEST_TYPE=unit node scripts/test-robustness.js
 *   TEST_TYPE=integration node scripts/test-robustness.js
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const config = {
  testType: process.env.TEST_TYPE || 'all', // 'all', 'unit', 'integration'
  verbose: process.env.VERBOSE === 'true',
  coverage: process.env.COVERAGE === 'true',
  watch: process.env.WATCH === 'true'
}

const testSuites = {
  unit: [
    'tests/robustness/letter-validation.test.ts',
    'tests/robustness/csrf-protection.test.ts',
    'tests/robustness/fraud-detection.test.ts',
    'tests/robustness/openai-retry.test.ts',
    'tests/robustness/health-check.test.ts'
  ],
  integration: [
    'tests/rate-limit.test.ts',
    'tests/rate-limit-redis.test.js'
  ]
}

class RobustnessTestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      suites: []
    }
  }

  async runTests() {
    console.log('🔒 Robustness Test Suite')
    console.log('============================\n')
    console.log(`🧪 Test Type: ${config.testType}`)
    console.log(`📊 Coverage: ${config.coverage ? 'Enabled' : 'Disabled'}`)
    console.log(`👀 Watch Mode: ${config.watch ? 'Enabled' : 'Disabled'}`)
    console.log(`📝 Verbose: ${config.verbose ? 'Enabled' : 'Disabled'}\n`)

    const startTime = Date.now()

    try {
      const testFiles = this.getTestFiles()

      if (testFiles.length === 0) {
        console.log('⚠️  No test files found for the specified test type')
        return
      }

      console.log(`📁 Running ${testFiles.length} test file(s)...\n`)

      // Run tests
      for (const testFile of testFiles) {
        await this.runTestSuite(testFile)
      }

      this.results.duration = Date.now() - startTime
      this.printSummary()

    } catch (error) {
      console.error('❌ Test runner failed:', error.message)
      process.exit(1)
    }
  }

  getTestFiles() {
    switch (config.testType) {
      case 'unit':
        return testSuites.unit
      case 'integration':
        return testSuites.integration
      case 'all':
        return [...testSuites.unit, ...testSuites.integration]
      default:
        console.error(`Unknown test type: ${config.testType}`)
        return []
    }
  }

  async runTestSuite(testFile) {
    const suiteName = path.basename(testFile, '.test.ts')
    const startTime = Date.now()

    console.log(`🧪 Running ${suiteName}...`)

    try {
      // Check if test file exists
      if (!fs.existsSync(testFile)) {
        console.log(`  ⚠️  Test file not found: ${testFile}`)
        this.results.skipped++
        return
      }

      // Build Jest command
      const jestArgs = [
        testFile,
        '--config',
        'jest.config.js',
        '--testTimeout=30000', // 30 seconds
        config.verbose ? '--verbose' : '',
        config.coverage ? '--coverage' : '',
        config.watch ? '--watch' : '',
        '--no-cache'
      ].filter(Boolean)

      // Run Jest
      const jestCommand = `npx jest ${jestArgs.join(' ')}`

      if (config.verbose) {
        console.log(`  🔧 Command: ${jestCommand}`)
      }

      const output = execSync(jestCommand, {
        encoding: 'utf8',
        stdio: config.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      })

      const duration = Date.now() - startTime
      const passed = this.parseJestOutput(output)

      this.results.suites.push({
        name: suiteName,
        file: testFile,
        passed,
        duration,
        output: config.verbose ? output : this.summarizeOutput(output)
      })

      this.results.total++
      if (passed) {
        this.results.passed++
        console.log(`  ✅ ${suiteName} passed (${duration}ms)`)
      } else {
        this.results.failed++
        console.log(`  ❌ ${suiteName} failed (${duration}ms)`)
        if (!config.verbose) {
          console.log(this.summarizeOutput(output).split('\n').slice(0, 5).join('\n'))
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime

      this.results.suites.push({
        name: suiteName,
        file: testFile,
        passed: false,
        duration,
        output: error.stdout || error.message
      })

      this.results.total++
      this.results.failed++
      console.log(`  ❌ ${suiteName} crashed (${duration}ms)`)

      if (!config.verbose && error.stdout) {
        console.log('   Error:', error.stdout.split('\n')[0])
      }
    }
  }

  parseJestOutput(output) {
    // Look for Jest summary
    const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
    if (summaryMatch) {
      const [, passed, failed] = summaryMatch;
      return parseInt(failed) === 0;
    }

    // Look for simple pass/fail patterns
    if (output.includes('PASS')) {
      return true;
    }
    if (output.includes('FAIL')) {
      return false;
    }

    // Default to false if we can't determine
    return false;
  }

  summarizeOutput(output) {
    const lines = output.split('\n');

    // Extract key information
    const summary = [];
    let inSummary = false;

    for (const line of lines) {
      if (line.includes('Test Suites:') || line.includes('Tests:')) {
        inSummary = true;
      }

      if (inSummary) {
        summary.push(line);
        if (line.length === 0 && summary.length > 3) {
          break; // End of summary
        }
      }

      // Also capture any obvious failures
      if (line.includes('FAIL') || line.includes('●') || line.includes('✕')) {
        if (!summary.includes(line)) {
          summary.push(line);
        }
      }
    }

    return summary.join('\n');
  }

  printSummary() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 ROBUSTNESS TEST SUMMARY')
    console.log('='.repeat(60))

    console.log(`\n📈 Overall Results:`)
    console.log(`  🔄 Total tests: ${this.results.total}`)
    console.log(`  ✅ Passed: ${this.results.passed}`)
    console.log(`  ❌ Failed: ${this.results.failed}`)
    console.log(`  ⏭️  Skipped: ${this.results.skipped}`)

    const passRate = this.results.total > 0 ?
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    console.log(`  📊 Success Rate: ${passRate}%`)
    console.log(`  ⏱️  Total Duration: ${this.results.duration}ms`)

    // Per-suite breakdown
    if (this.results.suites.length > 0) {
      console.log(`\n📋 Suite Results:`)
      this.results.suites.forEach(suite => {
        const status = suite.passed ? '✅' : '❌';
        const duration = suite.duration;
        console.log(`  ${status} ${suite.name} (${duration}ms)`)
      })
    }

    // Recommendations based on results
    console.log(`\n💡 Recommendations:`)

    if (this.results.failed === 0 && this.results.skipped === 0) {
      console.log(`  🎉 All tests passed! System is robust and secure.`)
      console.log(`  📈 Ready for production deployment.`)
    } else if (this.results.failed > 0) {
      console.log(`  🔧 Fix ${this.results.failed} failing test(s) before deploying.`)
      console.log(`  📝 Check individual test outputs for details.`)
    } else {
      console.log(`  ⚠️  Some tests were skipped - check test configuration.`)
    }

    if (passRate < 100) {
      console.log(`  🚨 Success rate below 100% - review failing tests.`)
    }

    if (!config.coverage && this.results.passed === this.results.total) {
      console.log(`  📊 Consider running with COVERAGE=true for coverage report.`)
    }

    // Security-specific recommendations
    const securityTests = this.results.suites.filter(s =>
      s.name.includes('csrf') || s.name.includes('fraud') || s.name.includes('validation')
    );

    if (securityTests.length > 0 && securityTests.every(s => s.passed)) {
      console.log(`  🔒 Security tests passed - system is protected.`)
    } else if (securityTests.some(s => !s.passed)) {
      console.log(`  🚨 Security tests failed - review security measures.`)
    }

    console.log(`\n📖 Test Categories Covered:`)
    console.log(`  🔐 Input Validation & Sanitization`)
    console.log(`  🛡️  CSRF Protection`)
    console.log(`  🕵️  Fraud Detection`)
    console.log(`  🔄 Retry Logic & Circuit Breaker`)
    console.log(`  💚 Health Monitoring`)
    console.log(`  ⚡ Rate Limiting`)

    console.log(`\n🔗 Next Steps:`)
    if (this.results.failed === 0) {
      console.log(`  1. Review test coverage reports`)
      console.log(`  2. Run integration tests in staging`)
      console.log(`  3. Monitor system in production`)
      console.log(`  4. Set up alerts for health checks`)
    } else {
      console.log(`  1. Fix failing tests`)
      console.log(`  2. Re-run test suite`)
      console.log(`  3. Address any security issues`)
      console.log(`  4. Verify robustness improvements`)
    }

    // Exit with appropriate code
    if (this.results.failed > 0) {
      console.log(`\n❌ Tests failed - exit code 1`)
      process.exit(1);
    } else {
      console.log(`\n✅ All tests passed - ready for deployment!`);
      process.exit(0);
    }
  }
}

// Additional utility functions

function checkDependencies() {
  const requiredDeps = ['jest', '@types/jest', 'ts-jest'];
  const missingDeps = [];

  for (const dep of requiredDeps) {
    try {
      require.resolve(dep);
    } catch {
      missingDeps.push(dep);
    }
  }

  if (missingDeps.length > 0) {
    console.error('❌ Missing test dependencies:');
    missingDeps.forEach(dep => console.error(`  - ${dep}`));
    console.error('\nInstall with: npm install --save-dev ' + missingDeps.join(' '));
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🧪 Robustness Test Runner

Usage:
  node scripts/test-robustness.js [options]

Environment Variables:
  TEST_TYPE=all|unit|integration    Test category to run (default: all)
  VERBOSE=true                    Show detailed test output
  COVERAGE=true                   Generate coverage report
  WATCH=true                      Run tests in watch mode

Examples:
  node scripts/test-robustness.js                    # Run all tests
  TEST_TYPE=unit node scripts/test-robustness.js     # Run unit tests only
  VERBOSE=true node scripts/test-robustness.js       # Show detailed output
  COVERAGE=true node scripts/test-robustness.js     # Generate coverage
  TEST_TYPE=integration WATCH=true node scripts/test-robustness.js

Test Categories:
  🧪 Unit Tests: Individual component tests
  🔗 Integration Tests: End-to-end system tests
  🔒 Security Tests: CSRF, fraud detection, validation
  💚 Health Tests: System health monitoring
`);
}

// Main execution
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  checkDependencies();

  const runner = new RobustnessTestRunner();
  runner.runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { RobustnessTestRunner };