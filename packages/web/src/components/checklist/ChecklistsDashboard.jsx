/**
 * ChecklistsDashboard - Standalone page for local appraisals
 *
 * Shown when user navigates to /dashboard without an org context.
 * Wraps LocalAppraisalsPanel with full-page styling.
 */

import LocalAppraisalsPanel from './LocalAppraisalsPanel.jsx';

export default function ChecklistsDashboard(props) {
  const isLoggedIn = () => props.isLoggedIn ?? false;

  return (
    <LocalAppraisalsPanel
      compact={false}
      showSignInPrompt={!isLoggedIn()}
      showHeader={true}
    />
  );
}
