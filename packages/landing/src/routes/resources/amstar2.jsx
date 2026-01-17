import ToolResourcePage from '~/components/resources/ToolResourcePage';
import { getToolBySlug } from '~/lib/tool-content';

export default function AMSTAR2ResourcePage() {
  const tool = getToolBySlug('amstar2');
  return <ToolResourcePage tool={tool} />;
}
