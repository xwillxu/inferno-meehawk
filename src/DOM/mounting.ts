import {
	isArray,
	isFunction,
	isNullOrUndef,
	isString,
	isInvalid,
	isUndefined,
	isNull,
	throwError,
	EMPTY_OBJ
} from '../shared';
import {
	setTextContent,
	appendChild,
// 	formSelectValue,
// 	getPropFromOptElement,
	createStatefulComponentInstance,
	createStatelessComponentInput,
	documentCreateElement,
	copyPropsTo
} from './utils';
import {
	// patchStyle,
	patchProp
} from './patching';
import { componentToDOMNodeMap } from './rendering';
// import {
// 	recycleOptVElement,
// 	recyclingEnabled,
// 	recycleVComponent
// } from './recycling';
import { devToolsStatus } from './devtools';
import { VNodeFlags, isVNode } from '../core/shapes';

export function mount(vNode, parentDom, lifecycle, context, isSVG) {
	const flags = vNode.flags;

	switch (flags) {
		case VNodeFlags.HtmlElement:
		case VNodeFlags.SvgElement:
		case VNodeFlags.InputElement:
		case VNodeFlags.TextAreaElement:
			return mountElement(vNode, parentDom, lifecycle, context, isSVG || flags & VNodeFlags.SvgElement);
		case VNodeFlags.ComponentClass:
		case VNodeFlags.ComponentFunction:
			return mountComponent(vNode, parentDom, lifecycle, context, isSVG, flags & VNodeFlags.ComponentClass);
		case VNodeFlags.Void:
			return mountVoid(vNode, parentDom);
		case VNodeFlags.Fragment:
			return mountFragment(vNode, parentDom, lifecycle, context, isSVG);
		case VNodeFlags.Text:
			return mountText(vNode, parentDom);
		default:
			if (process.env.NODE_ENV !== 'production') {
				throwError(`mount() expects a valid VNode, instead it received an object with the type "${ typeof vNode }".`);
			}
			throwError();
	}
}

export function mountText(vNode, parentDom) {
	const dom = document.createTextNode(vNode.children);

	vNode.dom = dom;
	if (parentDom) {
		appendChild(parentDom, dom);
	}
	return dom;
}

export function mountVoid(vNode, parentDom) {
	const dom = document.createTextNode('');

	vNode.dom = dom;
	if (parentDom) {
		appendChild(parentDom, dom);
	}
	return dom;
}

export function mountElement(vNode, parentDom, lifecycle, context, isSVG) {
	const tag = vNode.type;
	const dom = documentCreateElement(tag, isSVG);
	const children = vNode.children;
	const props = vNode.props;
	const ref = vNode.ref;
	const hasProps = !isNullOrUndef(props);

	vNode.dom = dom;
	if (!isNullOrUndef(ref)) {
		mountRef(dom, ref, lifecycle);
	}
	if (hasProps) {
		for (let prop in props) {
			// do not add a hasOwnProperty check here, it affects performance
			patchProp(prop, null, props[prop], dom, isSVG);
		}
	}
	if (!isNull(children)) {
		if (isString(children)) {
			setTextContent(dom, children);
		} else if (isArray(children)) {
			for (let i = 0; i < children.length; i++) {
				mount(children[i], dom, lifecycle, context, isSVG);
			}
		} else if (isVNode(children)) {
			mount(children, dom, lifecycle, context, isSVG);
		}
	}
	if (!isNull(parentDom)) {
		appendChild(parentDom, dom);
	}
	return dom;
}

export function mountFragment(vNode, parentDom, lifecycle, context, isSVG) {
	const children = vNode.children;
	const dom = document.createDocumentFragment();

	for (let i = 0; i < children.length; i++) {
		mount(children[i], dom, lifecycle, context, isSVG);
	}
	vNode.dom = dom;
	if (parentDom) {
		appendChild(parentDom, dom);
	}
	return dom;
}

export function mountComponent(vNode, parentDom, lifecycle, context, isSVG, isClass) {
// 	if (recyclingEnabled) {
// 		const dom = recycleVComponent(vComponent, lifecycle, context, isSVG, shallowUnmount);

// 		if (!isNull(dom)) {
// 			if (!isNull(parentDom)) {
// 				appendChild(parentDom, dom);
// 			}
// 			return dom;
// 		}
// 	}
	const type = vNode.type;
	const props = vNode.props || EMPTY_OBJ;
	const ref = vNode.ref;
	let dom;

	if (isClass) {
		const defaultProps = type.defaultProps;

		if (!isUndefined(defaultProps)) {
			copyPropsTo(defaultProps, props);
			vNode.props = props;
		}
		const instance = createStatefulComponentInstance(type, props, context, isSVG, devToolsStatus);
		const input = instance._lastInput;

		instance._vNode = vNode;
		vNode.dom = dom = mount(input, null, lifecycle, instance._childContext, isSVG);
		if (!isNull(parentDom)) {
			appendChild(parentDom, dom);
		}
		mountStatefulComponentCallbacks(ref, instance, lifecycle);
		componentToDOMNodeMap.set(instance, dom);
		vNode.children = instance;
	} else {
		const input = createStatelessComponentInput(type, props, context);

		vNode.dom = dom = mount(input, null, lifecycle, context, isSVG);
		vNode.children = input;
		mountStatelessComponentCallbacks(ref, dom, lifecycle);
		if (!isNull(parentDom)) {
			appendChild(parentDom, dom);
		}
	}
	return dom;
}

export function mountStatefulComponentCallbacks(ref, instance, lifecycle) {
	if (ref) {
		if (isFunction(ref)) {
			lifecycle.addListener(() => ref(instance));
		} else {
			if (process.env.NODE_ENV !== 'production') {
				throwError('string "refs" are not supported in Inferno 0.8+. Use callback "refs" instead.');
			}
			throwError();
		}
	}
	if (!isNull(instance.componentDidMount)) {
		lifecycle.addListener(() => {
			instance.componentDidMount();
		});
	}
}

export function mountStatelessComponentCallbacks(ref, dom, lifecycle) {
	if (ref) {
		if (!isNullOrUndef(ref.onComponentWillMount)) {
			ref.onComponentWillMount();
		}
		if (!isNullOrUndef(ref.onComponentDidMount)) {
			lifecycle.addListener(() => ref.onComponentDidMount(dom));
		}
	}
}

function mountRef(dom, value, lifecycle) {
	if (isFunction(value)) {
		lifecycle.addListener(() => value(dom));
	} else {
		if (isInvalid(value)) {
			return;
		}
		if (process.env.NODE_ENV !== 'production') {
			throwError('string "refs" are not supported in Inferno 0.8+. Use callback "refs" instead.');
		}
		throwError();
	}
}
