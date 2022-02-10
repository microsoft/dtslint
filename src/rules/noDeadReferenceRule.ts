import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

const referencePattern = /^\/\s*<reference\s*/;

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Ensures that all `/// <reference>` comments go at the top of the file.',
      category: 'Functionality'
    },
    messages: {
      noDeadRef: '`/// <reference>` directive must be at top of file to take effect.'
    }
  },

  create(context): Rule.RuleListener {
    const source = context.getSourceCode();

    return {
      Program: (node: ESTree.Program): void => {
        const comments = source.getCommentsInside(node);
        
        for (const comment of comments) {
          if (comment.type === 'Line' && referencePattern.test(comment.value)) {
            context.report({
              node: comment as unknown as ESTree.Node,
              messageId: 'noDeadRef'
            });
          }
        }
      }
    };
  }
};
