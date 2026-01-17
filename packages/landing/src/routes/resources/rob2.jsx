import ToolResourcePage from '~/components/resources/ToolResourcePage';
import { getToolBySlug } from '~/lib/tool-content';

export default function ROB2ResourcePage() {
  const tool = getToolBySlug('rob2');
  return <ToolResourcePage tool={tool} />;
}
