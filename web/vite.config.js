import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import JavaScriptObfuscator from 'javascript-obfuscator'

const obfuscate = process.env.OBFUSCATE === '1'

const BANNER = `<!--
  this is a page by blxr

  ${
    obfuscate
      ? `

  the app bundle also went through an obfuscator, which is why roughly 68 KB
  of source arrives as most of half a megabyte of control-flow spaghetti.`
      : ''
  }

  none of that is encryption. there is no such thing here — the browser has
  to read this file to render it, so whoever is holding the browser can read
  it too. it's inconvenient, not protected. inconvenient was the entire
  ambition.

  so pretty-print it, take it, keep it. just change the colours first.
  it's embarrassing when you don't.
-->`

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  simplify: true,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  stringArrayWrappersCount: 3,
  stringArrayWrappersType: 'function',
  transformObjectKeys: true,
  target: 'browser',
}

const compactOnlyOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: false,
  transformObjectKeys: false,
  renameGlobals: false,
  identifierNamesGenerator: 'mangled',
  target: 'browser',
}

function htmlPolishPlugin() {
  return {
    name: 'polish-index-html',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const out = html

          .replace(
            /<script>([\s\S]*?)<\/script>/g,
            (_m, code) =>
              `<script>${JavaScriptObfuscator.obfuscate(code, compactOnlyOptions).getObfuscatedCode()}</script>`,
          )

          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/>\s+</g, '><')
          .trim()
        return out.replace(/(<!doctype html>)/i, `$1\n${BANNER}\n`)
      },
    },
  }
}

function obfuscatorPlugin() {
  return {
    name: 'obfuscate-app-chunk',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {

        if (chunk.type !== 'chunk' || !fileName.includes('app-')) continue
        chunk.code = JavaScriptObfuscator.obfuscate(
          chunk.code,
          obfuscatorOptions,
        ).getObfuscatedCode()
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    htmlPolishPlugin(),
    ...(obfuscate ? [obfuscatorPlugin()] : []),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {

        advancedChunks: {
          groups: [

            { name: 'gsap', test: /[\\/]node_modules[\\/]gsap[\\/]/ },
            { name: 'vendor', test: /node_modules/ },

            {
              name: 'app',
              test: /[\\/]src[\\/](?!lib[\\/]locales[\\/]|components[\\/](music-widget|command-palette\.jsx))/,
            },
          ],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
