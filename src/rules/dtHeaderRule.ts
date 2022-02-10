import { isMainFile } from "../util";
import {Rule} from 'eslint';
import * as ESTree from 'estree';

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Ensure consistency of DefinitelyTyped headers.',
      category: 'Functionality'
    },
    messages: {
      headersInMainOnly: 'Header should only be in `index.d.ts` of the root.',
      versionInMainOnly: 'TypeScript version should be specified under header in `index.d.ts`.',
      authorName: 'Author name should be your name, not the default.'
    }
  },

  create(context): Rule.RuleListener {
    const source = context.getSourceCode();
    const headerTypes = [
      ['Type definitions for', 'headersInMainOnly'],
      ['TypeScript Version', 'versionInMainOnly'],
      ['Minimum TypeScript Version', 'versionInMainOnly'],
      ['Definitions by: My Self', 'authorName']
    ];

    if (!isMainFile(context.getFilename(), true)) {
      return {};
    }

    return {
      Program: (node: ESTree.Program): void => {
        const comments = source.getAllComments();

        for (const comment of comments) {
          if (comment.type === 'Line') {
            const match = headerTypes.find(([prefix]) =>
              comment.value.startsWith(prefix));

            if (match) {
              context.report({
                node: comment as unknown as ESTree.Node,
                messageId: match[1]
              });
            }
          }
        }
      }
    };
  }
};
