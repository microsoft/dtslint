import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

type DeclarationLike =
  | ESTree.FunctionDeclaration
  | ESTree.ClassDeclaration
  | TSESTree.TSTypeAliasDeclaration
  | TSESTree.TSInterfaceDeclaration
  | TSESTree.TSDeclareFunction;
const declarationSelector = [
  'FunctionDeclaration',
  'ClassDeclaration',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSDeclareFunction'
].join(',');

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbid to `export = foo` where `foo` is a namespace and isn\'t merged with a function/class/type/interface.',
      category: 'Functionality'
    },
    messages: {
      exportNamespace: 'Instead of `export =`-ing a namespace, use the body of the namespace as the module body.'
    }
  },

  create(context): Rule.RuleListener {
    const exportNodes = new Set<TSESTree.TSExportAssignment>();
    const namespaces = new Set<string>();
    const variables = new Set<string>();

    return {
      TSExportAssignment: (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSExportAssignment;
        exportNodes.add(tsNode);
      },
      TSModuleDeclaration: (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSModuleDeclaration;
        if (tsNode.id.type === 'Identifier') {
          namespaces.add(tsNode.id.name);
        }
      },
      VariableDeclaration: (node: ESTree.VariableDeclaration): void => {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier') {
            variables.add(decl.id.name);
          }
        }
      },
      [declarationSelector]: (node: ESTree.Node): void => {
        const tsNode = node as unknown as DeclarationLike;
        if (tsNode.id.type === 'Identifier') {
          variables.add(tsNode.id.name);
        }
      },
      'Program:exit': (node: ESTree.Program): void => {
        for (const exportNode of exportNodes) {
          if (exportNode.expression.type === 'Identifier' &&
            namespaces.has(exportNode.expression.name) &&
            !variables.has(exportNode.expression.name)) {
            context.report({
              node: exportNode,
              messageId: 'exportNamespace'
            });
          }
        }
      }
    };
  }
};
