// Carrega módulos TypeScript do projeto em memória, sem build e sem instalar nada.
// Usa o `typescript` já instalado em node_modules para transpilar para CJS.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const nodeRequire = createRequire(import.meta.url)
const cache = new Map()

export function loadTs(relPath) {
  const file = resolve(projectRoot, relPath)
  if (cache.has(file)) return cache.get(file).exports

  const source = readFileSync(file, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  })

  const mod = { exports: {} }
  cache.set(file, mod)

  // Resolve o alias "@/..." para src/ e delega o resto ao node_modules do projeto.
  const requireShim = (request) => {
    if (request.startsWith('@/')) {
      const target = `src/${request.slice(2)}`
      const withExt = /\.[cm]?[jt]sx?$/.test(target) ? target : `${target}.ts`
      return loadTs(withExt)
    }
    return nodeRequire(request)
  }

  new Function('require', 'module', 'exports', outputText)(requireShim, mod, mod.exports)
  return mod.exports
}
