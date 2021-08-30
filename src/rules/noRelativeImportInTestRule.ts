import {Rule} from 'eslint';
import * as ts from 'typescript';
import * as ESTree from 'estree';

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbids test (non-declaration) files to use relative imports.',
      category: 'Functionality'
    },
    messages: {
      noRelativeImport: 'Test file should not use a relative import. ' +
        'Use a global import as if this were a user of the package.'
    }
  },

  create(context): Rule.RuleListener {
    if (!context.parserServices ||
      !context.parserServices.program ||
      !context.parserServices.hasFullTypeInformation) {
      return {};
    }

    // TODO (43081j): how do we get this?
    const isDeclarationFile = false;

    if (isDeclarationFile) {
      return {};
    }

    const checker = context.parserServices.program.getTypeChecker();

    return {
      ImportDeclaration: (node: ESTree.ImportDeclaration): void => {
        if (typeof node.source.value === 'string' &&
          node.source.value.startsWith('.')) {
          // TODO (43081j): check this is actually resolving the right thing
          const moduleSymbol = checker.getSymbolAtLocation(node.source);
          if (moduleSymbol &&
            moduleSymbol.declarations) {
            for (const decl of moduleSymbol.declarations) {
              if (decl.kind === ts.SyntaxKind.SourceFile && (decl as ts.SourceFile).isDeclarationFile) {
                context.report({
                  node,
                  messageId: 'noRelativeImport'
                });
              }
            }
          }
        }
      }
    };
  }
};
