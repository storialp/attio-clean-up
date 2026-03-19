export type SimplifiedCompany = {
  id: string;
  name: string;
  domain: string;
  description: string;
  employeeRange: string;
  tags: string[];
  webUrl: string;
  raw: Record<string, unknown>;
};

export type DeletionLogItem = {
  id: number;
  recordId: string;
  companyName: string | null;
  primaryDomain: string | null;
  deletedAt: string;
  attioUrl: string | null;
};
