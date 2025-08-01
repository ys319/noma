import { normalizeMarkdown } from './normalizeMarkdown.ts'

/**
 * このCLIツールの使用方法を示すヘルプメッセージ。
 */
const HELP_MESSAGE = `
Usage:
  deno run --allow-read --allow-write cli.ts [options] <file>

Description:
  Formats a Markdown file according to a defined set of rules.

Options:
  -w, --write    Write the result back to the source file instead of stdout.
  -h, --help     Show this help message.
`

/**
 * エラーメッセージを標準エラー出力に表示し、プログラムを終了します。
 * @param message - 表示するエラーメッセージ。
 */
const die = (message: string): never => {
  console.error(message)
  Deno.exit(1)
}

/**
 * コマンドライン引数を解析し、オプションとファイルパスを抽出します。
 * @param args - Deno.argsから受け取った引数の配列。
 * @returns オプションとファイルパスを含むオブジェクト。
 */
const parseArgs = (args: string[]) => {
  const shouldWrite = args.includes('--write') || args.includes('-w')
  const showHelp = args.includes('--help') || args.includes('-h')
  const filePath = args.find((arg) => !arg.startsWith('-'))

  return { shouldWrite, showHelp, filePath }
}

/**
 * メインロジックを実行する非同期関数。
 */
const main = async () => {
  const { shouldWrite, showHelp, filePath } = parseArgs(Deno.args)

  if (showHelp || Deno.args.length === 0) {
    console.log(HELP_MESSAGE)
    return
  }

  if (filePath === undefined) {
    die('Error: No file path provided.\n' + HELP_MESSAGE)
    return
  }

  let sourceText: string
  try {
    sourceText = await Deno.readTextFile(filePath)
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      die(`Error: File not found at "${filePath}"`)
    } else if (error instanceof Deno.errors.PermissionDenied) {
      die(`Error: Permission denied to read file at "${filePath}"`)
    }
    // 不明なエラーはスタックトレースを含めてスローする
    throw error
  }

  const normalizedText = await normalizeMarkdown(sourceText)

  if (shouldWrite) {
    try {
      await Deno.writeTextFile(filePath, normalizedText)
      console.log(`Formatted ${filePath}`)
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        die(`Error: Permission denied to write to file at "${filePath}"`)
      }
      throw error
    }
  } else {
    console.log(normalizedText)
  }
}

// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.main) {
  await main()
}
