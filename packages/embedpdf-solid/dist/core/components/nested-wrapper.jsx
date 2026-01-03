/**
 * Recursively wraps children in a chain of wrapper components.
 * Used by AutoMount to nest wrapper components in registration order.
 */
export const NestedWrapper = props => {
    const wrapperList = props.wrappers;
    if (wrapperList.length === 0) {
        return <>{props.children}</>;
    }
    if (wrapperList.length === 1) {
        const Wrapper = wrapperList[0];
        return <Wrapper children={props.children}/>;
    }
    const [first, ...rest] = wrapperList;
    const FirstWrapper = first;
    return (<FirstWrapper children={<NestedWrapper wrappers={rest} children={props.children}/>}/>);
};
//# sourceMappingURL=nested-wrapper.jsx.map