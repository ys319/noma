import type { Code, Root } from 'npm:@types/mdast'
import remarkParse from 'npm:remark-parse'
import remarkStringify from 'npm:remark-stringify'
import { unified, type Plugin } from 'npm:unified'
import { visit } from 'npm:unist-util-visit'

/**
 * remark-stringify に渡す共通のオプション設定。
 * @remarks
 * プロセッサ間で設定を共有し、出力スタイルの一貫性を保つために定数として定義しています。
 */
const stringifyOptions = {
  // 箇条書きリストのマーカーをハイフン('-')に統一します。
  bullet: '-',
  // ネストされたリストのインデントを、親のマーカー幅 + 1スペースに設定します。
  listItemIndent: 'one',
  // リストアイテム間の不要な空行を削除します。
  tightDefinitions: true,
  // 水平線のマーカーをハイフン3つに統一します。
  rule: '-',
} as const

/**
 * Markdownのパースと文字列化のみを行う、再帰処理を含まない基本的なプロセッサ。
 * @remarks
 * このプロセッサは、ネストされたコードブロックの内容をフォーマットするために、
 * `remarkRecursiveFormat` プラグインから安全に呼び出されます。
 */
const baseProcessor = unified()
  .use(remarkParse)
  .use(remarkStringify, stringifyOptions)

/**
 * unifiedプラグイン。MarkdownのASTを走査し、'markdown'または'md'と指定された
 * コードブロックの内容を再帰的にフォーマットします。
 * @remarks
 * ASTから対象のコードブロックを探索するために`unist-util-visit`を利用します。
 * 無限再帰を避けるため、コードブロック内のフォーマット処理には、このプラグイン自身を
 * 含まない`baseProcessor`が使用されます。
 */
const remarkRecursiveFormat: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      const isFormatTarget =
        (node.lang === 'markdown' || node.lang === 'md') && node.value
      if (!isFormatTarget) {
        return
      }

      try {
        // `baseProcessor`を使い、同期的にネストされたMarkdownをフォーマットする
        const file = baseProcessor.processSync(node.value)
        // 末尾の不要な改行を削除して上書きする
        node.value = file.toString().trim()
      } catch (e) {
        // ネストされたMarkdownのパースに失敗しても、全体の処理は続行させる
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error(`Failed to process nested markdown: ${message}`)
      }
    })
  }
}

/**
 * 最終的に利用されるRemarkプロセッサーのシングルトンインスタンス。
 * @remarks
 * 初期化コストを避けるため、プロセッサーはモジュールスコープで一度だけ生成されます。
 * `remarkRecursiveFormat` プラグインを含むことで、コードブロック内のMarkdownも
 * 対象としたフォーマットを実現します。
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkRecursiveFormat)
  .use(remarkStringify, stringifyOptions)

/**
 * Markdown文字列を受け取り、定義されたルールセットに基づいて正規化します。
 * この関数は、コードブロック内に含まれるMarkdownも再帰的にフォーマットします。
 *
 * @remarks
 * 処理は非同期で行われ、正規化されたMarkdown文字列を含むPromiseを返します。
 * 呼び出し元は、`null`や`undefined`でない有効な文字列を渡す責任を負います。
 *
 * @param markdownText - 正規化対象のMarkdown文字列。
 * @returns 正規化されたMarkdown文字列を解決するPromise。
 *
 * @example
 * ```typescript
 * const source = `
 * # メイン タイトル
 *
 * * list item 1
 * * list item 2
 *
 * \`\`\`markdown
 * # ネストされたタイトル
 *
 * 1. nested item 1
 *
 * * nested item 2
 * \`\`\`
 * `;
 *
 * const normalized = await normalizeMarkdown(source);
 *
 * // 出力:
 * // # メイン タイトル
 * //
 * // -   list item 1
 * // -   list item 2
 * //
 * // \`\`\`markdown
 * // # ネストされたタイトル
 * //
 * // 1.  nested item 1
 * //
 * // -   nested item 2
 * // \`\`\`
 * ```
 */
export const normalizeMarkdown = async (
  markdownText: string,
): Promise<string> => {
  // `markdownText`が空文字列の場合は早期リターンし、不要な処理を回避する。
  if (markdownText === '') {
    return ''
  }

  const file = await processor.process(markdownText)
  return file.toString()
}
