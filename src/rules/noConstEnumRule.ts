import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbid `const enum`',
      category: 'Functionality'
    },
    messages: {
      noConst: 'Use of `const enum`s is forbidden.'
    }
  },

  create(context): Rule.RuleListener {
    return {
      TSEnumDeclaration: (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSEnumDeclaration;

        if (tsNode.const) {
          context.report({
            node,
            messageId: 'noConst'
          });
        }
      }
    };
  }
};
