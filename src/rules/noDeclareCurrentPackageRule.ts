import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';
import { getCommonDirectoryName } from "../util";

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Don\'t use an ambient module declaration of the current package; use a normal module.',
      category: 'Functionality'
    },
    messages: {
      noDeclare: 'Instead of declaring a module with `declare module "{{text}}"' +
        'write its contents in directly in {{preferred}}.'
    }
  },

  create(context): Rule.RuleListener {
    const source = context.getSourceCode();
    // TODO (43081j): find this out from somewhere
    const isDeclarationFile = true;
    // TODO (43081j): compute this path properly
    const packageName = getCommonDirectoryName([context.getFilename()]);

    if (!isDeclarationFile) {
      return {};
    }

    return {
      TSModuleDeclaration: (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSModuleDeclaration;

        if (tsNode.id.type === 'Literal' &&
          typeof tsNode.id.value === 'string' &&
          (tsNode.id.value === packageName || tsNode.id.value.startsWith(`${packageName}/`))) {
          const preferred = tsNode.id.value === packageName ?
            '"index.d.ts"' : `"${tsNode.id.value}.d.ts" or "${tsNode.id.value}/index.d.ts`;
          context.report({
            node,
            data: {preferred, text: tsNode.id.value},
            messageId: 'noDeclare'
          });
        }
      }
    };
  }
};
