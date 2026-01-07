/**
 * Custom ESLint rule: corates-ui-imports
 *
 * Ensures correct usage of @corates/ui components:
 * - Prestyled components (Dialog, Menu, etc.) should NOT be used with .Root, .Content patterns
 * - Primitive components (DialogPrimitive, MenuPrimitive) SHOULD be used with .Root, .Content patterns
 *
 * This prevents confusion between the two component types and ensures consistent usage.
 */

// Components that have both prestyled and primitive versions
const COMPONENT_MAP = {
  // Prestyled name -> Primitive name
  Accordion: 'AccordionPrimitive',
  Avatar: 'AvatarPrimitive',
  Checkbox: 'CheckboxPrimitive',
  Clipboard: 'ClipboardPrimitive',
  Collapsible: 'CollapsiblePrimitive',
  Combobox: 'ComboboxPrimitive',
  Dialog: 'DialogPrimitive',
  Drawer: 'DrawerPrimitive',
  Editable: 'EditablePrimitive',
  FileUpload: 'FileUploadPrimitive',
  FloatingPanel: 'FloatingPanelPrimitive',
  Menu: 'MenuPrimitive',
  NumberInput: 'NumberInputPrimitive',
  PasswordInput: 'PasswordInputPrimitive',
  PinInput: 'PinInputPrimitive',
  Popover: 'PopoverPrimitive',
  Progress: 'ProgressPrimitive',
  QRCode: 'QRCodePrimitive',
  RadioGroup: 'RadioGroupPrimitive',
  Select: 'SelectPrimitive',
  Splitter: 'SplitterPrimitive',
  Switch: 'SwitchPrimitive',
  Tabs: 'TabsPrimitive',
  TagsInput: 'TagsInputPrimitive',
  Toast: 'ToastPrimitive',
  Toaster: 'ToasterPrimitive',
  ToggleGroup: 'ToggleGroupPrimitive',
  Tooltip: 'TooltipPrimitive',
};

// Common primitive sub-component names (Ark UI pattern)
const PRIMITIVE_SUBCOMPONENTS = [
  'Root',
  'Trigger',
  'Content',
  'Positioner',
  'Backdrop',
  'CloseTrigger',
  'Title',
  'Description',
  'Item',
  'ItemText',
  'ItemIndicator',
  'ItemGroup',
  'ItemGroupLabel',
  'Control',
  'Label',
  'Input',
  'Indicator',
  'Track',
  'Range',
  'Thumb',
  'ValueText',
  'Context',
  'HiddenInput',
  'Arrow',
  'ArrowTip',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce correct usage of @corates/ui prestyled vs primitive components',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      usePrimitive:
        "Component '{{component}}' is prestyled and should not be used with '.{{subcomponent}}'. Import '{{primitive}}' instead for primitive usage: import { {{primitive}} as {{component}} } from '@corates/ui' or use the prestyled '{{component}}' without subcomponents.",
      usePrestyled:
        "You're importing '{{primitive}}' but not using primitive patterns (.Root, .Content, etc.). Consider using the prestyled '{{prestyled}}' component instead.",
    },
  },

  create(context) {
    // Track imports from @corates/ui
    const importedComponents = new Map(); // name -> { isPrestyled, localName, node }
    const usedAsPrimitive = new Set(); // local names used with .Root, .Content, etc.

    return {
      // Track imports
      ImportDeclaration(node) {
        if (node.source.value !== '@corates/ui') return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;

          const importedName = specifier.imported.name;
          const localName = specifier.local.name;

          // Check if it's a prestyled component
          if (COMPONENT_MAP[importedName]) {
            importedComponents.set(localName, {
              isPrestyled: true,
              importedName,
              primitiveName: COMPONENT_MAP[importedName],
              localName,
              node: specifier,
            });
          }
          // Check if it's a primitive component
          else if (importedName.endsWith('Primitive')) {
            const prestyledName = importedName.replace('Primitive', '');
            importedComponents.set(localName, {
              isPrestyled: false,
              importedName,
              prestyledName,
              localName,
              node: specifier,
            });
          }
        }
      },

      // Track member expressions like Dialog.Root, Menu.Content (in non-JSX code)
      MemberExpression(node) {
        // Skip if this is inside a JSX context (JSXMemberExpression handles that)
        if (node.parent && node.parent.type.startsWith('JSX')) return;

        // Check if it's accessing a property on an identifier
        if (node.object.type !== 'Identifier') return;
        if (node.property.type !== 'Identifier') return;

        const objectName = node.object.name;
        const propertyName = node.property.name;

        // Check if it's a primitive subcomponent access
        if (PRIMITIVE_SUBCOMPONENTS.includes(propertyName)) {
          const componentInfo = importedComponents.get(objectName);

          if (componentInfo) {
            usedAsPrimitive.add(objectName);

            // If it's a prestyled component being used as primitive, report error
            if (componentInfo.isPrestyled) {
              context.report({
                node,
                messageId: 'usePrimitive',
                data: {
                  component: objectName,
                  subcomponent: propertyName,
                  primitive: componentInfo.primitiveName,
                },
              });
            }
          }
        }
      },

      // Track JSX member expressions like <Dialog.Root>, <Menu.Content>
      JSXMemberExpression(node) {
        // Check if it's accessing a property on an identifier
        if (node.object.type !== 'JSXIdentifier') return;
        if (node.property.type !== 'JSXIdentifier') return;

        const objectName = node.object.name;
        const propertyName = node.property.name;

        // Check if it's a primitive subcomponent access
        if (PRIMITIVE_SUBCOMPONENTS.includes(propertyName)) {
          const componentInfo = importedComponents.get(objectName);

          if (componentInfo) {
            usedAsPrimitive.add(objectName);

            // If it's a prestyled component being used as primitive, report error
            if (componentInfo.isPrestyled) {
              context.report({
                node,
                messageId: 'usePrimitive',
                data: {
                  component: objectName,
                  subcomponent: propertyName,
                  primitive: componentInfo.primitiveName,
                },
              });
            }
          }
        }
      },

      // At the end, check for primitives that weren't used as primitives
      // (This is a softer warning - disabled for now as it can be noisy)
      // 'Program:exit'() {
      //   for (const [localName, info] of importedComponents) {
      //     if (!info.isPrestyled && !usedAsPrimitive.has(localName)) {
      //       context.report({
      //         node: info.node,
      //         messageId: 'usePrestyled',
      //         data: {
      //           primitive: info.importedName,
      //           prestyled: info.prestyledName,
      //         },
      //       });
      //     }
      //   }
      // },
    };
  },
};
