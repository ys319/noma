import { readAll } from "jsr:@std/io"
import { normalizeMarkdown } from './normalizeMarkdown.ts'

/**
 * このCLIツールの使用方法を示すヘルプメッセージ。
 */
const HELP_MESSAGE = `
Usage:
  deno run --allow-read --allow-write cli.ts [options] [file]
  cat README.md | deno run --allow-read --allow-write cli.ts [options]

Description:
  Formats a Markdown file from a file or stdin according to a defined set of rules.

Options:
  -w, --write    Write the result back to the source file instead of stdout.
                 (Cannot be used with stdin)
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
 * @remarks
 * '-'で始まらない最初の引数をファイルパスとして解釈します。
 * @param args - Deno.argsから受け取った引数の配列。
 * @returns オプションとファイルパス（存在する場合）を含むオブジェクト。
 */
const parseArgs = (args: string[]) => {
  const shouldWrite = args.includes('--write') || args.includes('-w')
  const showHelp = args.includes('--help') || args.includes('-h')
  const filePath = args.find((arg) => !arg.startsWith('-'))

  return { shouldWrite, showHelp, filePath }
}

/**
 * 入力ソース（ファイルまたは標準入力）からテキストを取得します。
 * @param filePath - 読み込むファイルのパス。undefinedの場合は標準入力から読み込む。
 * @returns 読み込まれたテキストを解決するPromise。
 * @throws {Deno.errors.NotFound} ファイルが見つからない場合。
 * @throws {Deno.errors.PermissionDenied} ファイルの読み取り権限がない場合。
 */
const getSourceText = async (filePath: string | undefined): Promise<string> => {
  if (filePath === undefined) {
    const stdinContent = await readAll(Deno.stdin)
    return new TextDecoder().decode(stdinContent)
  }
  return Deno.readTextFile(filePath)
}

/**
 * 整形されたテキストを出力先（標準出力またはファイル）に書き込みます。
 * @param text - 書き込むテキスト。
 * @param filePath - 書き込み先のファイルパス。undefinedの場合は標準出力に書き込む。
 * @param shouldWrite - ファイルに書き込むかどうかを示すフラグ。
 * @throws {Deno.errors.PermissionDenied} ファイルの書き込み権限がない場合。
 */
const handleOutput = async (
  text: string,
  filePath: string | undefined,
  shouldWrite: boolean,
): Promise<void> => {
  if (shouldWrite && filePath) {
    await Deno.writeTextFile(filePath, text)
    console.log(`Formatted ${filePath}`)
  } else {
    console.log(text)
  }
}

/**
 * メインロジックを実行する非同期関数。
 */
const main = async () => {
  const { shouldWrite, showHelp, filePath } = parseArgs(Deno.args)

  // ヘルプ表示の条件: --helpフラグがあるか、
  // または引数がなく、かつパイプ経由の入力でもない（TTYである）場合
  if (showHelp || (Deno.args.length === 0 && Deno.stdin.isTerminal())) {
    console.log(HELP_MESSAGE)
    return
  }

  // 標準入力からの入力時に--writeオプションは使用できない
  if (shouldWrite && filePath === undefined) {
    die('Error: --write option cannot be used with stdin.\n' + HELP_MESSAGE)
  }

  try {
    const sourceText = await getSourceText(filePath)
    const normalizedText = await normalizeMarkdown(sourceText)
    await handleOutput(normalizedText, filePath, shouldWrite)
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      die(`Error: File not found at "${filePath ?? ''}"`)
    } else if (e instanceof Deno.errors.PermissionDenied) {
      die(`Error: Permission denied for "${filePath ?? 'stdin/stdout'}"`)
    } else if (e instanceof Error) {
      // die関数を使って想定外のエラーを一貫して処理する
      // スタックトレースを含めることで、より詳細なデバッグ情報を提供する
      die(`An unexpected error occurred:\n${e.stack ?? e.message}`)
    } else {
      // Errorインスタンスではない、未知の型のエラーを処理する
      die(`An unknown error occurred: ${String(e)}`)
    }
  }
}

// スクリプトが直接実行された場合にmain関数を呼び出す
if (import.meta.main) {
  await main()
}
