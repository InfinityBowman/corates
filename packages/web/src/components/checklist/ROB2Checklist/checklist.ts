export function mapOverallJudgementToDisplay(score: string | null): string | null {
  switch (score) {
    case 'Low':
      return 'Low risk of bias';
    case 'Some concerns':
      return 'Some concerns';
    case 'High':
      return 'High risk of bias';
    default:
      return score;
  }
}
