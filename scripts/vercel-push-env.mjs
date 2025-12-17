#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import dotenv from 'dotenv'

function parseDotenvKeys(dotenvText) {
  return dotenvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=')
      if (idx === -1) return null
      return line.slice(0, idx).trim()
    })
    .filter(Boolean)
}

function usageAndExit(code = 1) {
  console.error('Usage: node scripts/vercel-push-env.mjs [--targets production,preview] [--dotenv .env.local]')
  process.exit(code)
}

function parseArgs(argv) {
  const args = { targets: ['production'], dotenvPath: '.env.local' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--targets') {
      const v = argv[++i]
      if (!v) usageAndExit(1)
      args.targets = v.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (a === '--dotenv') {
      const v = argv[++i]
      if (!v) usageAndExit(1)
      args.dotenvPath = v
    } else if (a === '--help' || a === '-h') {
      usageAndExit(0)
    } else {
      console.error(`Unknown arg: ${a}`)
      usageAndExit(1)
    }
  }
  return args
}

async function run() {
  const { targets, dotenvPath } = parseArgs(process.argv)

  const examplePath = path.resolve(process.cwd(), '.env.example')
  if (!fs.existsSync(examplePath)) {
    throw new Error('Missing .env.example (used as allowlist)')
  }

  const localPath = path.resolve(process.cwd(), dotenvPath)
  if (!fs.existsSync(localPath)) {
    throw new Error(`Missing ${dotenvPath}. Create it locally (not committed) before pushing envs.`)
  }

  const allowlist = new Set(parseDotenvKeys(fs.readFileSync(examplePath, 'utf8')))
  const parsed = dotenv.parse(fs.readFileSync(localPath, 'utf8'))

  const toPush = []
  const missing = []

  for (const key of allowlist) {
    const value = parsed[key]
    if (typeof value === 'string' && value.length > 0) {
      toPush.push({ key, value })
    } else {
      missing.push(key)
    }
  }

  // Safety checks for common typos: warn only (no values).
  if (!parsed.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && parsed.NEXT_STRIPE_PUBLISHABLE_KEY) {
    console.warn('[warn] Found NEXT_STRIPE_PUBLISHABLE_KEY but missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    console.warn('       Vercel/Next should use NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (public)')
  }
  if (parsed.NEXT_PUBLIC_APP_URL && parsed.NEXT_PUBLIC_APP_URL.includes('https//:')) {
    console.warn('[warn] NEXT_PUBLIC_APP_URL looks malformed (contains "https//:")')
  }

  console.log(`Will push ${toPush.length} env vars to Vercel targets: ${targets.join(', ')}`)
  if (missing.length) {
    console.log(`Skipping ${missing.length} allowlisted keys missing in ${dotenvPath}:`)
    for (const k of missing.sort()) console.log(`  - ${k}`)
  }

  for (const target of targets) {
    for (const { key, value } of toPush) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          'pnpm',
          ['dlx', 'vercel', 'env', 'add', key, target, '--force'],
          {
            stdio: ['pipe', 'inherit', 'inherit'],
            env: process.env,
          }
        )

        child.on('error', reject)
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Failed: vercel env add ${key} ${target} (exit ${code})`))
        })

        // IMPORTANT: do not log the value.
        child.stdin.write(`${value}\n`)
        child.stdin.end()
      })
    }
  }

  console.log('Done pushing env vars to Vercel.')
}

run().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
