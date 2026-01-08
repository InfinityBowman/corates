/**
 * DashboardBody - Main content wrapper for admin pages
 *
 * Provides consistent max-width constraints, padding, and scroll behavior
 * for admin dashboard content. Based on Polar's DashboardBody pattern.
 *
 * @example
 * <DashboardBody>
 *   <DashboardHeader title="Users" />
 *   <AdminSection title="Active Users">
 *     <UserTable />
 *   </AdminSection>
 * </DashboardBody>
 *
 * @example
 * // Full-width mode for tables or charts that need more space
 * <DashboardBody wide>
 *   <AnalyticsSection />
 * </DashboardBody>
 */

/**
 * @param {Object} props
 * @param {string} [props.class] - Additional CSS classes
 * @param {JSX.Element} props.children - Page content
 */
export function DashboardBody(props) {
  return (
    <div class={`flex h-full w-full flex-col px-4 py-6 md:px-6 lg:px-8 ${props.class || ''}`}>
      {props.children}
    </div>
  );
}

export default DashboardBody;
