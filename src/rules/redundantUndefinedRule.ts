import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

const selector = 'TSPropertySignature[optional] TSUnionType > TSUndefinedKeyword,' +
  'ClassProperty[optional] TSUnionType > TSUndefinedKeyword';

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbids optional parameters to include an explicit `undefined` in their type; requires it in optional properties.',
      category: 'Style'
    },
    messages: {
      noUndefined: 'Parameter is optional, so no need to include `undefined` in the type.'
    }
  },

  create(context): Rule.RuleListener {
    if (context.getFilename().includes('node_modules')) {
      return {};
    }
    return {
      [selector]: (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSUndefinedKeyword;

        context.report({
          node,
          messageId: 'noUndefined'
        });
      }
    };
  }
};
