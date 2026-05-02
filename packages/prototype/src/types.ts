export interface StudyFields {
  name: string;
  firstAuthor: string | null;
  publicationYear: string | null;
  reviewer1: string | null;
  reviewer2: string | null;
  createdAt: number;
}

export interface ChecklistFields {
  type: string;
  status: string;
  assignedTo: string | null;
  createdAt: number;
}

export interface QuestionFields {
  verdict: string | null;
  critical: boolean;
}
