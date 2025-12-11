
// Get score badge styling based on score level
export const getScoreStyle = score => {
  switch (score) {
    case 'High':
      return 'bg-green-100 text-green-800';
    case 'Moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'Low':
      return 'bg-orange-100 text-orange-800';
    case 'Critically Low':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};
