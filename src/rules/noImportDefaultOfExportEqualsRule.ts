import * as ts from 'typescript';
import { getModuleDeclarationStatements } from "../util";
import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

// TODO (43081j): does this mean we need typescript as a non-dev
// dependency? or a peer maybe?
function getStatements(decl: ts.Declaration): ReadonlyArray<ts.Statement> | undefined {
    return ts.isSourceFile(decl) ? decl.statements
        : ts.isModuleDeclaration(decl) ? getModuleDeclarationStatements(decl)
        : undefined;
}

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbid a default import to reference an `export =` module.',
      category: 'Functionality'
    },
    messages: {
      noDefaultImport: 'The module {{moduleName}} uses `export = `. ' +
       'Import with `import {{importName}} = require({{moduleName}})`.'
    }
  },

  create(context): Rule.RuleListener {
    if (!context.parserServices ||
      !context.parserServices.program ||
      !context.parserServices.hasFullTypeInformation) {
      return {};
    }

    const checker = context.parserServices.program.getTypeChecker();
    const hasExportAssignment = (declaration: ts.Declaration): boolean => {
      const statements = getStatements(declaration);
      return statements !== undefined &&
        statements.some(s => ts.isExportAssignment(s) && !!s.isExportEquals);
    };

    return {
      ImportDeclaration: (node: ESTree.ImportDeclaration): void => {
        if (node.source.type !== 'Literal' ||
          typeof node.source.value !== 'string') {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            // TODO (43081j): figure out what we should be getting the
            // symbol of
            const sym = checker.getSymbolAtLocation(specifier.local);
            if (sym?.declarations && sym.declarations.some(hasExportAssignment)) {
              context.report({
                node,
                messageId: 'noDefaultImport',
                data: {
                  moduleName: node.source.value,
                  importName: specifier.local.name
                }
              });
            }
          }
        }
      }
    };
  }
};
