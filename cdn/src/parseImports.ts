import * as ts from 'typescript';

export default function parseImports(contents: string): string[] {
  const paths: string[] = [];

  function findChildImports(node: ts.Node): void {
    if (
      node.kind === ts.SyntaxKind.ImportDeclaration ||
      (node.kind === ts.SyntaxKind.ExportDeclaration &&
        (node as ts.ExportDeclaration).moduleSpecifier)
    ) {
      paths.push((node as any).moduleSpecifier.text);
    } else if (
      node.kind === ts.SyntaxKind.CallExpression &&
      (node as ts.CallExpression).arguments &&
      (node as ts.CallExpression).arguments.length
    ) {
      const callExpr = node as ts.CallExpression;
      if (
        callExpr.expression.kind === ts.SyntaxKind.Identifier &&
        (callExpr.expression as ts.Identifier).text === 'require'
      ) {
        const arg = callExpr.arguments[0];
        if (arg.kind === ts.SyntaxKind.StringLiteral) {
          paths.push((arg as ts.StringLiteral).text);
        }
      }

      if (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = callExpr.arguments[0];
        if (arg.kind === ts.SyntaxKind.StringLiteral) {
          paths.push((arg as ts.StringLiteral).text);
        }
      }

      if (
        (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (callExpr.expression as ts.Identifier).text === 'require') &&
        callExpr.arguments[0].kind === ts.SyntaxKind.TemplateExpression
      ) {
        const template = callExpr.arguments[0] as ts.TemplateExpression;
        if (template.head.kind === ts.SyntaxKind.TemplateHead) {
          paths.push(template.head.text);
        }
      }

      if (
        (callExpr.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (callExpr.expression as ts.Identifier).text === 'require') &&
        callExpr.arguments[0].kind === ts.SyntaxKind.BinaryExpression
      ) {
        const binary = callExpr.arguments[0] as ts.BinaryExpression;
        if (binary.left.kind === ts.SyntaxKind.StringLiteral) {
          paths.push((binary.left as ts.StringLiteral).text);
        }
      }
    }
    ts.forEachChild(node, findChildImports);
  }

  ts.forEachChild(
    ts.createSourceFile(
      'any',
      contents,
      ts.ScriptTarget.ES2015,
      true,
      ts.ScriptKind.JSX,
    ),
    findChildImports,
  );

  return paths;
}
