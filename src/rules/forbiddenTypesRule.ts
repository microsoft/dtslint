import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "forbidden-types",
		description: "Forbid the Function, Object, Boolean, Number, and String types.",
		rationale: "Certain types are never a good idea.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static upperCaseFailureString(name: string) {
		return `Avoid using the ${name} type. You probably meant ${name.toLowerCase()}`;
	}

	static FUNCTION_FAILURE_STRING = "Avoid using the Function type. Prefer a specific function type, like `() => void`.";

	static OBJECT_FAILURE_STRING = "Avoid using the Object type. Did you mean `any` or `{}`?";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitTypeReference(node: ts.TypeReferenceNode) {
		const name = node.typeName.getText();
		const failure = nameFailure(name);
		if (failure) {
			this.addFailureAtNode(node, failure);
		}
		super.visitTypeReference(node);
	}
}

function nameFailure(name: string): string | undefined {
	switch (name) {
		case "Function":
			return Rule.FUNCTION_FAILURE_STRING;
		case "Object":
			return Rule.OBJECT_FAILURE_STRING;
		case "Boolean": case "Number": case "String":
			return Rule.upperCaseFailureString(name);
		default:
			return undefined;
	}
}
