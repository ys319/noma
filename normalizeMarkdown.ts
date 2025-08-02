import type { Code, Root } from "npm:@types/mdast"
import remarkParse from "npm:remark-parse"
import remarkStringify, { Options as RemarkStringifyOptions } from "npm:remark-stringify"
import { unified, type Plugin } from "npm:unified"
import { visit } from "npm:unist-util-visit"

const stringifyOptions = {
  bullet: "-",
  listItemIndent: "one",
  tightDefinitions: true,
  rule: "-",
} satisfies RemarkStringifyOptions

const baseProcessor = unified()
  .use(remarkParse)
  .use(remarkStringify, stringifyOptions)

const remarkRecursiveFormat: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "code", (node: Code) => {

      // Markdown only.
      const isMarkdown = node.lang === "markdown" || node.lang === "md"
      if (!isMarkdown) {
        return
      }

      try {
        // `baseProcessor`を使い、同期的にネストされたMarkdownをフォーマットする
        const file = baseProcessor.processSync(node.value)
        // 末尾の不要な改行を削除して上書きする
        node.value = file.toString().trim()
      } catch (e) {
        // ネストされたMarkdownのパースに失敗しても、全体の処理は続行させる
        const message = e instanceof Error ? e.message : "Unknown error"
        console.error(`Failed to process nested markdown: ${message}`)
      }
    })
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkRecursiveFormat)
  .use(remarkStringify, stringifyOptions)

export const normalizeMarkdown = async (
  markdownText: string,
): Promise<string> => {

  if (markdownText === "") {
    return ""
  }

  const file = await processor.process(markdownText)
  return file.toString()
}
