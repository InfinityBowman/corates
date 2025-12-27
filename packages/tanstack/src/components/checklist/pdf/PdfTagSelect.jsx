/**
 * PdfTagSelect - Dropdown to change PDF tag
 *
 * Uses the Select component to allow changing PDF tags
 */

import { Select } from '@corates/ui';

const TAG_OPTIONS = [
  { label: 'Primary Report', value: 'primary' },
  { label: 'Protocol', value: 'protocol' },
  { label: 'Secondary', value: 'secondary' },
];

export default function PdfTagSelect(props) {
  // props.value: current tag value
  // props.onChange: (tag: string) => void
  // props.disabled: boolean
  // props.disablePrimary: boolean - disable primary option if another PDF has it
  // props.disableProtocol: boolean - disable protocol option if another PDF has it

  const disabledValues = () => {
    const disabled = [];
    if (props.disablePrimary) disabled.push('primary');
    if (props.disableProtocol) disabled.push('protocol');
    return disabled;
  };

  return (
    <Select
      items={TAG_OPTIONS}
      value={props.value || 'secondary'}
      onChange={props.onChange}
      disabled={props.disabled}
      disabledValues={disabledValues()}
      placeholder='Select tag'
    />
  );
}
