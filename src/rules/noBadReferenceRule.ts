import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

const referencePattern = /^\/\s*<reference\s*path=(?:"([^"]*)"|'([^']*)')/;

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbid <reference path="../etc"/> in any file, and forbid <reference path> in test files.',
      category: 'Functionality'
    },
    messages: {
      noRef: 'Don\'t use <reference path> to reference another package. Use an import or <reference types> instead.',
      noRefInTests: 'Don\'t use <reference path> in test files. Use <reference types> or include the file in \'tsconfig.json\'.'
    }
  },

  create(context): Rule.RuleListener {
    const source = context.getSourceCode();

    return {
      Program: (node: ESTree.Program): void => {
        const comments = source.getCommentsBefore(node);
        
        for (const comment of comments) {
          if (comment.type === 'Line') {
            const matches = referencePattern.exec(comment.value);
            // TODO (43081j): get this from somewhere...
            const isDeclarationFile = true;

            if (matches) {
              if (isDeclarationFile) {
                if ((matches[1] || matches[2]).startsWith('..')) {
                  context.report({
                    node: comment as unknown as ESTree.Node,
                    messageId: 'noRef'
                  });
                }
              } else {
                context.report({
                  node: comment as unknown as ESTree.Node,
                  messageId: 'noRefInTests'
                });
              }
            }
          }
        }
      }
    };
  }
};
