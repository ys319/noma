import remarkParse from 'npm:remark-parse'
import remarkStringify from 'npm:remark-stringify'
import { unified } from 'npm:unified'

/**
 * Remarkプロセッサーのシングルトンインスタンス。
 * @remarks
 * 初期化コストを避けるため、プロセッサーはモジュールスコープで一度だけ生成されます。
 * オプション設定により、Markdownの出力スタイルを統一しています。
 */
const processor = unified()
    .use(remarkParse)
    .use(remarkStringify, {
        // 箇条書きリストのマーカーをハイフン('-')に統一します。
        bullet: '-',

        // ネストされたリストのインデントを、親のマーカー幅 + 1スペースに設定します。
        // これにより、構造が視覚的に分かりやすくなります。
        listItemIndent: 'one',

        // リストアイテム間の不要な空行を削除します。
        tightDefinitions: true,

        // 水平線のマーカーをハイフン3つに統一します。
        rule: '-',
    })

/**
 * Markdown文字列を受け取り、定義されたルールセットに基づいて正規化します。
 *
 * @remarks
 * この関数は、さまざまなスタイルで書かれたMarkdownを一貫性のある形式に整えることを目的としています。
 * 主な正規化ルールは以下の通りです。
 * - 箇条書きリストのマーカーは常に `-` を使用します。
 * - ネストされたリストのインデントは、多くのMarkdown方言と互換性のあるスタイルに統一されます。
 * - 行末のスペース2つによる改行は、バックスラッシュ(`\`)を用いた改行に変換されます。
 *
 * 処理は非同期で行われ、正規化されたMarkdown文字列を含むPromiseを返します。
 *
 * @param markdownText - 正規化対象のMarkdown文字列。
 * @returns 正規化されたMarkdown文字列を解決するPromise。入力が`undefined`または`null`の場合は空文字列を返します。
 *
 * @example
 * ```typescript
 * const source = `
 * * 1つ目の項目
 * 1. ネスト1
 * 2. ネスト2
 *
 * * 2つ目の項目
 *
 * 1) 順序付きリスト
 *
 * これは一行目です。  
 * これは二行目です。
 * `;
 *
 * const normalized = await normalizeMarkdown(source);
 *
 * // 出力:
 * // - 1つ目の項目
 * //   1.  ネスト1
 * //   2.  ネスト2
 * // - 2つ目の項目
 * // 1.  順序付きリスト
 * //
 * // これは一行目です。\
 * // これは二行目です。
 * ```
 */
export const normalizeMarkdown = async (
    markdownText: string,
): Promise<string> => {
    // 早期リターンにより、不要な処理を回避します。
    if (markdownText === undefined || markdownText === null) {
        return ''
    }

    const file = await processor.process(markdownText)
    return file.toString()
}
