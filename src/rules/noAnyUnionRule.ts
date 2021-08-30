import {Rule} from 'eslint';
import * as ESTree from 'estree';
import {TSESTree} from '@typescript-eslint/experimental-utils';

export const rule: Rule.RuleModule = {
  meta: {
    docs: {
      description: 'Forbid a union to contain `any`',
      category: 'Functionality'
    },
    messages: {
      noAny: 'Including `any` in a union will override all other members of the union.'
    }
  },

  create(context): Rule.RuleListener {
    return {
      'TSUnionType > TSAnyKeyword': (node: ESTree.Node): void => {
        const tsNode = node as unknown as TSESTree.TSAnyKeyword;
        context.report({
          node,
          messageId: 'noAny'
        });
      }
    };
  }
};
