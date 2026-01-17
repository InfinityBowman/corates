import ToolResourcePage from '~/components/resources/ToolResourcePage';
import { getToolBySlug } from '~/lib/tool-content';

export default function ROBINSIResourcePage() {
  const tool = getToolBySlug('robins-i');
  return <ToolResourcePage tool={tool} />;
}
